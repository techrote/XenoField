import {CACHE_PROJECTION} from './projection-cache.js';
import {COMMON} from './common.js';
const NOISE=/*wgsl*/`
fn sat(x:f32)->f32{return clamp(x,0.0,1.0);}
fn hash(p:vec3f)->f32{return fract(sin(dot(p,vec3f(127.1,311.7,74.7)))*43758.5453);}
fn grad(p:vec3f)->vec3f{return normalize(vec3f(hash(p),hash(p+19.7),hash(p-31.3))*2.0-1.0+vec3f(.0001));}
fn perlin(p:vec3f)->f32{let cell=floor(p);let f=fract(p);let u=f*f*f*(f*(f*6.0-15.0)+10.0);var v=0.0;for(var z=0;z<2;z++){for(var y=0;y<2;y++){for(var x=0;x<2;x++){let o=vec3f(f32(x),f32(y),f32(z));let w=mix(1.0-u,u,o);v+=dot(grad(cell+o),f-o)*w.x*w.y*w.z;}}}return sat(.5+v*.85);}
fn cellular(p:vec3f)->vec2f{let c=floor(p);let f=fract(p);var d1=4.0;var d2=4.0;for(var z=-1;z<=1;z++){for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){let o=vec3f(f32(x),f32(y),f32(z));let q=c+o;let j=vec3f(hash(q),hash(q+13.1),hash(q-21.7));let d=length(o+j-f);if(d<d1){d2=d1;d1=d;}else{d2=min(d2,d);}}}}return vec2f(d1,d2-d1);}
fn gate(x:f32,t:f32,w:f32)->f32{if(w<.00001){return select(0.0,1.0,x>=t);}return smoothstep(t-w,t+w,x);}
`;
export function densityShader(format='rgba8unorm'){return /*wgsl*/`
struct Params { p:array<vec4f,64> }; @group(0) @binding(0) var<uniform> k:Params;
@group(0) @binding(1) var samp:sampler;
@group(0) @binding(2) var previous:texture_3d<f32>;
@group(0) @binding(3) var outputCache:texture_storage_3d<${format},write>;
@group(0) @binding(4) var atlas:texture_2d<f32>;
@group(0) @binding(5) var environment:texture_2d<f32>;
@group(0) @binding(6) var mask:texture_2d<f32>;
@group(0) @binding(7) var<storage,read> spectral:array<vec4f>;
${NOISE}
${CACHE_PROJECTION}
fn field(code:f32,p:vec3f)->f32{let c=i32(round(code));if(c==9){return hash(floor(p));}if(c==3||c==4){let v=cellular(p);return select(sat(1.0-v.x),sat(v.y*2.5),c==4);}if(c==5){let dims=u32(sqrt(f32(arrayLength(&spectral)/2u)));let q=vec2u(fract(p.xz*.07)*f32(dims));let v=spectral[(q.y*dims+q.x)*2u];return sat(.5+v.y*.06+length(v.xz)*.02);}if(c==6){let world=p/max(.01,k.p[18].x)*k.p[23].w+k.p[24].xyz;let n=normalize(world-k.p[24].xyz+vec3f(.0001));let uv=masterMap(world,n,fract(p.xz*.17));return textureSampleLevel(atlas,samp,fract(uv),0.0).r;}if(c==7){let a=textureSampleLevel(atlas,samp,fract(p.xz*k.p[51].x*.11+k.p[4].w*k.p[51].w*.01),0.0);var v=a.r;if(k.p[51].z>.5&&k.p[51].z<1.5){v=a.g;}if(k.p[51].z>1.5){v=a.b;}return sat((v-.5)*k.p[51].y+.5);}if(c==8){let a=textureSampleLevel(environment,samp,fract(p.xy*.11+p.z*.03),0.0).rgb;return sat(dot(a,vec3f(.2126,.7152,.0722))*.2);}let v=perlin(p);if(c==1){return abs(v*2.0-1.0);}if(c==2){return 1.0-abs(v*2.0-1.0);}return v;}
@compute @workgroup_size(4,4,4) fn main(@builtin(global_invocation_id) gid:vec3u){let dims=textureDimensions(outputCache);if(any(gid>=dims)){return;}let uv=(vec3f(gid)+.5)/vec3f(dims);var p=(uv-.5)*k.p[18].x+vec3f(k.p[26].z)+k.p[4].w*k.p[25].w*vec3f(.31,.19,-.23);if(k.p[19].x>0.0){p=floor(p*k.p[19].x/k.p[18].x)*k.p[18].x/k.p[19].x;}p+=sin(p.yzx*1.73+p.zxy*.83)*k.p[18].z;let shape=i32(round(k.p[26].x));if(shape==4){p=1.0-abs(fract(p*.5)*2.0-1.0);}if(shape==5){p=fract(p);}
 let a=field(k.p[24].w,p);let b=field(k.p[48].x,p*1.37+3.1);let m=k.p[48].y;let mode=i32(round(k.p[48].z));var v=mix(a,b,m);if(mode==1){v=a*mix(1.0,b,m);}if(mode==2){v=sat(a+b*m);}if(mode==3){v=abs(a-b*m);}if(mode==4){v=abs(gate(a,.5,.02)-gate(b,.5,.02));}if(k.p[18].y>0.0){v=mix(v,field(k.p[24].w,p*2.03+7.7),k.p[18].y*.5);}if(shape==1){v=1.0-abs(fract(v*2.0)*2.0-1.0);}if(shape==2){v=abs(v*2.0-1.0);}if(shape==3){v=abs(v-b);}if(k.p[26].y>.5){v=1.0-v;}
 let structure=sat(abs(a-b)*2.0);v=gate(v+k.p[17].y*.5-.25,k.p[17].z,k.p[17].w);v=pow(max(v,0.0),k.p[18].w);if(k.p[26].w>=2.0){v=floor(v*(k.p[26].w-1.0)+.5)/(k.p[26].w-1.0);}if(k.p[45].w>.5){v*=textureSampleLevel(mask,samp,uv.xz,0.0).b;}
 let light=textureSampleLevel(previous,samp,uv,0.0).g;let emission=sat(structure*.75+v*v*.5);textureStore(outputCache,vec3i(gid),vec4f(sat(v),light,structure,emission));
}
`;}
export function lightShader(format='rgba8unorm'){return /*wgsl*/`
struct Params { p:array<vec4f,64> }; @group(0) @binding(0) var<uniform> k:Params;
@group(0) @binding(1) var samp:sampler;@group(0) @binding(2) var density:texture_3d<f32>;@group(0) @binding(3) var lit:texture_storage_3d<${format},write>;
@compute @workgroup_size(4,4,4) fn main(@builtin(global_invocation_id) gid:vec3u){let dims=textureDimensions(lit);if(any(gid>=dims)){return;}let uv=(vec3f(gid)+.5)/vec3f(dims);let px=1.0/vec3f(dims);let c=textureSampleLevel(density,samp,uv,0.0);let mode=i32(round(k.p[25].x));let ld=normalize(k.p[28].xyz+vec3f(.0001));var lighting=1.0;
 if(mode==0){let g=vec3f(textureSampleLevel(density,samp,uv+vec3f(px.x,0,0),0.0).r-textureSampleLevel(density,samp,uv-vec3f(px.x,0,0),0.0).r,textureSampleLevel(density,samp,uv+vec3f(0,px.y,0),0.0).r-textureSampleLevel(density,samp,uv-vec3f(0,px.y,0),0.0).r,textureSampleLevel(density,samp,uv+vec3f(0,0,px.z),0.0).r-textureSampleLevel(density,samp,uv-vec3f(0,0,px.z),0.0).r);lighting=.3+.7*max(0.0,dot(normalize(-g+vec3f(.0001)),ld));}
 if(mode==1||mode==2){var optical=0.0;let steps=i32(k.p[25].y);for(var i=1;i<=32;i++){if(i>steps){break;}let stride=select(f32(i),pow(1.55,f32(i)),mode==2);let q=uv+ld*px*stride*2.0;if(any(q<vec3f(0.0))||any(q>vec3f(1.0))){break;}let lod=select(0.0,min(f32(textureNumLevels(density)-1u),log2(stride)),mode==2);optical+=textureSampleLevel(density,samp,q,lod).r*stride/f32(steps);}lighting=exp(-min(40.0,optical*k.p[25].z));}
 textureStore(lit,vec3i(gid),vec4f(c.r,clamp(lighting,0.0,1.0),c.b,c.a));
}
`;}
export function volumeMipShader(format='rgba8unorm'){return /*wgsl*/`
@group(0) @binding(0) var src:texture_3d<f32>;@group(0) @binding(1) var dst:texture_storage_3d<${format},write>;
@compute @workgroup_size(4,4,4) fn main(@builtin(global_invocation_id) gid:vec3u){let dims=textureDimensions(dst);if(any(gid>=dims)){return;}let sd=textureDimensions(src);let begin=vec3i(floor(vec3f(gid)*vec3f(sd)/vec3f(dims)));let end=vec3i(ceil(vec3f(gid+1u)*vec3f(sd)/vec3f(dims)));var sum=vec4f(0.0);var count=0.0;for(var z=0;z<3;z++){for(var y=0;y<3;y++){for(var x=0;x<3;x++){let p=begin+vec3i(x,y,z);if(all(p<end)){sum+=textureLoad(src,min(p,vec3i(sd)-1),0);count+=1.0;}}}}textureStore(dst,vec3i(gid),sum/max(1.0,count));}
`;}
export const VOLUME_RAY=COMMON+/*wgsl*/`
@group(1) @binding(0) var cacheSampler:sampler;@group(1) @binding(1) var cacheA:texture_3d<f32>;@group(1) @binding(2) var cacheB:texture_3d<f32>;
fn cache(uvw:vec3f)->vec4f{let uv=clamp(uvw,vec3f(0.0),vec3f(1.0));var a=vec4f(0.0);var b=vec4f(0.0);if(k.p[29].z<.5){let dim=vec3i(textureDimensions(cacheA));let p=clamp(vec3i(uv*vec3f(dim)),vec3i(0),dim-1);a=textureLoad(cacheA,p,0);b=textureLoad(cacheB,p,0);}else{a=textureSampleLevel(cacheA,cacheSampler,uv,0.0);b=textureSampleLevel(cacheB,cacheSampler,uv,0.0);}return mix(a,b,select(1.0,k.p[29].x,k.p[29].y>.5));}
fn boxHit(ro:vec3f,rd:vec3f,centre:vec3f,halfSize:vec3f)->vec2f{let inv=sign(rd+vec3f(1e-8))/max(abs(rd),vec3f(1e-7));let a=(centre-halfSize-ro)*inv;let b=(centre+halfSize-ro)*inv;let lo=min(a,b);let hi=max(a,b);return vec2f(max(0.0,max(lo.x,max(lo.y,lo.z))),min(hi.x,min(hi.y,hi.z)));}
fn sphereHit(ro:vec3f,rd:vec3f,r:f32)->vec2f{let b=dot(ro,rd);let c=dot(ro,ro)-r*r;let disc=b*b-c;if(disc<0.0){return vec2f(1.0,-1.0);}let root=sqrt(disc);return vec2f(max(0.0,-b-root),-b+root);}
struct VolumeOut{@location(0) radiance:vec4f,@location(1) signals:vec4f,@location(2) depth:f32};
@fragment fn main(v:Q)->VolumeOut{
 var o:VolumeOut;o.radiance=vec4f(0.0);o.signals=vec4f(0.0);o.depth=k.p[7].w;
 let ro=k.p[4].xyz;let rd=ray(v.uv);let sceneD=depthAt(v.uv);let mode=i32(round(k.p[16].w));let origin=k.p[24].xyz;let size=k.p[23].w;var span=vec2f(0.0,k.p[23].z);let isSurface=mode==2||mode==5;
 if(mode==0){span=boxHit(ro,rd,origin,vec3f(size*.5));}
 if(mode==1){span=vec2f(max(0.0,k.p[24].z),max(0.0,k.p[24].z)+k.p[23].z);}
 if(isSurface){if(sceneD>=k.p[7].w*.98){return o;}var facing=1.0;if(mode==5){facing=max(.15,abs(dot(at(auxTex,v.uv).xyz,rd)));}let thickness=k.p[23].y/facing;span=vec2f(max(0.0,sceneD-k.p[23].x-thickness),max(0.0,sceneD-k.p[23].x));}
 if(mode==3){span=sphereHit(ro-origin,rd,max(1.0,120.0+k.p[23].x+k.p[23].y));}
 if(mode==4){span=boxHit(ro,rd,origin,vec3f(max(1.0,k.p[49].w)+k.p[23].y));}
 if(k.p[30].z>.5){span.y=min(span.y,sceneD);}if(span.y<=span.x){return o;}
 let count=i32(k.p[16].y);let stepSize=(span.y-span.x)/f32(count);let phase=floor(k.p[4].w*k.p[20].x);let jitter=mix(.5,stochastic(v.position.xy,k.p[19].z,phase),k.p[19].w);var trans=1.0;var color=vec3f(0.0);var signals=vec3f(0.0);var depthSum=0.0;
 for(var i=0;i<32;i++){if(i>=count||trans<.01){break;}var t=span.x+(f32(i)+jitter)*stepSize;if(k.p[29].w>=2.0){t=span.x+floor((t-span.x)/max(.0001,span.y-span.x)*k.p[29].w+.5)/k.p[29].w*(span.y-span.x);}let world=ro+rd*t;if(mode==3&&length(world-origin)<max(1.0,120.0+k.p[23].x)){continue;}
 var uvw=(world-origin)/size+.5;if(mode==1){uvw=vec3f(v.uv,(t-span.x)/max(.0001,span.y-span.x));}if(mode==4){uvw=(world-origin)/(2.0*(max(1.0,k.p[49].w)+k.p[23].y))+.5;}if(mode==6){uvw=vec3f(v.uv,t/k.p[23].z);}if(mode==7||isSurface){uvw=fract(uvw);}if(k.p[48].w>=2.0){uvw=floor(uvw*k.p[48].w+.5)/k.p[48].w;}
 let cell=floor(uvw*k.p[16].x);if(hash(cell+phase*vec3f(.37,.71,.13))<k.p[19].y){continue;}let c=cache(uvw);if(c.r<.003){continue;}let dither=stochastic(floor(v.position.xy/2.0)+cell.xy,k.p[19].z,phase);var density=c.r*k.p[17].x;if(dither>mix(1.0,c.r,k.p[19].w*.4)){continue;}
 if(k.p[30].z>.5&&k.p[30].w>0.0){density*=sat((sceneD-t)/k.p[30].w);}let alpha=1.0-exp(-min(40.0,density*stepSize*.08*max(.001,k.p[20].z)));let weight=trans*alpha;var light=c.g;
 // Nested lighting exists only behind the explicit experimental mode.
 if(k.p[25].x>3.5){var optical=0.0;for(var j=1;j<=32;j++){if(j>i32(k.p[25].y)){break;}let q=uvw+normalize(k.p[28].xyz)*f32(j)*2.0/k.p[16].x;if(any(q<vec3f(0.0))||any(q>vec3f(1.0))){break;}optical+=cache(q).r/k.p[25].y;}light=exp(-optical*k.p[25].z);}
 let edge=1.0-smoothstep(.015,.12,min(min(fract(uvw*k.p[16].x).x,fract(uvw*k.p[16].x).y),fract(uvw*k.p[16].x).z));let phaseLight=1.0+k.p[20].w*pow(abs(dot(rd,normalize(k.p[28].xyz))),4.0);var env=vec3f(0.0);if(k.p[21].w>0.0){let envMix=select(k.p[52].z,k.p[52].x,k.p[52].w>.5)*k.p[52].y;env=mix(tap(environmentTex,fract(uvw.xz)).rgb,tap(hdriTex,fract(uvw.xz)).rgb,envMix)*k.p[21].w;}
 let lit=k.p[21].rgb*(k.p[22].rgb*(light+k.p[22].w)*phaseLight+env)+k.p[21].rgb*(c.a*k.p[20].y+edge*k.p[27].z);
 color+=weight*lit;signals+=weight*vec3f(light,c.b,c.a);depthSum+=weight*t;trans*=1.0-alpha;
 }
 let opacity=1.0-trans;o.radiance=bounded(vec4f(color,opacity));o.signals=vec4f(opacity,signals/max(.00001,opacity));if(opacity>.0001){o.depth=depthSum/opacity;}return o;
}
`;
