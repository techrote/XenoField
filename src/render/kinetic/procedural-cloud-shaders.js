import {COMMON} from './common.js';

/*
  Dedicated V4.4b procedural-cloud instrument.
  Density shaping intentionally follows the stage order and parameter semantics of
  jeantimex/procedural-clouds (MIT, copyright 2026 Su): altitude mask -> macro 4D
  Voronoi -> detail 4D Voronoi -> upper cutoff -> altitude falloff. The hash/noise
  helpers are a compact WGSL re-expression suited to Xenofield's shared cache path.
*/
const CLOUD_NOISE=/*wgsl*/`
fn pcg1(v0:u32)->u32{var v=v0*747796405u+2891336453u;v=((v>>((v>>28u)+4u))^v)*277803737u;return (v>>22u)^v;}
fn h4i(p:vec4i)->u32{var h=pcg1(bitcast<u32>(p.x)+0x9e3779b9u);h=pcg1(h^bitcast<u32>(p.y));h=pcg1(h^bitcast<u32>(p.z));h=pcg1(h^bitcast<u32>(p.w));return h;}
fn hf(h:u32)->f32{return f32(h&0x00ffffffu)/16777215.0;}
fn hv4(p:vec4i)->vec4f{let h=h4i(p);return vec4f(hf(pcg1(h)),hf(pcg1(h^0x68bc21ebu)),hf(pcg1(h^0x02e5be93u)),hf(pcg1(h^0xa511e9b3u)));}
fn fade4(t:vec4f)->vec4f{return t*t*t*(t*(t*6.0-15.0)+10.0);}
fn valueNoise4(p:vec4f)->f32{let b=vec4i(floor(p));let f=fade4(fract(p));var sum=0.0;for(var w=0;w<2;w++){for(var z=0;z<2;z++){for(var y=0;y<2;y++){for(var x=0;x<2;x++){let o=vec4i(x,y,z,w);let q=vec4f(f32(x),f32(y),f32(z),f32(w));let wt=mix(vec4f(1.0)-f,f,q);sum+=hf(h4i(b+o))*wt.x*wt.y*wt.z*wt.w;}}}}return sum;}
fn noise4Fbm(p:vec4f,detail:f32,roughness:f32,lacunarity:f32)->f32{var amp=1.0;var scale=1.0;var total=0.0;var norm=0.0;let whole=i32(clamp(floor(detail),0.0,15.0));for(var i=0;i<16;i++){if(i>whole){break;}total+=valueNoise4(p*scale)*amp;norm+=amp;amp*=roughness;scale*=lacunarity;}let rem=clamp(detail-floor(detail),0.0,1.0);if(rem>0.0&&whole<15){total+=valueNoise4(p*scale)*amp*rem;norm+=amp*rem;}return total/max(norm,1e-5);}
fn voronoi4(p:vec4f)->f32{let cell=vec4i(floor(p));let local=fract(p);var best=1e9;for(var w:i32=-1;w<=1;w=w+1){for(var z:i32=-1;z<=1;z=z+1){for(var y:i32=-1;y<=1;y=y+1){for(var x:i32=-1;x<=1;x=x+1){let o=vec4i(x,y,z,w);let point=vec4f(o)+hv4(cell+o);best=min(best,length(point-local));}}}}return best;}
fn voronoiFbm4(p:vec4f,detail:f32,roughness:f32,lacunarity:f32)->f32{var amp=1.0;var scale=1.0;var total=0.0;var norm=0.0;let whole=i32(clamp(floor(detail),0.0,15.0));for(var i=0;i<16;i++){if(i>whole){break;}total+=voronoi4(p*scale)*amp;norm+=amp;amp*=roughness;scale*=lacunarity;}let rem=clamp(detail-floor(detail),0.0,1.0);if(rem>0.0&&whole<15){total+=voronoi4(p*scale)*amp*rem;norm+=amp*rem;}return total/max(norm*1.5,1e-5);}
fn mapRange(v:f32,a:f32,b:f32,c:f32,d:f32)->f32{if(abs(b-a)<1e-5){return c;}let t=(v-a)/(b-a);return clamp(mix(c,d,t),min(c,d),max(c,d));}
`;

