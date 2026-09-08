/** Bounded Radiance RGBE reader. Accepts modern scanline RLE and flat/old-run RGBE. */
export function decodeHDR(buffer){
 const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
 if(bytes.byteLength>64*1024*1024)throw new Error('HDR file exceeds the 64 MiB import cap.');
 let p=0;const line=()=>{const start=p;while(p<bytes.length&&bytes[p]!==10){if(p-start>8192)throw new Error('HDR header line too long.');p++;}if(p>=bytes.length)throw new Error('Truncated HDR header.');return new TextDecoder().decode(bytes.subarray(start,p++)).replace(/\r$/,'');};
 const signature=line();if(!/^#\?(RADIANCE|RGBE)$/.test(signature))throw new Error('Not a Radiance .hdr / RGBE file.');
 let format='';for(let count=0;;count++){if(count>512)throw new Error('HDR header too large.');const s=line();if(!s.trim())break;if(s.startsWith('FORMAT='))format=s.slice(7).trim();}
 if(format!=='32-bit_rle_rgbe')throw new Error('Only RGBE Radiance HDR is supported; convert XYZE/OpenEXR to RGBE first.');
 const dimensions=line().trim().match(/^([+-])Y\s+(\d+)\s+([+-])X\s+(\d+)$/);
 if(!dimensions)throw new Error('HDR resolution must be a Y-major RGBE panorama.');
 const height=+dimensions[2],width=+dimensions[4];
 if(width<1||height<1||width>16384||height>8192||width*height>16777216)throw new Error('HDR dimensions exceed the 16-megapixel decode cap.');
 const rgbe=new Uint8Array(width*height*4);let dst=0;
 const read=()=>{if(p>=bytes.length)throw new Error('Truncated HDR pixel data.');return bytes[p++];};
 const modern=width>=8&&width<=32767&&bytes[p]===2&&bytes[p+1]===2&&(bytes[p+2]&128)===0;
 if(modern){
  const scan=new Uint8Array(width*4);
  for(let y=0;y<height;y++){
   if(read()!==2||read()!==2||((read()<<8)|read())!==width)throw new Error('Invalid HDR scanline width.');
   for(let c=0;c<4;c++){let x=0;while(x<width){const n=read();if(n===0)throw new Error('Invalid zero-length HDR run.');if(n>128){const run=n-128,v=read();if(x+run>width)throw new Error('HDR run crosses a scanline.');scan.fill(v,c*width+x,c*width+x+run);x+=run;}else{if(x+n>width)throw new Error('HDR literal crosses a scanline.');for(let k=0;k<n;k++)scan[c*width+x++]=read();}}}
   for(let x=0;x<width;x++)for(let c=0;c<4;c++)rgbe[dst++]=scan[c*width+x];
  }
 }else{
  let shift=0;while(dst<rgbe.length){const a=read(),b=read(),c=read(),d=read();if(a===1&&b===1&&c===1){if(dst===0||shift>24)throw new Error('Invalid old RGBE repeat.');const count=d*2**shift;if(count<1||dst+count*4>rgbe.length)throw new Error('RGBE repeat overflows image.');for(let i=0;i<count;i++){rgbe.set(rgbe.subarray(dst-4,dst),dst);dst+=4;}shift+=8;}else{rgbe.set([a,b,c,d],dst);dst+=4;shift=0;}}
 }
 const out=new Float32Array(width*height*4);let peak=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const source=(y*width+x)*4,tx=dimensions[3]==='+'?x:width-x-1,ty=dimensions[1]==='-'?y:height-y-1,target=(ty*width+tx)*4;
  const scale=rgbe[source+3]===0?0:2**(rgbe[source+3]-136);
  for(let c=0;c<3;c++){const v=Math.min(65504,rgbe[source+c]*scale);out[target+c]=v;peak=Math.max(peak,v);}out[target+3]=1;
 }
 return {data:out,width,height,peak};
}
