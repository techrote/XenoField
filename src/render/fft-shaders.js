// Spectral compute kernels retained from the supplied ABYSSAL V3.1g source.
export const SPECTRUM_EVOLVE_WGSL = /* wgsl */`
struct Data { values: array<vec4<f32>> };
@group(0) @binding(0) var<storage, read> spectrum: Data;
@group(0) @binding(1) var<storage, read_write> dst: Data;
@group(0) @binding(2) var<storage, read> params: Data;
fn cmul(a:vec2f,b:vec2f)->vec2f{return vec2f(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let p=params.values[0];let n=u32(p.y+.5);let id=gid.x;if(id>=n*n){return;}let x=id%n;let z=id/n;
 let sx=select(f32(x),f32(i32(x)-i32(n)),x>n/2u);let sz=select(f32(z),f32(i32(z)-i32(n)),z>n/2u);
 let k=vec2f(sx,sz)*6.28318530718/p.z;let km=length(k);if(km<.00001){dst.values[id]=vec4f(0);return;}
 let omega=sqrt(9.81*km);let ph=omega*p.x;let e=vec2f(cos(ph),sin(ph));let em=vec2f(cos(ph),-sin(ph));let h=spectrum.values[id];
 let v=(cmul(h.xy,e)+cmul(h.zw,em))*p.w;dst.values[id]=vec4f(v,0,0);
}`;

export const BIT_REVERSE_WGSL = /* wgsl */`
struct Data{values:array<vec4<f32>>};
@group(0) @binding(0) var<storage,read> src:Data;
@group(0) @binding(1) var<storage,read_write> dst:Data;
@group(0) @binding(2) var<storage,read> params:Data;
fn revbits(x0:u32,bits:u32)->u32{var x=x0;var r=0u;for(var i=0u;i<9u;i=i+1u){if(i<bits){r=(r<<1u)|(x&1u);x=x>>1u;}}return r;}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){let p=params.values[0];let n=u32(p.x+.5);let axis=u32(p.y+.5);let bits=u32(p.z+.5);let id=gid.x;if(id>=n*n){return;}let x=id%n;let z=id/n;let c=select(x,z,axis==1u);let r=revbits(c,bits);let sid=select(z*n+r,r*n+x,axis==1u);dst.values[id]=src.values[sid];}
`;

export const FFT_STAGE_WGSL = /* wgsl */`
struct Data{values:array<vec4<f32>>};
@group(0) @binding(0) var<storage,read> src:Data;
@group(0) @binding(1) var<storage,read_write> dst:Data;
@group(0) @binding(2) var<storage,read> params:Data;
fn cmul(a:vec2f,b:vec2f)->vec2f{return vec2f(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let p=params.values[0];let n=u32(p.x+.5);let axis=u32(p.y+.5);let stage=u32(p.z+.5);let id=gid.x;if(id>=n*n){return;}let x=id%n;let z=id/n;let coord=select(x,z,axis==1u);
 let m=1u<<(stage+1u);let halfSize=m>>1u;let j=coord%m;let k=j%halfSize;let base=coord-j;let ca=base+k;let cb=ca+halfSize;
 let ia=select(z*n+ca,ca*n+x,axis==1u);let ib=select(z*n+cb,cb*n+x,axis==1u);let a=src.values[ia].xy;let b=src.values[ib].xy;
 let angle=6.28318530718*f32(k)/f32(m);let w=vec2f(cos(angle),sin(angle));let wb=cmul(w,b);let out=select(a+wb,a-wb,j>=halfSize);dst.values[id]=vec4f(out,0,0);
}`;


export const OCEAN_STATE_COPY_WGSL = /* wgsl */`
struct Data{values:array<vec4<f32>>};
@group(0) @binding(0) var<storage,read> src:Data;
@group(0) @binding(1) var<storage,read_write> dst:Data;
@group(0) @binding(2) var<storage,read> params:Data;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let n=u32(params.values[0].x+.5);let id=gid.x;if(id>=n*n*2u){return;}dst.values[id]=src.values[id];
}`;

export const FINALIZE_OCEAN_WGSL = /* wgsl */`
struct Data{values:array<vec4<f32>>};
@group(0) @binding(0) var<storage,read> src:Data;
@group(0) @binding(1) var<storage,read_write> oceanState:Data;
@group(0) @binding(2) var<storage,read> params:Data;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let p=params.values[0];let fp=params.values[1];let n=u32(p.x+.5);let id=gid.x;if(id>=n*n){return;}let x=id%n;let z=id/n;let xm=(x+n-1u)%n;let xp=(x+1u)%n;let zm=(z+n-1u)%n;let zp=(z+1u)%n;let norm=1.0/(f32(n)*f32(n));
 let h=src.values[id].x*norm;let hx0=src.values[z*n+xm].x*norm;let hx1=src.values[z*n+xp].x*norm;let hz0=src.values[zm*n+x].x*norm;let hz1=src.values[zp*n+x].x*norm;let step=p.y/f32(n);
 let dx=(hx1-hx0)/(2.0*step);let dz=(hz1-hz0)/(2.0*step);let normal=normalize(vec3f(-dx,1.0,-dz));
 let horiz=vec2f(-dx,-dz)*p.z*.38;let lap=(hx1+hx0+hz1+hz0-4.0*h)/max(step*step,.0001);
 let compression=smoothstep(.024,.16,max(lap*p.z,0.0)*p.w)*.88+smoothstep(.62,1.55,h)*.10;
 let prevFoam=oceanState.values[id*2u+1u].w;let persisted=prevFoam*exp(-max(fp.x,0.0)*max(fp.y,.01));let foam=clamp(max(persisted,compression),0.0,1.0);
 oceanState.values[id*2u]=vec4f(horiz.x,h,horiz.y,smoothstep(.32,1.25,h));
 oceanState.values[id*2u+1u]=vec4f(normal,foam);
}`;

