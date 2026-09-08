import {LIQUID,MESH_SURFACE} from '../shaders.js';
import {checkedModule} from '../ocean.js';
import {texture,safePipeline,renderPass} from './gpu-utils.js';
const auxFragment=energy=>/*wgsl*/`
struct AuxOut { @location(0) linear:f32,@location(1) surface:vec4f };
@fragment fn auxFragment(v:MeshOut)->AuxOut{
 let d=length(v.world-u.cameraTime.xyz);if(u.forwardMode.w<.5&&d>=u.distance.x){discard;}
 var o:AuxOut;o.linear=d;o.surface=vec4f(normalize(v.normal),clamp(${energy},0.0,1.0));return o;
}`;
export const AUX_LIQUID=LIQUID+auxFragment('v.foam');
export const AUX_MESH=MESH_SURFACE+auxFragment('v.waveFoam');
export const DEPTH_REDUCE=/*wgsl*/`
@group(0) @binding(0) var src:texture_2d<f32>;
struct Q{@builtin(position) pos:vec4f};
@vertex fn quad(@builtin(vertex_index) i:u32)->Q{var o:Q;o.pos=vec4f(vec2f(f32((i<<1u)&2u),f32(i&2u))*2.0-1.0,0.0,1.0);return o;}
@fragment fn main(v:Q)->@location(0) f32{let dims=vec2i(textureDimensions(src));let dst=max(vec2i(1),dims/2);let begin=vec2i(floor(floor(v.pos.xy)*vec2f(dims)/vec2f(dst)));let end=vec2i(ceil((floor(v.pos.xy)+1.0)*vec2f(dims)/vec2f(dst)));var d=1e20;for(var y=0;y<3;y++){for(var x=0;x<3;x++){let p=begin+vec2i(x,y);if(all(p<end)){d=min(d,textureLoad(src,min(p,dims-1),0).r);}}}return d;}
`;
export class SceneAuxGPU{
 constructor(renderer){this.r=renderer;this.d=renderer.device;this.ready=false;this.targets=[];}
 async init(){
 const d=this.d,r=this.r,layout=d.createPipelineLayout({bindGroupLayouts:[r.sceneLayout,r.stateLayout]});
 for(const [key,code,entry,stride,attributes] of [
 ['liquid',AUX_LIQUID,'liquidVertex',20,[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x2'}]],
 ['mesh',AUX_MESH,'meshVertex',36,[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x2'},{shaderLocation:3,offset:32,format:'float32'}]]]){
 d.pushErrorScope('validation');let error;try{const module=await checkedModule(d,code,`SceneAux ${key}`);this[key]=await d.createRenderPipelineAsync({label:`SceneAux ${key}`,layout,vertex:{module,entryPoint:entry,buffers:[{arrayStride:stride,attributes}]},fragment:{module,entryPoint:'auxFragment',targets:[{format:'r32float'},{format:'rgba16float'}]},primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});}catch(e){error=e;}const scoped=await d.popErrorScope();if(error||scoped){if(key==='liquid')throw error||new Error(scoped.message);r.onError(`SceneAux mesh disabled: ${(error||scoped).message}`);}
 }
 try{const l=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'unfilterable-float'}}]});this.reduce=await safePipeline(d,'linear depth minimum pyramid',DEPTH_REDUCE,'main',['r32float'],d.createPipelineLayout({bindGroupLayouts:[l]}));}catch(e){r.onError(`Depth pyramid disabled; full-resolution depth retained: ${e.message}`);}
 this.ready=true;
 }
 ensure(w,h,s){const mips=Math.min(s.depthPyramidLevels,Math.floor(Math.log2(Math.max(w,h)))+1),sig=`${w}:${h}:${mips}`;if(this.signature===sig)return;this.disposeTargets();this.signature=sig;this.width=w;this.height=h;this.mipCount=mips;
 this.depth=texture(this.d,'SceneAux linear ray depth',w,h,'r32float');this.surface=texture(this.d,'SceneAux world normal + energy',w,h);this.z=texture(this.d,'SceneAux single-sample z',w,h,'depth24plus');this.targets=[this.depth,this.surface,this.z];
 this.pyramid=this.d.createTexture({label:'linear min-depth pyramid',size:[w,h],format:'r32float',mipLevelCount:mips,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST});this.targets.push(this.pyramid);
 this.reductions=[];if(this.reduce)for(let i=1;i<mips;i++){const view=this.pyramid.createView({baseMipLevel:i-1,mipLevelCount:1}),out=this.pyramid.createView({baseMipLevel:i,mipLevelCount:1});this.reductions.push({out,group:this.d.createBindGroup({layout:this.reduce.getBindGroupLayout(0),entries:[{binding:0,resource:view}]})});}
 }
 encode(encoder,s,timing){const r=this.r,far=Math.max(4000,s.drawDistance*1.8),desc={label:'SceneAux',colorAttachments:[{view:this.depth.createView(),loadOp:'clear',storeOp:'store',clearValue:{r:far,g:0,b:0,a:0}},{view:this.surface.createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}],depthStencilAttachment:{view:this.z.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}};const tw=timing('SceneAux');if(tw)desc.timestampWrites=tw;const p=encoder.beginRenderPass(desc);const kind=s.sceneMode==='liquid'?'liquid':'mesh',mesh=s.sceneMode==='liquid'?r.plane:s.sceneMode==='planet'?r.projectedSphere:r.customMesh;
 if(s.sceneMode!=='field'&&this[kind]&&mesh){p.setPipeline(this[kind]);p.setBindGroup(0,r.sceneGroup);p.setBindGroup(1,r.oceanGroup);p.setVertexBuffer(0,mesh.vertex);p.setIndexBuffer(mesh.index,'uint32');p.drawIndexed(mesh.count);}p.end();
 }
 encodePyramid(encoder,timing,enabled){encoder.copyTextureToTexture({texture:this.depth},{texture:this.pyramid},[this.width,this.height]);if(!enabled||!this.reduce)return;for(const q of this.reductions)renderPass(encoder,this.reduce,q.group,[q.out],'Depth Pyramid',timing);}
 disposeTargets(){this.r.retire(this.targets);this.targets=[];this.signature=null;}
 dispose(){this.disposeTargets();this.ready=false;}
}
