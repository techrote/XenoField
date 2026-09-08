import {checkedModule} from '../ocean.js';
export async function safePipeline(device,label,code,entry='main',targets=['rgba16float'],layout='auto',compute=false){
 device.pushErrorScope('validation');let result,error;
 try{if(typeof layout==='function')layout=layout();const module=await checkedModule(device,code,label);result=compute?await device.createComputePipelineAsync({label,layout,compute:{module,entryPoint:entry}}):await device.createRenderPipelineAsync({label,layout,vertex:{module,entryPoint:'quad'},fragment:{module,entryPoint:entry,targets:targets.map(format=>({format}))},primitive:{topology:'triangle-list'}});}catch(e){error=e;}
 const scoped=await device.popErrorScope();if(error||scoped)throw error||new Error(`${label}: ${scoped.message}`);return result;
}
export function texture(d,label,w,h,format='rgba16float',extra=0){return d.createTexture({label,size:[w,h],format,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST|extra});}
export function renderPass(encoder,pipeline,group,targets,label,timing,clear){
 const desc={label,colorAttachments:targets.map(t=>({view:t.createView?t.createView():t,loadOp:'clear',storeOp:'store',clearValue:clear||{r:0,g:0,b:0,a:0}}))};const tw=timing?.(label);if(tw)desc.timestampWrites=tw;
 const p=encoder.beginRenderPass(desc);p.setPipeline(pipeline);p.setBindGroup(0,group);p.draw(3);p.end();
}
export function computePass(encoder,pipeline,group,dimension,label,timing){const desc={label};const tw=timing?.(label);if(tw)desc.timestampWrites=tw;const p=encoder.beginComputePass(desc);p.setPipeline(pipeline);p.setBindGroup(0,group);p.dispatchWorkgroups(Math.ceil(dimension/4),Math.ceil(dimension/4),Math.ceil(dimension/4));p.end();}
