import {makeSpectrum} from './spectrum.js';
import {SPECTRUM_EVOLVE_WGSL,BIT_REVERSE_WGSL,FFT_STAGE_WGSL,FINALIZE_OCEAN_WGSL} from './fft-shaders.js';
export async function checkedModule(device,code,label){const module=device.createShaderModule({code,label});const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(`${label}: ${errors.map(m=>`${m.lineNum}:${m.linePos} ${m.message}`).join('; ')}`);return module;}
const CONFIGS=[{n:128,span:1350,weight:.98,chop:.84,wind:11.5,peak:100},{n:128,span:275,weight:.29,chop:.48,wind:9,peak:27},{n:64,span:58,weight:.045,chop:.16,wind:6.5,peak:6.5}];
export class OceanSimulation{
 constructor(device){this.device=device;this.cascades=[];this.buffers=[];this.time=0;this.dispatches=0;}
 buffer(data,label,extra=0){const size=typeof data==='number'?data:data.byteLength;const b=this.device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|extra,label});this.buffers.push(b);if(typeof data!=='number')this.device.queue.writeBuffer(b,0,data);return b;}
 async init(){
  this.pipelines={};
  for(const [key,code] of Object.entries({evolve:SPECTRUM_EVOLVE_WGSL,reverse:BIT_REVERSE_WGSL,stage:FFT_STAGE_WGSL,finalize:FINALIZE_OCEAN_WGSL})){const module=await checkedModule(this.device,code,`ocean ${key}`);this.pipelines[key]=await this.device.createComputePipelineAsync({label:`ocean ${key}`,layout:'auto',compute:{module,entryPoint:'main'}});}
  const bind=(pipeline,bufs)=>this.device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:bufs.map((buffer,binding)=>({binding,resource:{buffer}}))});
  this.cascades=CONFIGS.map((config,index)=>{
   const {n,span}=config,cells=n*n,c={...config};c.state=this.buffer(cells*32,`ocean state ${index}`);c.spectrum=this.buffer(makeSpectrum(n,span,9137+93+index*977,config),`spectrum ${index}`);const a=this.buffer(cells*16,'FFT A'),b=this.buffer(cells*16,'FFT B');c.evolveParams=this.buffer(new Float32Array([0,n,span,1]),'evolution parameters');c.finalParams=this.buffer(new Float32Array([n,span,config.chop,1,1/60,.62,0,0]),'finalize parameters');
   c.commands=[['evolve',bind(this.pipelines.evolve,[c.spectrum,a,c.evolveParams])]];
   let src=a,dst=b;const bits=Math.log2(n);
   for(let axis=0;axis<2;axis++){
    const param=this.buffer(new Float32Array([n,axis,bits,0]),'reverse parameters');c.commands.push(['reverse',bind(this.pipelines.reverse,[src,dst,param])]);[src,dst]=[dst,src];
    for(let stage=0;stage<bits;stage++){const p=this.buffer(new Float32Array([n,axis,stage,0]),'FFT stage parameters');c.commands.push(['stage',bind(this.pipelines.stage,[src,dst,p])]);[src,dst]=[dst,src];}
   }
   c.commands.push(['finalize',bind(this.pipelines.finalize,[src,c.state,c.finalParams])]);return c;
  });
 }
 encode(encoder,dt,s,timestampWrites=null){this.time+=Math.max(0,Math.min(dt,.05));const desc={label:'liquid FFT'};if(timestampWrites)desc.timestampWrites=timestampWrites;const pass=encoder.beginComputePass(desc);for(const c of this.cascades){this.device.queue.writeBuffer(c.evolveParams,0,new Float32Array([this.time,c.n,c.span,s.waves]));this.device.queue.writeBuffer(c.finalParams,0,new Float32Array([c.n,c.span,c.chop*s.choppiness,s.waves,dt,.62,0,0]));for(const [key,group] of c.commands){pass.setPipeline(this.pipelines[key]);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(c.n*c.n/64));this.dispatches++;}}pass.end();}
 dispose(){for(const b of this.buffers)b.destroy();this.buffers=[];this.cascades=[];}
}
