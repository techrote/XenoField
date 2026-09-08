/** Test-only GPU texture readbacks. Production rendering never imports this module. */
import fs from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export async function readTexture(device,texture,mipLevel=0){
 const width=Math.max(1,texture.width>>mipLevel),height=Math.max(1,texture.height>>mipLevel),depth=texture.dimension==='3d'?Math.max(1,texture.depthOrArrayLayers>>mipLevel):1;
 const format=texture.format,channels=format==='r32float'?1:4,bytesPerPixel=format==='rgba16float'?8:4;
 if(!['rgba16float','r32float','rgba8unorm','bgra8unorm'].includes(format))throw new Error(`Unsupported test readback format: ${format}`);
 const bytesPerRow=Math.ceil(width*bytesPerPixel/256)*256,size=bytesPerRow*height*depth;
 const buffer=device.createBuffer({label:'TEST ONLY texture readback',size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{
  const encoder=device.createCommandEncoder({label:'TEST ONLY readback'});encoder.copyTextureToBuffer({texture,mipLevel},{buffer,bytesPerRow,rowsPerImage:height},[width,height,depth]);device.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);
  const mapped=buffer.getMappedRange(),data=new DataView(mapped),values=new Float32Array(width*height*depth*channels);let at=0;
  for(let z=0;z<depth;z++)for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<channels;c++){
   const offset=((z*height+y)*bytesPerRow+x*bytesPerPixel);
   if(format==='rgba16float'){const v=data.getUint16(offset+c*2,true),exponent=(v>>10)&31,mantissa=v&1023;values[at++]=(v&32768?-1:1)*(exponent===31?(mantissa?NaN:Infinity):exponent?2**(exponent-15)*(1+mantissa/1024):2**-14*mantissa/1024);}
   else if(format==='r32float')values[at++]=data.getFloat32(offset,true);
   else values[at++]=data.getUint8(offset+(format==='bgra8unorm'&&c<3?2-c:c))/255;
  }
  return {width,height,depth,channels,format,values};
 }finally{try{buffer.unmap();}catch{}buffer.destroy();}
}
export function statistics(image){
 const {values,channels}=image,mean=new Array(channels).fill(0),min=new Array(channels).fill(Infinity),max=new Array(channels).fill(-Infinity);let nonfinite=0,nonzero=0;
 for(let i=0;i<values.length;i++){const v=values[i],c=i%channels;if(!Number.isFinite(v)){nonfinite++;continue;}mean[c]+=v;min[c]=Math.min(min[c],v);max[c]=Math.max(max[c],v);if(v!==0)nonzero++;}
 const pixels=values.length/channels;for(let c=0;c<channels;c++)mean[c]/=pixels;
 return {size:[image.width,image.height,image.depth],format:image.format,mean,min,max,nonfinite,nonzero,sha256:createHash('sha256').update(new Uint8Array(values.buffer)).digest('hex')};
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type),result=Buffer.alloc(12+data.length);result.writeUInt32BE(data.length,0);tag.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc32(Buffer.concat([tag,data])),8+data.length);return result;}
export async function writePresentationPNG(file,image){
 if(image.channels!==4||image.depth!==1)throw new Error('PNG requires a 2D four-channel image.');
 const {width,height,values}=image,raw=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++){const offset=y*(width*4+1);for(let x=0;x<width*4;x++)raw[offset+1+x]=Math.round(Math.min(1,Math.max(0,values[y*width*4+x]))*255);}
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 await fs.writeFile(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
