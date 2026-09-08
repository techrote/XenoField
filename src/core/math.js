export const TAU=Math.PI*2;
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function normal(a){const n=Math.hypot(...a)||1;return a.map(v=>v/n);}
export function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
export function cameraMatrix(position,forward,aspect,near=.1,far=4000,fov=.92){const right=normal(cross(forward,[0,1,0])),up=normal(cross(right,forward));const [r,u,f]=[right,up,forward];const view=new Float32Array([r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-dot(r,position),-dot(u,position),dot(f,position),1]);const t=1/Math.tan(fov/2),projection=new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,far/(near-far),-1,0,0,near*far/(near-far),0]);return {matrix:multiply(projection,view),right,up,forward,tan:1/t};}
export function makeGrid(n){
 if(!Number.isInteger(n)||n<64||n>640)throw new Error('Unsafe mesh resolution.');const data=new Float32Array(n*n*5),indices=new Uint32Array((n-1)*(n-1)*6);let p=0,q=0;
 const shape=t=>Math.sign(t)*Math.pow(Math.abs(t),1.7);
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const u=x/(n-1),v=z/(n-1);data.set([shape(u*2-1),0,shape(v*2-1),u,v],p);p+=5;}
 for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){const a=z*n+x,b=a+1,c=a+n,d=c+1;indices.set([a,c,b,b,c,d],q);q+=6;}
 return {data,indices,vertices:n*n,triangles:indices.length/3};
}
export function makeSphere(n=192){const w=n,h=Math.floor(n/2),data=new Float32Array((w+1)*(h+1)*5),indices=new Uint32Array(w*h*6);let p=0,q=0;for(let y=0;y<=h;y++)for(let x=0;x<=w;x++){const u=x/w,v=y/h,a=u*TAU,b=v*Math.PI;data.set([Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a),u,v],p);p+=5;}for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=y*(w+1)+x,b=a+1,c=a+w+1,d=c+1;indices.set([a,b,c,b,d,c],q);q+=6;}return {data,indices,vertices:(w+1)*(h+1),triangles:indices.length/3};}
