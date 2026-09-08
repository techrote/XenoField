import {srgbToLinear} from '../core/lut.js';
import {EnvironmentProcessor} from './processor.js';
import {resizeLinear,mipChain} from './pattern.js';
import {decodeHDR} from './hdr.js';
import {decodeEXRLocal} from './exr.js';
/** One outstanding SkySynth request, no hidden frame queue. HDRI imports bypass
 * that animation queue so a file load cannot be starved by continuous synth frames. */
export class EnvironmentBridge{
 constructor(onImage,onError){this.onImage=onImage;this.onError=onError;this.busy=false;this.nextId=0;this.revision=0;this.lastAt=0;this.pending=null;this.disposed=false;this.frames=0;this.reset=true;this.preview=null;this.fallback=null;this.importing=false;
  try{const standaloneURL=globalThis.__XENOFIELD_WORKER_URL__;this.worker=standaloneURL?new Worker(standaloneURL):new Worker(new URL('./worker.js',import.meta.url),{type:'module'});this.worker.onmessage=e=>this.receive(e.data);this.worker.onerror=()=>this.useFallback();}catch{this.useFallback();}
 }
 receive(m){if(this.disposed)return;this.busy=false;if(m.error){this.onError(m.error);return;}if(m.revision!==this.revision)return;this.frames++;this.metrics={...m.metrics,backend:this.fallback?'main-thread fallback (15 Hz cap)':'Web Worker'};this.preview=m;this.onImage(m);}
 useFallback(){if(this.fallback)return;this.worker?.terminate();this.worker=null;this.busy=false;this.fallback=new EnvironmentProcessor();this.onError('Workers are unavailable here. Using a bounded 128×64 / 15 Hz environment fallback.');}
 invalidate(reset=false){this.revision++;this.lastAt=0;if(reset)this.reset=true;}
 tick(now,settings,palette){if(this.disposed||this.busy||this.importing)return;if(this.pending){const request=this.pending;this.pending=null;this.send(request);return;}if((settings.envMode!=='plasma'&&!settings.mixerEnabled)||(settings.paused&&!this.reset&&this.lastAt!==0))return;
  const rate=this.fallback?Math.min(15,settings.generatorFPS):settings.generatorFPS,elapsed=this.lastAt?(now-this.lastAt)/1000:1/rate;if(this.lastAt&&elapsed<1/rate)return;this.send({type:'frame',settings:{...settings,sourceWidth:this.fallback?Math.min(128,settings.sourceWidth):settings.sourceWidth},palette,dt:settings.paused?0:elapsed,reset:this.reset});this.reset=false;this.lastAt=now;
 }
 send(message){this.busy=true;message.id=++this.nextId;message.revision=this.revision;if(this.fallback){setTimeout(()=>{if(!this.disposed)this.receive(this.fallback.process(message));},0);}else this.worker.postMessage(message,message.buffer?[message.buffer]:[]);}
 makeFrame(image,metrics={},type='image'){const levels=mipChain(image.data,image.width,image.height),previewWidth=Math.min(256,image.width),previewHeight=Math.max(1,Math.round(previewWidth*image.height/image.width)),preview=resizeLinear(image.data,image.width,image.height,previewWidth,previewHeight);return {id:++this.nextId,type,revision:this.revision,levels,preview,previewWidth,previewHeight,metrics:{originalWidth:metrics.originalWidth||image.width,originalHeight:metrics.originalHeight||image.height,peak:metrics.peak,sourceType:metrics.sourceType||type,decoder:metrics.decoder||'local'}};}
 scaleImage(image,capW=2048,capH=1024){const scale=Math.min(1,capW/image.width,capH/image.height);if(scale>=1)return image;const width=Math.max(2,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));return {data:resizeLinear(image.data,image.width,image.height,width,height),width,height,peak:image.peak};}
 publishImported(frame){if(this.disposed)return false;this.frames++;this.metrics={...frame.metrics,backend:'local HDRI decoder'};this.preview=frame;this.onImage(frame);return true;}
 async decodeExr(buffer){try{return {...await decodeEXRLocal(buffer),decoder:'local EXR (NONE/RLE/ZIP/ZIPS)'};}catch(localError){
   // Extended fallback covers PIZ/PXR24 when a network is available, but the common
   // scanline formats above are fully local and work in the standalone file.
   if(!/requires the extended decoder|compression/i.test(String(localError?.message||localError)))throw localError;
   try{const {readExr}=await import('https://esm.sh/hdrify@0.12.1?bundle');const image=readExr(new Uint8Array(buffer));return {data:image.data,width:image.width,height:image.height,peak:undefined,decoder:'hdrify extended EXR fallback'};}catch(netError){throw new Error(`${localError.message} Extended PIZ/PXR24 fallback could not load: ${netError?.message||netError}`);}
  }}
 async importFile(file){
  if(!file||file.size>Math.floor(2.6*1024*1024*1024))throw new Error('Choose an HDRI / EXR no larger than 2.6 GiB. Very large files still require sufficient browser address space and RAM to read and decompress.');this.importing=true;const token=++this.revision;this.lastAt=0;this.assetName=file.name;
  try{let image,sourceType='image',decoder='browser image decoder',originalWidth=0,originalHeight=0,peak;
   if(/\.exr$/i.test(file.name)){const buffer=await file.arrayBuffer();if(token!==this.revision)return false;const decoded=await this.decodeExr(buffer);image=decoded;sourceType='exr';decoder=decoded.decoder;peak=decoded.peak;originalWidth=decoded.originalWidth||decoded.width;originalHeight=decoded.originalHeight||decoded.height;}
   else if(/\.(hdr|rgbe)$/i.test(file.name)){const buffer=await file.arrayBuffer();if(token!==this.revision)return false;const decoded=decodeHDR(buffer);image=decoded;sourceType='hdr';decoder='local Radiance RGBE';peak=decoded.peak;originalWidth=decoded.width;originalHeight=decoded.height;}
   else if(/\.(png|jpe?g|webp)$/i.test(file.name)){const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>33554432)throw new Error('Image exceeds the 32-megapixel decode cap.');originalWidth=bitmap.width;originalHeight=bitmap.height;const scale=Math.min(1,2048/bitmap.width,1024/bitmap.height),width=Math.max(2,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale)),canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,width,height);const rgba=ctx.getImageData(0,0,width,height).data,out=new Float32Array(rgba.length);for(let i=0;i<rgba.length;i+=4){for(let c=0;c<3;c++)out[i+c]=srgbToLinear(rgba[i+c]/255);out[i+3]=rgba[i+3]/255;}image={data:out,width,height};}finally{bitmap.close();}}
   else throw new Error('Choose .exr, .hdr/.rgbe, or a PNG/JPEG/WebP equirectangular panorama.');if(token!==this.revision)return false;
   image=this.scaleImage(image);if(!Number.isFinite(peak)){peak=0;for(let i=0;i<image.data.length;i+=4)peak=Math.max(peak,image.data[i],image.data[i+1],image.data[i+2]);}
   const frame=this.makeFrame(image,{originalWidth,originalHeight,peak,sourceType,decoder},sourceType);if(token!==this.revision)return false;return this.publishImported(frame);
  }finally{this.importing=false;}
 }
 dispose(){this.disposed=true;this.worker?.terminate();this.pending=null;}
}