export const PROCEDURAL_CLOUD_DENSITY=/*wgsl*/`
struct Params{p:array<vec4f,80>};
@group(0) @binding(0) var<uniform> k:Params;
@group(0) @binding(1) var outCache:texture_storage_3d<rgba16float,write>;
${CLOUD_NOISE}
fn cloudDensity(pos:vec3f)->f32{
 let time=k.p[67].x;let densityParam=k.p[61].x;let factorMacro=k.p[61].y;let scale=k.p[61].z;let altitude=k.p[61].w;let detail=k.p[62].x;let cloudHeight=max(.001,k.p[62].w);
 let lowAltDensity=.2;let factorDetail=1.0;let factorShaper=1.0;
 let objPos=vec3f(pos.x,pos.z,pos.y);let zNorm=pos.y/cloudHeight;let Z=1.0-clamp(zNorm,0.0,1.0);
 let altRamp=mapRange(Z,0.0,altitude/5.0,1.0-lowAltDensity,1.0);
 let stage1Noise=noise4Fbm(vec4f(objPos/max(.001,scale),time)*2.0,0.0,0.5,2.0);
 let altitudeMask=clamp(altRamp*stage1Noise,0.0,1.0);
 let v1=voronoiFbm4(vec4f(objPos/max(.001,scale),time)*5.0,detail,.5,3.0);
 let v1mapped=mapRange(v1,0.0,.75,factorMacro*-.4,factorMacro);
 let stage2=clamp(altitudeMask+clamp(v1mapped*.5,0.0,1.0),0.0,1.0);
 let v2=voronoiFbm4(vec4f(objPos/max(.001,scale),time)*2.0,detail*5.0,.75,2.5);
 let v2mapped=mapRange(v2,0.0,1.0,factorDetail*-.25,factorDetail);
 let stage3=clamp(stage2+v2mapped,0.0,1.0);
 let cutoff=mapRange(Z,altitude*scale,0.0,0.0,1.0);
 let shaped=clamp(stage3-cutoff,0.0,1.0);let finalShaped=clamp(shaped-(1.0-factorShaper),0.0,1.0);
 let falloff=mapRange(Z,0.0,altitude,0.0,1.0);
 return finalShaped*falloff*densityParam*5.0;
}
@compute @workgroup_size(4,4,4) fn main(@builtin(global_invocation_id) gid:vec3u){let dims=textureDimensions(outCache);if(any(gid>=dims)){return;}let uvw=(vec3f(gid)+.5)/vec3f(dims);let h=max(.001,k.p[62].w);let pos=vec3f((uvw.x-.5)*9.0,uvw.y*h,(uvw.z-.5)*9.0);let d=cloudDensity(pos);textureStore(outCache,vec3i(gid),vec4f(d,0.0,0.0,1.0));}
`;

