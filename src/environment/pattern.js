import {clamp,PARAMETERS} from '../core/parameters.js';
const TAU=Math.PI*2;
const fract=x=>x-Math.floor(x);
function noise1(t){const n=Math.floor(t),f=fract(t),s=f*f*(3-2*f);const h=k=>fract(Math.sin(k*127.1+71.7)*43758.5453)*2-1;return h(n)+(h(n+1)-h(n))*s;}
export function waveValue(wave,phase){switch(wave){case 'smooth-triangle':{const t=1-4*Math.abs(fract(phase)-.5);return t*(1.5-.5*t*t);}case 'loop-noise':return .64*Math.sin(TAU*phase)+.25*Math.sin(TAU*phase*2+1.7)+.11*Math.sin(TAU*phase*3+.8);case 'wander-noise':return noise1(phase)*.75+noise1(phase*.37+12)*.25;default:return Math.sin(TAU*phase);}}
export function modulatedSettings(base,phase){
 const out={...base}; if(!base.modEnabled)return {settings:out,output:0};
 const wave=waveValue(base.modWave,phase),width=base.modWidthMin+(wave+1)*.5*(base.modWidthMax-base.modWidthMin);
 const value=base.modOffset+base.modAmplitude*width/100;
 const steps={freqY:.0015,freqX:.0015,speed:.02,hueShift:.0025,radius:.0025};
 for(const key of base.modTargets){const spec=PARAMETERS[key];out[key]=clamp(base[key]+steps[key]*value,spec.hardMin,spec.hardMax);}
 return {settings:out,output:value};
}
/** Planar mathematical reference: PlasmaTerm's four-wave interference, on a fixed 36×24 domain. */
export function planarField(x,y,t,s){return (Math.sin(x*s.freqX+t)+Math.sin(y*s.freqY-t*1.2)+Math.sin((x+y)*s.diagonal+t*.6)+Math.sin(Math.hypot(x-18,y-12)*s.radius-t))*.25;}
/** Spherical adaptation: periodic longitude, identical samples at either pole. */
export function sphereField(u,v,t,s){
 const lon=TAU*u,lat=Math.PI*v,sp=Math.sin(lat),x=18+18*sp*Math.cos(lon),y=12+12*Math.cos(lat),z=sp*Math.sin(lon);
 const warp=s.warp*Math.sin(z*4+t*.17);
 return planarField(x+warp*3,y+warp*2,t+z*.35,s);
}
export function generateLinearFrame(width,height,t,huePhase,s,lut){
 const out=new Float32Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const v=sphereField((x+.5)/width,(y+.5)/height,t,s);
  const field=.5+.5*Math.tanh(v*s.fieldContrast),idx=fract(field+huePhase)*256,j=Math.floor(idx),f=idx-j;
  const bright=.3+Math.pow(clamp(field,0,1),2)*.7,energy=s.radiance*bright,o=(y*width+x)*4;
  for(let c=0;c<3;c++)out[o+c]=(lut[j*3+c]*(1-f)+lut[((j+1)%256)*3+c]*f)*energy;
  out[o+3]=1;
 }
 return out;
}
/** Periodic X and pole-reflecting Y, with a half-turn at the pole. */
function offset(x,y,w,h){if(y<0){y=-y-1;x+=w/2;}else if(y>=h){y=2*h-y-1;x+=w/2;}return ((Math.max(0,Math.min(h-1,y))*w+(Math.round(x)%w+w)%w)*4);}
export function smoothFrame(data,w,h,amount){
 if(amount<=0)return data;const a=new Float32Array(data.length),b=new Float32Array(data.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<4;c++){const i=(y*w+x)*4+c;a[i]=data[i]*(1-amount*.5)+(data[offset(x-1,y,w,h)+c]+data[offset(x+1,y,w,h)+c])*amount*.25;}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<4;c++){const i=(y*w+x)*4+c;b[i]=a[i]*(1-amount*.5)+(a[offset(x,y-1,w,h)+c]+a[offset(x,y+1,w,h)+c])*amount*.25;}
 return b;
}
export function temporalBlend(current,previous,dt,tau){if(!previous||previous.length!==current.length||tau<=0)return current;const a=1-Math.exp(-clamp(dt,0,1)/Math.max(tau,.001));for(let i=0;i<current.length;i++)current[i]=previous[i]+(current[i]-previous[i])*a;return current;}
export function downsample(data,w,h){const nw=Math.max(1,w>>1),nh=Math.max(1,h>>1),out=new Float32Array(nw*nh*4);for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){const x0=Math.floor(x*w/nw),x1=Math.max(x0+1,Math.floor((x+1)*w/nw)),y0=Math.floor(y*h/nh),y1=Math.max(y0+1,Math.floor((y+1)*h/nh));for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++)for(let c=0;c<4;c++)out[(y*nw+x)*4+c]+=data[(yy*w+xx)*4+c]/((x1-x0)*(y1-y0));}return {data:out,width:nw,height:nh};}
const f32=new Float32Array(1),u32=new Uint32Array(f32.buffer);
export function halfFloat(value){
 f32[0]=Math.max(-65504,Math.min(65504,Number.isFinite(value)?value:0));const x=u32[0],sign=(x>>>16)&0x8000,e=((x>>>23)&255)-127+15,m=x&0x7FFFFF;
 if(e<=0){if(e<-10)return sign;return sign|(((m|0x800000)>>(1-e))+0x1000>>13);}
 if(e>=31)return sign|0x7BFF;return sign|((e<<10)+(m+0x1000>>13));
}
export function mipChain(data,width,height){const levels=[];while(true){const half=new Uint16Array(data.length);for(let i=0;i<data.length;i++)half[i]=halfFloat(data[i]);levels.push({data:half,width,height});if(width===1&&height===1)break;({data,width,height}=downsample(data,width,height));}return levels;}
export function resizeNearest(data,w,h,nw,nh){const out=new Float32Array(nw*nh*4);for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){const sx=Math.round((x+.5)*w/nw-.5),sy=Math.round((y+.5)*h/nh-.5),i=(y*nw+x)*4,j=offset(sx,sy,w,h);for(let c=0;c<4;c++)out[i+c]=data[j+c];}return out;}
export function resizeLinear(data,w,h,nw,nh){const out=new Float32Array(nw*nh*4);for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){const sx=(x+.5)*w/nw-.5,sy=(y+.5)*h/nh-.5,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;for(let c=0;c<4;c++)out[(y*nw+x)*4+c]=(data[offset(ix,iy,w,h)+c]*(1-fx)+data[offset(ix+1,iy,w,h)+c]*fx)*(1-fy)+(data[offset(ix,iy+1,w,h)+c]*(1-fx)+data[offset(ix+1,iy+1,w,h)+c]*fx)*fy;}return out;}
function cubic(p0,p1,p2,p3,t,a=-0.5){const t2=t*t,t3=t2*t;return ((-a*p0+(2-a)*p1+(a-2)*p2+a*p3)*t3 + (2*a*p0+(a-3)*p1+(3-2*a)*p2-a*p3)*t2 + (-a*p0+a*p2)*t + p1);} 
function sampleCubic(data,w,h,sx,sy,a=-0.5){const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,out=[0,0,0,0];for(let m=-1;m<=2;m++){const row=[0,0,0,0];for(let c=0;c<4;c++)row[c]=cubic(data[offset(ix-1,iy+m,w,h)+c],data[offset(ix,iy+m,w,h)+c],data[offset(ix+1,iy+m,w,h)+c],data[offset(ix+2,iy+m,w,h)+c],fx,a);for(let c=0;c<4;c++)out[c]=(m===-1?row[c]:cubic(out[c],out[c],row[c],row[c],0,0));}
 const rows=new Array(4).fill(null).map(()=>[0,0,0,0]);for(let m=-1;m<=2;m++)for(let c=0;c<4;c++)rows[m+1][c]=cubic(data[offset(ix-1,iy+m,w,h)+c],data[offset(ix,iy+m,w,h)+c],data[offset(ix+1,iy+m,w,h)+c],data[offset(ix+2,iy+m,w,h)+c],fx,a);
 return rows[0].map((_,c)=>cubic(rows[0][c],rows[1][c],rows[2][c],rows[3][c],fy,a));}
