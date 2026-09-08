import {generateLinearFrame,smoothFrame,temporalBlend,mipChain,resizeLinear,modulatedSettings,halfFloat} from './pattern.js';
import {linearPalette} from '../core/lut.js';
import {decodeHDR} from './hdr.js';
const now=()=>performance.now();
export class EnvironmentProcessor {
 constructor(){this.last=null;this.patternTime=0;this.huePhase=0;this.modPhase=0;this.lastRevision=-1;}
 process(m){
 let {last,patternTime,huePhase,modPhase,lastRevision}=this;
 const start=now();
 try{
  let image,levels,preview,previewWidth,previewHeight,metrics={},timings={generate:0,spatial:0,temporal:0,pipeline:0,mips:0,preview:0,pack:0};
  if(m.type==='frame'){
   const dt=Math.max(0,Math.min(.25,m.dt)),base=m.settings;
   if(m.reset){patternTime=0;huePhase=0;modPhase=0;last=null;}
   if(base.modEnabled)modPhase+=dt*base.modHz;
   const {settings:s,output}=modulatedSettings(base,modPhase);
   patternTime+=dt*2*s.speed;huePhase=(huePhase+dt*s.hueShift/360)%1;
   const w=s.sourceWidth,h=w/2;
   let t=now();let pixels=generateLinearFrame(w,h,patternTime,huePhase,s,linearPalette(m.palette));timings.generate=now()-t;
   t=now();pixels=smoothFrame(pixels,w,h,s.spatialSmooth);timings.spatial=now()-t;
   if(lastRevision!==m.revision)last=null;
   t=now();pixels=temporalBlend(pixels,last,dt||1/24,s.temporalSmooth);last=pixels;lastRevision=m.revision;timings.temporal=now()-t;
   t=now();const half=new Uint16Array(pixels.length);for(let i=0;i<pixels.length;i++)half[i]=halfFloat(pixels[i]);timings.pack=now()-t;
   levels=[{data:half,width:w,height:h}];
   preview=pixels;previewWidth=w;previewHeight=h;
   metrics={patternTime,huePhase,modPhase,modOutput:output,baseWidth:w,baseHeight:h,envMapWidth:s.envMapWidth,envMapHeight:Math.round(s.envMapWidth/2),upsamplerA:s.upsampling,upsamplerB:s.upsamplingStageB,filterStage:s.processingStage,gpuReconstruction:true};
  }else if(m.type==='hdr'){
   image=decodeHDR(m.buffer);metrics={peak:image.peak,originalWidth:image.width,originalHeight:image.height};
   const cap=2048,scale=Math.min(1,cap/image.width,1024/image.height);
   if(scale<1){const w=Math.max(2,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale));image={data:resizeLinear(image.data,image.width,image.height,w,h),width:w,height:h};}
  }else if(m.type==='image'){
   image={data:new Float32Array(m.buffer),width:m.width,height:m.height};metrics={originalWidth:m.originalWidth||m.width,originalHeight:m.originalHeight||m.height,sourceType:m.sourceType||'image'};
  }else throw new Error('Unknown worker request.');
  if(!levels){let t=now();levels=mipChain(image.data,image.width,image.height);timings.mips=now()-t;previewWidth=Math.min(256,image.width);previewHeight=Math.max(1,Math.round(previewWidth*image.height/image.width));t=now();preview=resizeLinear(image.data,image.width,image.height,previewWidth,previewHeight);timings.preview=now()-t;}
  Object.assign(this,{last,patternTime,huePhase,modPhase,lastRevision});
  const workerMs=now()-start;
  return {id:m.id,type:m.type,revision:m.revision,levels,preview,previewWidth,previewHeight,metrics:{...metrics,...timings,workerMs}};
 }catch(e){return {id:m.id,error:e?.message||String(e)};}
 }}