export const PROCEDURAL_CLOUD_RAY=/*wgsl*/`
struct Params{p:array<vec4f,80>};@group(0) @binding(0) var<uniform> k:Params;@group(0) @binding(1) var depthTex:texture_2d<f32>;
@group(1) @binding(0) var cs:sampler;@group(1) @binding(1) var cacheA:texture_3d<f32>;@group(1) @binding(2) var cacheB:texture_3d<f32>;
struct Q{@builtin(position) position:vec4f,@location(0) uv:vec2f};@vertex fn quad(@builtin(vertex_index)i:u32)->Q{let p=vec2f(f32((i<<1u)&2u),f32(i&2u));var o:Q;o.position=vec4f(p*2.0-1.0,0.0,1.0);o.uv=vec2f(p.x,1.0-p.y);return o;}
fn sat(x:f32)->f32{return clamp(x,0.0,1.0);}fn ray(uv:vec2f)->vec3f{let q=uv-k.p[10].xy/k.p[9].xy;return normalize(k.p[7].xyz+k.p[5].xyz*(q.x*2.0-1.0)*k.p[5].w*k.p[6].w+k.p[6].xyz*(1.0-q.y*2.0)*k.p[6].w);}fn depthAt(uv:vec2f)->f32{let d=vec2i(textureDimensions(depthTex));return textureLoad(depthTex,clamp(vec2i(floor(uv*vec2f(d))),vec2i(0),d-1),0).r;}
fn boxHit(ro:vec3f,rd:vec3f,c:vec3f,h:vec3f)->vec2f{let inv=sign(rd+vec3f(1e-8))/max(abs(rd),vec3f(1e-7));let a=(c-h-ro)*inv;let b=(c+h-ro)*inv;let lo=min(a,b);let hi=max(a,b);return vec2f(max(0.0,max(lo.x,max(lo.y,lo.z))),min(hi.x,min(hi.y,hi.z)));}
fn sampleDensity(uvw:vec3f)->f32{if(any(uvw<vec3f(0.0))||any(uvw>vec3f(1.0))){return 0.0;}let a=textureSampleLevel(cacheA,cs,uvw,0.0).r;let b=textureSampleLevel(cacheB,cs,uvw,0.0).r;return mix(a,b,sat(k.p[63].x));}
fn ign(p:vec2f)->f32{return fract(52.9829189*fract(dot(p,vec2f(.06711056,.00583715))));}
const SUN_DIR=vec3f(.189,.943,.283);const SUN_COLOR=vec3f(1.0);const AMBIENT=vec3f(.26,.30,.42);
fn hg(c:f32,g:f32)->f32{let g2=g*g;return (1.0-g2)/(12.56636*pow(max(1e-4,1.0+g2-2.0*g*c),1.5));}
fn lightMarch(uvw:vec3f)->f32{var shadow=0.0;let steps=i32(k.p[65].w);let h=max(.001,k.p[62].w);let uvStep=SUN_DIR*.15/vec3f(9.0,h,9.0);for(var i=1;i<=64;i++){if(i>steps){break;}shadow+=sampleDensity(uvw+uvStep*f32(i))*.15;}return exp(-shadow*k.p[62].y);}
fn edgeLine(q:vec3f)->f32{let d=min(q,vec3f(1.0)-q);let n=select(0,1,d.x<.012)+select(0,1,d.y<.012)+select(0,1,d.z<.012);return select(0.0,1.0,n>=2);}
@fragment fn main(v:Q)->@location(0) vec4f{let ro=k.p[4].xyz;let rd=ray(v.uv);let center=k.p[64].xyz;let size=max(k.p[65].xyz,vec3f(.001));let half=size*.5;var span=boxHit(ro,rd,center,half);if(span.y<=span.x){return vec4f(0.0);}let sceneD=depthAt(v.uv);if(k.p[66].x>.5){span.y=min(span.y,sceneD);}if(span.y<=span.x){return vec4f(0.0);}let count=max(1,i32(k.p[64].w));let stepWorld=(span.y-span.x)/f32(count);let localScale=vec3f(9.0/size.x,max(.001,k.p[62].w)/size.y,9.0/size.z);let localStep=max(1e-5,length(rd*localScale)*stepWorld);let dither=ign(v.position.xy+floor(k.p[9].z)*vec2f(17.0,31.0));var trans=1.0;var color=vec3f(0.0);let cosTheta=dot(rd,SUN_DIR);let phase=mix(1.0,hg(cosTheta,.45),.6);
 for(var i=0;i<256;i++){if(i>=count||trans<.01){break;}let t=span.x+(f32(i)+dither)*stepWorld;let world=ro+rd*t;let uvw=(world-(center-half))/size;var d=sampleDensity(uvw);if(d>.01){if(k.p[66].x>.5&&k.p[66].y>0.0){d*=sat((sceneD-t)/k.p[66].y);}let stepTrans=exp(-min(80.0,d*localStep));let shadow=select(lightMarch(uvw),1.0,k.p[63].z>.5);let scattering=shadow*phase*(1.0-exp(-d));let lit=SUN_COLOR*scattering*k.p[62].z+AMBIENT*.5;color+=trans*(1.0-stepTrans)*lit;trans*=stepTrans;}}
 var alpha=1.0-trans;if(k.p[66].z>.5&&k.p[66].w>.5){let entry=(ro+rd*span.x-(center-half))/size;let line=edgeLine(clamp(entry,vec3f(0.0),vec3f(1.0)));if(line>.5){let a=.82;color=mix(color,vec3f(.02,1.2,1.3)*a,a);alpha=max(alpha,a);}}return vec4f(min(color,vec3f(60000.0)),sat(alpha));}
`;

export const PROCEDURAL_CLOUD_COMPOSITE=COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{let base=at(image,v.uv);let c=tap(volumeTex,v.uv);let strength=max(0.0,k.p[63].w);let a=sat(c.a*strength);return bounded(vec4f(c.rgb*strength+base.rgb*(1.0-a),1.0));}
`;