export function resizeCubic(data,w,h,nw,nh,a=-0.5){const out=new Float32Array(nw*nh*4);for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){const sx=(x+.5)*w/nw-.5,sy=(y+.5)*h/nh-.5,s=sampleCubic(data,w,h,sx,sy,a),i=(y*nw+x)*4;for(let c=0;c<4;c++)out[i+c]=s[c];}return out;}
const sinc=x=>x===0?1:Math.sin(Math.PI*x)/(Math.PI*x);
function lanczosKernel(x,a=2){x=Math.abs(x);return x<a?sinc(x)*sinc(x/a):0;}
export function resizeLanczos2(data,w,h,nw,nh){const out=new Float32Array(nw*nh*4);for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){
 const sx=(x+.5)*w/nw-.5,sy=(y+.5)*h/nh-.5,ix=Math.floor(sx),iy=Math.floor(sy),i=(y*nw+x)*4;let total=0;const acc=[0,0,0,0];
 for(let yy=iy-1;yy<=iy+2;yy++)for(let xx=ix-1;xx<=ix+2;xx++){const wx=lanczosKernel(sx-xx,2),wy=lanczosKernel(sy-yy,2),ww=wx*wy,j=offset(xx,yy,w,h);total+=ww;for(let c=0;c<4;c++)acc[c]+=data[j+c]*ww;}
 const scale=Math.abs(total)>1e-9?1/total:1;for(let c=0;c<4;c++)out[i+c]=acc[c]*scale;
 }
 return out;
}
export function resizeSmooth(data,w,h,nw,nh){return smoothFrame(resizeLinear(data,w,h,nw,nh),nw,nh,.35);}
export function resizeWithMode(data,w,h,nw,nh,mode='linear'){
 if(nw===w&&nh===h)return data;
 switch(mode){
  case 'nearest': return resizeNearest(data,w,h,nw,nh);
  case 'smooth': return resizeSmooth(data,w,h,nw,nh);
  case 'bicubic': return resizeCubic(data,w,h,nw,nh,0.0);
  case 'catmull-rom': return resizeCubic(data,w,h,nw,nh,-0.5);
  case 'lanczos2': return resizeLanczos2(data,w,h,nw,nh);
  default: return resizeLinear(data,w,h,nw,nh);
 }
}
export function nlFilter(data,w,h,radius=1,strength=.2){
 const r=Math.max(0,Math.floor(radius));if(r<=0||strength<=0)return data;const out=new Float32Array(data.length),sigma=Math.max(.03,.15+.55*(1-strength));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,cr=data[i],cg=data[i+1],cb=data[i+2];let wr=0,rr=0,gg=0,bb=0,aa=0;
  for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++){
   const j=offset(x+xx,y+yy,w,h),dr=data[j]-cr,dg=data[j+1]-cg,db=data[j+2]-cb,dist=(xx*xx+yy*yy)/(r*r+1),cd=(dr*dr+dg*dg+db*db)/(sigma*sigma*3),weight=Math.exp(-(dist*1.35+cd));
   wr+=weight;rr+=data[j]*weight;gg+=data[j+1]*weight;bb+=data[j+2]*weight;aa+=data[j+3]*weight;
  }
  const blend=clamp(strength,0,1.5),inv=1/Math.max(wr,1e-6);out[i]=cr+(rr*inv-cr)*blend;out[i+1]=cg+(gg*inv-cg)*blend;out[i+2]=cb+(bb*inv-cb)*blend;out[i+3]=data[i+3]+(aa*inv-data[i+3])*blend;
 }
 return out;
}
export function pipelineResize(data,w,h,targetW,targetH,settings={}){
 const stageA=settings.upsampling||'bicubic',stageB=settings.upsamplingStageB||'none',filterStage=settings.processingStage||'none';
 const filterStrength=settings.nlFilterStrength||0,filterRadius=settings.nlFilterRadius||0;
 let image=data,width=w,height=h;
 const applyFilter=()=>{image=nlFilter(image,width,height,filterRadius,filterStrength);};
 if(filterStage==='pre')applyFilter();
 if(width!==targetW||height!==targetH){
  if(stageB==='none'){
   image=resizeWithMode(image,width,height,targetW,targetH,stageA);width=targetW;height=targetH;
  }else{
   let midW=Math.round(Math.sqrt(width*targetW));midW=Math.max(width+((width^midW)&1?1:0),Math.min(targetW,midW));if(midW%2)midW++;
   let midH=Math.max(1,Math.round(midW*height/width));
   image=resizeWithMode(image,width,height,midW,midH,stageA);width=midW;height=midH;
   if(filterStage==='mid')applyFilter();
   image=resizeWithMode(image,width,height,targetW,targetH,stageB);width=targetW;height=targetH;
  }
 }
 if(filterStage==='mid'&&stageB==='none')applyFilter();
 if(filterStage==='post')applyFilter();
 return {data:image,width,height};
}
