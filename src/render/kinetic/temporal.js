import {COMMON} from './common.js';
import {texture,safePipeline,renderPass} from './gpu-utils.js';
export const TEMPORAL_RESOLVE=COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{let uv=v.uv;let current=tap(image,uv);let d=depthAt(uv);let prev=previousUV(uv,d);var confidence=historyConfidence(prev.xy,prev.z);let old=tap(historyTex,prev.xy);let l0=luminance(current.rgb);let l1=luminance(old.rgb);confidence*=exp(-min(40.0,abs(l0-l1)/max(.1,max(l0,l1))*k.p[14].z));
 let px=1.0/vec2f(textureDimensions(image));var lo=current;var hi=current;for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){let c=tap(image,uv+vec2f(f32(x),f32(y))*px);lo=min(lo,c);hi=max(hi,c);}}let history=mix(old,clamp(old,lo,hi),k.p[14].w);let age=min(k.p[15].x,max(1.0,k.p[15].z));let w=min(min(k.p[14].x,1.0-1.0/age),1.0-k.p[15].y)*confidence;return bounded(mix(current,history,w));}
`;
export const FEEDBACK=COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{let uv=v.uv;let dt=k.p[9].w;let zoom=pow(max(.1,k.p[37].x),dt);let a=k.p[37].y*dt;let c=cos(a);let si=sin(a);let q=(uv-.5)/zoom;var oldUV=vec2f(q.x*c-q.y*si,q.x*si+q.y*c)+.5-k.p[37].zw*dt;oldUV+=sin(oldUV.yx*17.0+k.p[4].w)*k.p[38].x*dt;
 var valid=k.p[8].w;if(any(oldUV<vec2f(0.0))||any(oldUV>vec2f(1.0))){valid=0.0;}if(k.p[38].y>.5){valid*=historyConfidence(oldUV,depthAt(uv));}
 let cur=tap(image,uv).rgb;let input=cur*gate(luminance(cur),k.p[46].z,.05);let old=hue(tap(feedbackTex,oldUV).rgb,k.p[36].w*dt)*pow(k.p[36].y,dt*60.0)*pow(max(.001,k.p[36].z),dt*60.0);let m=sat(k.p[53].x*effectMask(k.p[38].w,uv))*valid;return bounded(vec4f(mix(input,blend(input,old,k.p[38].z),m),1.0));}
`;
export const FEEDBACK_COMPOSITE=COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{let c=tap(image,v.uv).rgb;return bounded(vec4f(mix(c,tap(feedbackTex,v.uv).rgb,sat(k.p[36].x*effectMask(k.p[38].w,v.uv))),1.0));}
`;
export class TemporalFieldGPU{
 constructor(graph){this.g=graph;this.d=graph.d;this.tracks=new Map();this.resetCount=0;this.lastReset='initial';}
 async init(){const layout=this.d.createPipelineLayout({bindGroupLayouts:[this.g.layout]});this.resolvePipeline=await safePipeline(this.d,'Temporal conservative',TEMPORAL_RESOLVE,'main',['rgba16float'],layout);this.feedbackPipeline=await safePipeline(this.d,'Feedback independent',FEEDBACK,'main',['rgba16float'],layout);this.feedbackComposite=await safePipeline(this.d,'Feedback composite',FEEDBACK_COMPOSITE,'main',['rgba16float'],layout);this.ready=true;}
 track(name,w,h){let t=this.tracks.get(name);if(t?.width===w&&t?.height===h)return t;if(t)this.release(name);t={width:w,height:h,index:0,valid:false,age:0,buffers:[texture(this.d,`${name} history A`,w,h),texture(this.d,`${name} history B`,w,h)],depth:texture(this.d,`${name} previous depth`,w,h,'r32float'),uniform:this.d.createBuffer({label:`${name} independent history controls`,size:1024,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})};this.tracks.set(name,t);return t;}
 reset(name,reason='settings discontinuity'){if(name){const t=this.tracks.get(name);if(t){t.valid=false;t.age=0;}}else for(const t of this.tracks.values()){t.valid=false;t.age=0;}this.resetCount++;this.lastReset=reason;}
 resolve(encoder,name,current,depth,w,h,resources,s,timing){const t=this.track(name,w,h),uniform=new Float32Array(this.g.params);uniform[8*4+3]=t.valid?1:0;uniform[15*4+2]=++t.age;if(name==='volume'){uniform[14*4]=s.volumeTemporalWeight;uniform[15*4]=32;uniform[15*4+1]=.02;}this.d.queue.writeBuffer(t.uniform,0,uniform);const next=1-t.index;
 const group=this.g.group({...resources,image:current,depth,history:t.buffers[t.index],historyDepth:t.depth,buffer:t.uniform});renderPass(encoder,this.resolvePipeline,group,[t.buffers[next]],'Temporal',timing);encoder.copyTextureToTexture({texture:depth},{texture:t.depth},[w,h]);t.index=next;t.valid=true;return t.buffers[next];}
 feedback(encoder,current,depth,w,h,resources,s,timing){const width=Math.max(1,Math.ceil(w/+s.feedbackResolution)),height=Math.max(1,Math.ceil(h/+s.feedbackResolution)),t=this.track('feedback',width,height),uniform=new Float32Array(this.g.params);uniform[8*4+3]=t.valid?1:0;this.d.queue.writeBuffer(t.uniform,0,uniform);
 // Feedback depth is full-resolution and independent of low-resolution colour history.
 if(!t.fullDepth||t.fullDepth.width!==w||t.fullDepth.height!==h){if(t.fullDepth)this.g.r.retire([t.fullDepth]);t.fullDepth=texture(this.d,'feedback previous full depth',w,h,'r32float');t.valid=false;uniform[8*4+3]=0;this.d.queue.writeBuffer(t.uniform,0,uniform);}
 if(s.paused&&t.valid)return t.buffers[t.index];
 const next=1-t.index,group=this.g.group({...resources,image:current,feedback:t.buffers[t.index],historyDepth:t.fullDepth,buffer:t.uniform});renderPass(encoder,this.feedbackPipeline,group,[t.buffers[next]],'Feedback',timing);encoder.copyTextureToTexture({texture:depth},{texture:t.fullDepth},[w,h]);t.index=next;t.valid=true;t.age++;return t.buffers[next];}
 current(name){const t=this.tracks.get(name);return t?.valid?t.buffers[t.index]:null;}
 release(name){const t=this.tracks.get(name);if(!t)return;this.g.r.retire([...t.buffers,t.depth,t.fullDepth,t.uniform]);this.tracks.delete(name);}
 dispose(){for(const name of this.tracks.keys())this.release(name);this.ready=false;}
}
