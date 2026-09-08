const STRUCTS=/*wgsl*/`
struct Globals {
 vp:mat4x4f,
 cameraTime:vec4f, rightAspect:vec4f, upTan:vec4f, forwardMode:vec4f,
 env:vec4f, liquid:vec4f, fresnel:vec4f, pattern:vec4f, foam:vec4f,
 body:vec4f, foamTint:vec4f, distance:vec4f, clouds:vec4f, mixer:vec4f,
 noixture:vec4f, noixtureTint:vec4f, blendModes:vec4f,
 maskSources:vec4f, maskAdjust:vec4f, maskExtra:vec4f, maskMotion:vec4f,
 render:vec4f, finish:vec4f, cascade0:vec4f, cascade1:vec4f, cascade2:vec4f, extras:vec4f,
 ambientLight:vec4f, emissiveLight:vec4f, spotLight:vec4f, spotParams:vec4f,
 projection0:vec4f, projectionScale:vec4f, projectionRotation:vec4f, projectionOffset:vec4f,
 projectionOrigin:vec4f, projectionLayers:vec4f, projectionExtra:vec4f, projectionMisc:vec4f, quality:vec4f
};
@group(0) @binding(0) var<uniform> u:Globals;
fn sat(v:f32)->f32{return clamp(v,0.0,1.0);}
fn safeDiv(a:vec3f,b:vec3f)->vec3f{return a/max(abs(b),vec3f(1e-5))*sign(b+vec3f(1e-8));}
fn luma(c:vec3f)->f32{return dot(c,vec3f(.2126,.7152,.0722));}
struct QuadOut { @builtin(position) position:vec4f, @location(0) uv:vec2f };
@vertex fn quad(@builtin(vertex_index) i:u32)->QuadOut {
 let p=vec2f(f32((i<<1u)&2u),f32(i&2u));var o:QuadOut;
 o.position=vec4f(p*2.0-1.0,0.999999,1.0);o.uv=vec2f(p.x,1.0-p.y);return o;
}
`;

const SCENE=STRUCTS+/*wgsl*/`
@group(0) @binding(1) var envSampler:sampler;
@group(0) @binding(2) var plasmaTexture:texture_2d<f32>;
@group(0) @binding(3) var detailTexture:texture_2d<f32>;
@group(0) @binding(4) var detailSampler:sampler;
@group(0) @binding(5) var hdriTexture:texture_2d<f32>;
@group(0) @binding(6) var kineticMaskTexture:texture_2d<f32>;
var<private> kineticScreenUV:vec2f;
// Native AF uses derivatives; manual32 is confined to selected 2D surface-detail lookups.
fn surfaceDetail(uv:vec2f)->vec4f {
 let dx=dpdx(uv);let dy=dpdy(uv);let dims=vec2f(textureDimensions(detailTexture));
 if(u.quality.z>.5){let lx=length(dx*dims);let ly=length(dy*dims);let major=select(dy,dx,lx>=ly);let lod=clamp(log2(max(1.0,min(lx,ly))),0.0,f32(textureNumLevels(detailTexture)-1u));var c=vec4f(0.0);for(var i=0;i<32;i++){c+=textureSampleLevel(detailTexture,detailSampler,uv+major*((f32(i)+.5)/32.0-.5),lod);}return c/32.0;}
 if(u.quality.w>.5){return textureSampleLevel(detailTexture,detailSampler,uv,0.0);}
 return textureSampleGrad(detailTexture,detailSampler,uv,dx,dy);
}
fn ray(uv:vec2f)->vec3f {let p=(uv-u.quality.xy/u.render.xy)*2.0-1.0;return normalize(u.forwardMode.xyz+u.rightAspect.xyz*p.x*u.rightAspect.w*u.upTan.w-u.upTan.xyz*p.y*u.upTan.w);}
fn envUV(d:vec3f)->vec2f {
 let r=vec3f(d.x*u.env.x-d.z*u.env.y,d.y,d.x*u.env.y+d.z*u.env.x);
 return vec2f(atan2(r.z,r.x)*0.159154943+0.5,acos(clamp(r.y,-1.0,1.0))*0.318309886);
}
fn rawPlasma(uv:vec2f,lod:f32)->vec3f{let level=clamp(lod+u.env.w,0.0,f32(textureNumLevels(plasmaTexture)-1u));return textureSampleLevel(plasmaTexture,envSampler,uv,level).rgb*u.env.z;}
fn rawHdri(uv:vec2f,lod:f32)->vec3f{let level=clamp(lod+u.env.w,0.0,f32(textureNumLevels(hdriTexture)-1u));return textureSampleLevel(hdriTexture,envSampler,uv,level).rgb*u.env.z;}
fn rawCrossfade(uv:vec2f,lod:f32)->vec3f{return mix(rawPlasma(uv,lod),rawHdri(uv,lod),sat(u.mixer.x));}

fn hash12(p:vec2f)->f32{let p3=fract(vec3f(p.xyx)*.1031);let q=p3+dot(p3,p3.yzx+33.33);return fract((q.x+q.y)*q.z);}
fn blendScreen(b:vec3f,s:vec3f)->vec3f{return 1.0-(1.0-b)*(1.0-s);}
fn blendOverlayCore(b:vec3f,s:vec3f)->vec3f{
 return vec3f(
  select(2.0*b.x*s.x,1.0-2.0*(1.0-b.x)*(1.0-s.x),b.x>.5),
  select(2.0*b.y*s.y,1.0-2.0*(1.0-b.y)*(1.0-s.y),b.y>.5),
  select(2.0*b.z*s.z,1.0-2.0*(1.0-b.z)*(1.0-s.z),b.z>.5));
}
fn blendHardLightCore(b:vec3f,s:vec3f)->vec3f{
 return vec3f(
  select(2.0*b.x*s.x,1.0-2.0*(1.0-b.x)*(1.0-s.x),s.x>.5),
  select(2.0*b.y*s.y,1.0-2.0*(1.0-b.y)*(1.0-s.y),s.y>.5),
  select(2.0*b.z*s.z,1.0-2.0*(1.0-b.z)*(1.0-s.z),s.z>.5));
}
fn softComponent(b:f32,s:f32)->f32{
 if(s<=.5){return b-(1.0-2.0*s)*b*(1.0-b);}var d=sqrt(max(b,0.0));if(b<=.25){d=((16.0*b-12.0)*b+4.0)*b;}return b+(2.0*s-1.0)*(d-b);
}
fn blendSoftLightCore(b:vec3f,s:vec3f)->vec3f{return vec3f(softComponent(b.x,s.x),softComponent(b.y,s.y),softComponent(b.z,s.z));}
fn dodgeCore(b:vec3f,s:vec3f)->vec3f{return min(vec3f(1.0),safeDiv(b,max(vec3f(1e-5),vec3f(1.0)-s)));}
fn burnCore(b:vec3f,s:vec3f)->vec3f{return max(vec3f(0.0),vec3f(1.0)-safeDiv(vec3f(1.0)-b,max(s,vec3f(1e-5))));}
fn vividCore(b:vec3f,s:vec3f)->vec3f{
 let lo=burnCore(b,clamp(s*2.0,vec3f(0.0),vec3f(1.0)));let hi=dodgeCore(b,clamp((s-.5)*2.0,vec3f(0.0),vec3f(1.0)));
 return vec3f(select(lo.x,hi.x,s.x>.5),select(lo.y,hi.y,s.y>.5),select(lo.z,hi.z,s.z>.5));
}
fn pinCore(b:vec3f,s:vec3f)->vec3f{
 let lo=min(b,s*2.0);let hi=max(b,(s-.5)*2.0);
 return vec3f(select(lo.x,hi.x,s.x>.5),select(lo.y,hi.y,s.y>.5),select(lo.z,hi.z,s.z>.5));
}
fn clipColor(c0:vec3f)->vec3f{
 var c=c0;let ll=luma(c);let mn=min(c.x,min(c.y,c.z));let mx=max(c.x,max(c.y,c.z));
 if(mn<0.0){c=vec3f(ll)+(c-vec3f(ll))*ll/max(ll-mn,1e-5);}let mx2=max(c.x,max(c.y,c.z));if(mx2>1.0){c=vec3f(ll)+(c-vec3f(ll))*(1.0-ll)/max(mx2-ll,1e-5);}return c;
}
fn setLum(c:vec3f,ll:f32)->vec3f{return clipColor(c+vec3f(ll-luma(c)));}
fn rgbToHsv(c:vec3f)->vec3f{
 let mx=max(c.x,max(c.y,c.z));let mn=min(c.x,min(c.y,c.z));let d=mx-mn;var h=0.0;
 if(d>1e-6){if(mx==c.x){h=(c.y-c.z)/d;}else if(mx==c.y){h=2.0+(c.z-c.x)/d;}else{h=4.0+(c.x-c.y)/d;}h=fract(h/6.0);if(h<0.0){h=h+1.0;}}
 let ss=select(0.0,d/max(mx,1e-6),mx>1e-6);return vec3f(h,ss,mx);
}
fn hsvToRgb(hsv:vec3f)->vec3f{let p=abs(fract(hsv.xxx+vec3f(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);return hsv.z*mix(vec3f(1.0),clamp(p-1.0,vec3f(0.0),vec3f(1.0)),hsv.y);}
fn cbrtPositive(x:f32)->f32{return pow(max(x,0.0),1.0/3.0);}
fn rgbToOklab(c0:vec3f)->vec3f{
 let c=max(c0,vec3f(0.0));let ll=.4122214708*c.x+.5363325363*c.y+.0514459929*c.z;let mm=.2119034982*c.x+.6806995451*c.y+.1073969566*c.z;let ss=.0883024619*c.x+.2817188376*c.y+.6299787005*c.z;
 let l1=cbrtPositive(ll);let m1=cbrtPositive(mm);let s1=cbrtPositive(ss);return vec3f(.2104542553*l1+.793617785*m1-.0040720468*s1,1.9779984951*l1-2.428592205*m1+.4505937099*s1,.0259040371*l1+.7827717662*m1-.808675766*s1);
}
fn oklabToRgb(lab:vec3f)->vec3f{
 let l1=lab.x+.3963377774*lab.y+.2158037573*lab.z;let m1=lab.x-.1055613458*lab.y-.0638541728*lab.z;let s1=lab.x-.0894841775*lab.y-1.291485548*lab.z;let ll=l1*l1*l1;let mm=m1*m1*m1;let ss=s1*s1*s1;
 return max(vec3f(4.0767416621*ll-3.3077115913*mm+.2309699292*ss,-1.2684380046*ll+2.6097574011*mm-.3413193965*ss,-.0041960863*ll-.7034186147*mm+1.707614701*ss),vec3f(0.0));
}
fn oklabComponentBlend(base:vec3f,source:vec3f,mode:f32)->vec3f{
 let b=rgbToOklab(base);let s=rgbToOklab(source);let bc=length(b.yz);let sc=length(s.yz);var bd=vec2f(1.0,0.0);var sd=vec2f(1.0,0.0);if(bc>1e-6){bd=b.yz/bc;}if(sc>1e-6){sd=s.yz/sc;}
 if(mode<30.5){return oklabToRgb(vec3f(b.x,sd.x*bc,sd.y*bc));}if(mode<31.5){return oklabToRgb(vec3f(b.x,bd.x*sc,bd.y*sc));}if(mode<32.5){return oklabToRgb(vec3f(b.x,s.y,s.z));}return oklabToRgb(vec3f(s.x,b.y,b.z));
}
fn blendResult(baseRaw:vec3f,sourceRaw:vec3f,mode:f32)->vec3f{
 let b=clamp(baseRaw,vec3f(0.0),vec3f(1.0));let s=clamp(sourceRaw,vec3f(0.0),vec3f(1.0));
 if(mode<.5){return sourceRaw;}if(mode<1.5){return sourceRaw;}
 if(mode<2.5){return max(baseRaw,sourceRaw);}if(mode<3.5){return select(baseRaw,sourceRaw,luma(sourceRaw)>luma(baseRaw));}
 if(mode<4.5){return blendScreen(b,s);}if(mode<5.5){return dodgeCore(b,s);}if(mode<6.5){return baseRaw+sourceRaw;}
 if(mode<7.5){return min(baseRaw,sourceRaw);}if(mode<8.5){return select(baseRaw,sourceRaw,luma(sourceRaw)<luma(baseRaw));}
 if(mode<9.5){return baseRaw*sourceRaw;}if(mode<10.5){return burnCore(b,s);}if(mode<11.5){return baseRaw+sourceRaw-vec3f(1.0);}
 if(mode<12.5){return blendOverlayCore(b,s);}if(mode<13.5){return blendSoftLightCore(b,s);}if(mode<14.5){return blendHardLightCore(b,s);}
 if(mode<15.5){return vividCore(b,s);}if(mode<16.5){return pinCore(b,s);}if(mode<17.5){return baseRaw+2.0*sourceRaw-vec3f(1.0);}if(mode<18.5){return step(vec3f(1.0),baseRaw+sourceRaw);}
 if(mode<19.5){return abs(baseRaw-sourceRaw);}if(mode<20.5){return vec3f(.5)-2.0*(baseRaw-vec3f(.5))*(sourceRaw-vec3f(.5));}
 if(mode<21.5){return baseRaw-sourceRaw;}if(mode<22.5){return baseRaw-sourceRaw+vec3f(.5);}if(mode<23.5){return baseRaw+sourceRaw-vec3f(.5);}if(mode<24.5){return safeDiv(baseRaw,sourceRaw);}
 if(mode<25.5){let hb=rgbToHsv(b);let hs=rgbToHsv(s);return hsvToRgb(vec3f(hs.x,hb.y,hb.z));}
 if(mode<26.5){let hb=rgbToHsv(b);let hs=rgbToHsv(s);return hsvToRgb(vec3f(hb.x,hs.y,hb.z));}
 if(mode<27.5){return setLum(s,luma(b));}
 if(mode<28.5){let hb=rgbToHsv(b);let hs=rgbToHsv(s);return hsvToRgb(vec3f(hb.x,hb.y,hs.z));}
 if(mode<32.5){return oklabComponentBlend(b,s,mode);}return setLum(b,luma(s));
}
fn applyBlend(base:vec3f,source:vec3f,opacity:f32,mode:f32,uv:vec2f)->vec3f{
 let a=sat(opacity);if(mode>.5&&mode<1.5){let r=hash12(uv*4096.0+vec2f(u.cameraTime.w*17.0,-u.cameraTime.w*11.0));return select(base,source,r<a);}let mixed=blendResult(base,source,mode);return mix(base,mixed,a);
}

fn noixtureSample(uv0:vec2f)->f32{
 let drift=u.cameraTime.w*u.noixture.w*.025;let uv=uv0*max(u.noixture.y,.001)*7.0+vec2f(drift,-drift*.71);let p=textureSampleLevel(detailTexture,detailSampler,uv*.61,0.0);let mode=floor(u.noixtureTint.w+.5);var n=p.r;if(mode>.5&&mode<1.5){n=p.g;}else if(mode>1.5&&mode<2.5){n=p.b;}else if(mode>2.5){n=sat(p.a*.52+p.g*.28+p.b*.20);}return sat((n-.5)*max(u.noixture.z,.01)+.5);
}
fn cloudMask(coord:vec2f)->vec2f{
 let t=u.cameraTime.w*u.clouds.z*.02;let uv=coord*max(u.clouds.y,.01)*.055+vec2f(t,-t*.73);let per=textureSampleLevel(detailTexture,detailSampler,uv*.47,0.0).r;let billow=textureSampleLevel(detailTexture,detailSampler,uv*.23+vec2f(.37,.11),0.0).g;let ridge=textureSampleLevel(detailTexture,detailSampler,uv*.81-vec2f(.19,.27),0.0).b;let wisps=textureSampleLevel(detailTexture,detailSampler,uv*1.53+vec2f(.13,-.21),0.0).a;let field=per*.28+billow*.34+ridge*.25+wisps*.13;let coverage=smoothstep(max(.18,.84-u.distance.w*.48),1.0,field+wisps*.1);return vec2f(coverage,sat(ridge*.62+wisps*.38));
}
fn maskSourceValue(code:f32,uv0:vec2f)->f32{
 let drift=u.cameraTime.w*u.maskMotion.y*.025;let uv=fract((uv0-.5)*max(u.maskMotion.x,.01)+.5+vec2f(drift,-drift*.67));
 if(code<.5){return 1.0;}if(code<1.5){return luma(rawPlasma(uv,0.0));}if(code<2.5){return luma(rawHdri(uv,0.0));}if(code<3.5){return luma(rawCrossfade(uv,0.0));}
 if(code<4.5){return noixtureSample(uv);}if(code<5.5){return cloudMask(uv*vec2f(8.0,5.0)).x;}
 let d=textureSampleLevel(detailTexture,detailSampler,uv*7.0,0.0);if(code<6.5){return d.r;}if(code<7.5){return d.g;}if(code<8.5){return d.b;}if(code<9.5){return d.a;}if(code<10.5){return uv.y;}return sat(1.0-length(uv-.5)*1.41421356);
}
fn maskValue(uv:vec2f)->f32{
 if(max(u.maskSources.x,u.maskSources.y)>=11.5){return textureSampleLevel(kineticMaskTexture,envSampler,clamp(kineticScreenUV,vec2f(0.0),vec2f(1.0)),0.0).r;}
 let a=maskSourceValue(u.maskSources.x,uv);let b=maskSourceValue(u.maskSources.y,uv);let m=sat(u.maskSources.z);let mode=u.maskSources.w;var x=mix(a,b,m);
 if(mode>.5&&mode<1.5){x=a*b;}else if(mode>1.5&&mode<2.5){x=1.0-(1.0-a)*(1.0-b);}else if(mode>2.5&&mode<3.5){x=a+b*m;}else if(mode>3.5&&mode<4.5){x=abs(a-b*m);}else if(mode>4.5&&mode<5.5){x=min(a,b);}else if(mode>5.5){x=max(a,b);}
 x=(x-.5)*u.maskAdjust.y+.5+u.maskAdjust.x;x=pow(max(x,0.0),1.0/max(u.maskAdjust.z,.05));if(u.maskExtra.x<.499){x=smoothstep(u.maskAdjust.w-u.maskExtra.x,u.maskAdjust.w+u.maskExtra.x,x);}x=sat(x);if(u.maskExtra.y>.5){x=1.0-x;}return x;
}
fn maskFor(bit:u32,uv:vec2f)->f32{let bits=u32(max(u.maskExtra.z,0.0)+.5);if((bits&bit)==0u){return 1.0;}return maskValue(uv);}

fn mixEnvironment(uv:vec2f,lod:f32)->vec3f{
 let a=rawPlasma(uv,lod);let b=rawHdri(uv,lod);if(u.mixer.z<.5){return mix(a,b,sat(u.mixer.x));}let opacity=sat(u.mixer.x)*maskFor(1u,uv);return applyBlend(a,b,opacity,u.blendModes.x,uv);
}
fn applyNoixture(base:vec3f,uv:vec2f)->vec3f{
 if(u.mixer.w<.5||u.noixture.x<=.0001){return base;}let n=noixtureSample(uv);let tint=mix(vec3f(n),u.noixtureTint.rgb*n,.72);let opacity=u.noixture.x*maskFor(2u,uv);return applyBlend(base,tint,opacity,u.blendModes.y,uv);
}
fn envSample(d:vec3f,lod:f32)->vec3f{let uv=envUV(d);return applyNoixture(mixEnvironment(uv,lod),uv);}
fn smoothSample(uv:vec2f)->vec3f{let dims=vec2f(textureDimensions(plasmaTexture));let p=uv*dims-.5;let f=fract(p);let ss=f*f*(3.0-2.0*f);let q=(floor(p)+ss+.5)/dims;return applyNoixture(mixEnvironment(q,0.0),uv);}
fn cubicSample(uv:vec2f)->vec3f{
 let dims=vec2f(textureDimensions(plasmaTexture));let p=uv*dims-.5;let f=fract(p);let om=1.0-f;let w0=om*om*om/6.0;let w1=(3.0*f*f*f-6.0*f*f+4.0)/6.0;let w2=(-3.0*f*f*f+3.0*f*f+3.0*f+1.0)/6.0;let w3=f*f*f/6.0;let g0=w0+w1;let g1=w2+w3;let h0=(floor(p)-1.0+w1/g0+.5)/dims;let h1=(floor(p)+1.0+w3/g1+.5)/dims;let a=mixEnvironment(h0,0.0);let b=mixEnvironment(vec2f(h1.x,h0.y),0.0);let c=mixEnvironment(vec2f(h0.x,h1.y),0.0);let d=mixEnvironment(h1,0.0);return applyNoixture(a*g0.x*g0.y+b*g1.x*g0.y+c*g0.x*g1.y+d*g1.x*g1.y,uv);
}
fn cloudLayer(base:vec3f,coord:vec2f,tint:vec3f,opacity:f32,maskUV:vec2f)->vec3f{let m=cloudMask(coord);let layer=tint*(.48+.82*m.y)*m.x;let alpha=m.x*opacity*u.clouds.x*maskFor(4u,maskUV);return applyBlend(base,layer,alpha,u.blendModes.z,maskUV);}
fn sky(d:vec3f)->vec3f{
 if(u.extras.w<.5){return vec3f(.003,.004,.008);}let uv=envUV(d);var base=vec3f(0.0);if(u.extras.y>1.5){base=cubicSample(uv);}else if(u.extras.y>.5){base=smoothSample(uv);}else{base=envSample(d,0.0);}let horizon=mix(1.6,.55,abs(d.y));let cloudCoord=vec2f(uv.x*8.0,uv.y*5.0+.2);let tint=mix(base,vec3f(1.0),.3)*horizon;return cloudLayer(base,cloudCoord,tint,.55,uv);
}
`;

export const SKY=SCENE+/*wgsl*/`
@fragment fn skyFragment(v:QuadOut)->@location(0) vec4f{kineticScreenUV=v.position.xy/u.render.xy;return vec4f(clamp(sky(ray(v.uv)),vec3f(0.0),vec3f(60000.0)),1.0);}
`;

export const LIQUID=SCENE+/*wgsl*/`
@group(1) @binding(0) var<storage,read> state0:array<vec4f>;
@group(1) @binding(1) var<storage,read> state1:array<vec4f>;
@group(1) @binding(2) var<storage,read> state2:array<vec4f>;
struct Sample{displacement:vec4f,normalFoam:vec4f};
fn sampleState(c:u32,idx:u32,component:u32)->vec4f{if(c==0u){return state0[idx*2u+component];}if(c==1u){return state1[idx*2u+component];}return state2[idx*2u+component];}
fn waveSample(p:vec2f,info:vec4f,c:u32)->Sample{let n=u32(info.x);let f=fract(p/info.y+.5)*info.x;let i=vec2u(floor(f));let j=(i+vec2u(1u))%vec2u(n);let t=fract(f);let ids=vec4u(i.y*n+i.x,i.y*n+j.x,j.y*n+i.x,j.y*n+j.x);var o:Sample;o.displacement=mix(mix(sampleState(c,ids.x,0u),sampleState(c,ids.y,0u),t.x),mix(sampleState(c,ids.z,0u),sampleState(c,ids.w,0u),t.x),t.y);o.normalFoam=mix(mix(sampleState(c,ids.x,1u),sampleState(c,ids.y,1u),t.x),mix(sampleState(c,ids.z,1u),sampleState(c,ids.w,1u),t.x),t.y);return o;}
struct MeshIn{@location(0) pos:vec3f,@location(1) uv:vec2f};struct MeshOut{@builtin(position) position:vec4f,@location(0) world:vec3f,@location(1) normal:vec3f,@location(2) foam:f32};
@vertex fn liquidVertex(v:MeshIn)->MeshOut{let planet=u.forwardMode.w>.5;var base=v.pos*u.distance.x*1.08;var n=vec3f(0.0,1.0,0.0);if(planet){base=v.pos*120.0;n=normalize(v.pos);}else{base=base+vec3f(floor(u.cameraTime.x/8.0)*8.0,0.0,floor(u.cameraTime.z/8.0)*8.0);}let a=waveSample(base.xz,u.cascade0,0u);let b=waveSample(base.xz,u.cascade1,1u);let c=waveSample(base.xz,u.cascade2,2u);let disp=a.displacement.xyz*u.cascade0.z+b.displacement.xyz*u.cascade1.z+c.displacement.xyz*u.cascade2.z;let slope=a.normalFoam.xz*u.cascade0.z+b.normalFoam.xz*u.cascade1.z+c.normalFoam.xz*u.cascade2.z;var world=base+disp;if(planet){world=base+n*disp.y;let tangent=normalize(cross(vec3f(.2,1.0,.1),n));let bitangent=cross(n,tangent);n=normalize(n+tangent*slope.x+bitangent*slope.y);}else{n=normalize(vec3f(slope.x,1.0,slope.y));}var o:MeshOut;o.position=u.vp*vec4f(world,1.0);o.world=world;o.normal=n;o.foam=max(a.normalFoam.w,max(b.normalFoam.w,c.normalFoam.w));return o;}
fn relief(p:vec2f)->f32{let v=surfaceDetail(p).rgb*2.0-1.0;let g=u.pattern.yzw;return dot(v,g)/max(1.0,g.x+g.y+g.z);}
fn fastFresnel(nov:f32)->f32{let q=1.0-sat(nov);let q2=q*q;let q5=q2*q2*q;return sat(mix(u.fresnel.x,u.fresnel.y,mix(q2,q5,u.fresnel.z)));}
@fragment fn liquidFragment(v:MeshOut)->@location(0) vec4f{kineticScreenUV=v.position.xy/u.render.xy;
 let eye=u.cameraTime.xyz-v.world;let dist=length(eye);let view=eye/max(dist,.0001);let planet=u.forwardMode.w>.5;if(!planet&&dist>=u.distance.x){discard;}
 let coord=v.world.xz*u.pattern.x*.07+vec2f(u.cameraTime.w*u.foam.z*.025,-u.cameraTime.w*u.foam.z*.018);let r=relief(coord);let epsilon=1.0/128.0;let gx=relief(coord+vec2f(epsilon,0.0))-r;let gz=relief(coord+vec2f(0.0,epsilon))-r;let detailFade=1.0-smoothstep(u.distance.x*.35,u.distance.x*.85,dist);var n=normalize(v.normal+vec3f(-gx,0.0,-gz)*u.liquid.w*12.0*detailFade);let nov=dot(n,view);if(nov<0.0){n=-n;}
 let reflectedDir=reflect(-view,n);let reflection=envSample(reflectedDir,u.liquid.x*u.extras.x);let f=fastFresnel(abs(nov));let ridge=smoothstep(-.08,.5,r);let trough=smoothstep(.05,.55,-r);var color=u.body.rgb*u.liquid.z*(.65+.35*ridge)*(1.0-trough*.55);color=color*(1.0-f)+reflection*f*u.liquid.y;color=color+reflection*ridge*ridge*u.fresnel.w*.3;
 let rawFoam=smoothstep(.28,.84,v.foam);let breakup=textureSampleLevel(detailTexture,detailSampler,coord*2.17,0.0).a;let lace=textureSampleLevel(detailTexture,detailSampler,coord*4.11+vec2f(.17,-.09),0.0).g;let stream=textureSampleLevel(detailTexture,detailSampler,coord*vec2f(6.2,1.9)+vec2f(u.cameraTime.w*u.foam.z*.04,0.0),0.0).r;let streak=smoothstep(.36,.92,stream)*(.4+.6*u.body.w);let aeration=smoothstep(.05,.42,max(v.foam,ridge*.55+breakup*.32));let filament=rawFoam*smoothstep(.18,.85,mix(breakup,lace,u.foam.w*.5))*mix(.32,1.3,streak)*(.25+.75*ridge)*u.foam.x;let sheetFoam=sat(aeration*(.22+.78*breakup)*(.45+.55*u.foamTint.w));let microFoam=sat((ridge*.55+trough*.2)*u.foam.x*.35);let foamMask=sat(max(filament,max(sheetFoam,microFoam)));let foamColor=u.foamTint.rgb*u.foam.y*(.82+.35*lace)+reflection*.08*sheetFoam;let reflectionUV=envUV(reflectedDir);let foamOpacity=clamp(foamMask,0.0,.94)*maskFor(8u,reflectionUV);color=applyBlend(color,foamColor,foamOpacity,u.blendModes.w,reflectionUV);
 let ambient=u.ambientLight.rgb*u.ambientLight.a*(0.65+0.35*max(n.y,0.0));let spotDir=normalize(u.spotParams.xyz);let spotN=max(dot(n,spotDir),0.0);let spotPow=pow(spotN,mix(1.0,28.0,sat(u.spotParams.w)));let spot=u.spotLight.rgb*u.spotLight.a*spotPow*(0.2+0.8*f);let emissiveMask=sat(ridge*0.35+foamMask*0.75+sheetFoam*0.12);let emissive=u.emissiveLight.rgb*u.emissiveLight.a*emissiveMask;color=color+ambient*(u.body.rgb*0.45+vec3f(0.18))+spot+emissive;
 let cloudCoord=mix(v.world.xz,reflectedDir.xz*90.0,.28)+n.xz*18.0;color=cloudLayer(color,cloudCoord,mix(sky(vec3f(0.0,1.0,0.0)),vec3f(1.0),.18),.62*(.55+.45*f),reflectionUV);
 if(!planet){let fogStart=max(u.distance.x*.15,u.distance.x-u.distance.y);let fade=smoothstep(fogStart,u.distance.x*.96,dist);let seal=smoothstep(u.distance.x*.84,u.distance.x*.975,dist);let density=sat(fade*u.distance.z*(.7+.3*breakup));color=mix(color,sky(-view),max(seal,density));}
 return vec4f(clamp(color,vec3f(0.0),vec3f(60000.0)),1.0);
}
`;

export const MESH_SURFACE=SCENE+/*wgsl*/`
@group(1) @binding(0) var<storage,read> state0:array<vec4f>;
@group(1) @binding(1) var<storage,read> state1:array<vec4f>;
@group(1) @binding(2) var<storage,read> state2:array<vec4f>;
struct Sample{displacement:vec4f,normalFoam:vec4f};
fn sampleState(c:u32,idx:u32,component:u32)->vec4f{if(c==0u){return state0[idx*2u+component];}if(c==1u){return state1[idx*2u+component];}return state2[idx*2u+component];}
fn waveSample(p:vec2f,info:vec4f,c:u32)->Sample{let n=u32(info.x);let f=fract(p/info.y+.5)*info.x;let i=vec2u(floor(f));let j=(i+vec2u(1u))%vec2u(n);let t=fract(f);let ids=vec4u(i.y*n+i.x,i.y*n+j.x,j.y*n+i.x,j.y*n+j.x);var o:Sample;o.displacement=mix(mix(sampleState(c,ids.x,0u),sampleState(c,ids.y,0u),t.x),mix(sampleState(c,ids.z,0u),sampleState(c,ids.w,0u),t.x),t.y);o.normalFoam=mix(mix(sampleState(c,ids.x,1u),sampleState(c,ids.y,1u),t.x),mix(sampleState(c,ids.z,1u),sampleState(c,ids.w,1u),t.x),t.y);return o;}
fn rotX(p:vec3f,a:f32)->vec3f{let c=cos(a);let s=sin(a);return vec3f(p.x,p.y*c-p.z*s,p.y*s+p.z*c);}
fn rotY(p:vec3f,a:f32)->vec3f{let c=cos(a);let s=sin(a);return vec3f(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);}
fn rotZ(p:vec3f,a:f32)->vec3f{let c=cos(a);let s=sin(a);return vec3f(p.x*c-p.y*s,p.x*s+p.y*c,p.z);}
fn transformP(p0:vec3f)->vec3f{var p=p0-u.projectionOrigin.xyz;p=rotX(p,u.projectionRotation.x);p=rotY(p,u.projectionRotation.y);p=rotZ(p,u.projectionRotation.z);p=p*u.projectionScale.xyz*.01+u.projectionOffset.xyz;let w=u.projectionOffset.w;if(w>0.0){p=p+sin(p.yzx*3.1+p.zxy*1.7+vec3f(u.cameraTime.w*.08))*w*.16;}return p;}
fn octEncode(n0:vec3f)->vec2f{var n=n0/(abs(n0.x)+abs(n0.y)+abs(n0.z)+1e-6);var e=n.xy;if(n.z<0.0){e=(vec2f(1.0)-abs(e.yx))*sign(e.xy+vec2f(1e-6));}return e*.5+.5;}
fn cubeMap(n:vec3f)->vec2f{let a=abs(n);var face=0.0;var q=vec2f(0.0);if(a.x>=a.y&&a.x>=a.z){q=vec2f(select(n.z,-n.z,n.x>0.0),n.y)/max(a.x,1e-5);face=select(1.0,0.0,n.x>0.0);}else if(a.y>=a.z){q=vec2f(n.x,select(-n.z,n.z,n.y>0.0))/max(a.y,1e-5);face=select(3.0,2.0,n.y>0.0);}else{q=vec2f(select(-n.x,n.x,n.z>0.0),n.y)/max(a.z,1e-5);face=select(5.0,4.0,n.z>0.0);}let row=floor(face/3.0);let cell=vec2f(face-row*3.0,row);return (cell+(q*.5+.5))/vec2f(3.0,2.0);}
fn dominantMap(p:vec3f,n:vec3f)->vec2f{let a=abs(n);if(a.x>=a.y&&a.x>=a.z){return p.yz;}if(a.y>=a.z){return p.xz;}return p.xy;}
fn tangentMap(p:vec3f,n:vec3f)->vec2f{let basisRef=select(vec3f(0,0,1),vec3f(0,1,0),abs(n.y)<.92);let t=normalize(cross(basisRef,n));let b=cross(n,t);return vec2f(dot(p,t),dot(p,b));}
fn projectorMap(p:vec3f)->vec2f{var d=p;d=rotX(d,-u.projectionRotation.x);d=rotY(d,-u.projectionRotation.y);d=rotZ(d,-u.projectionRotation.z);let z=max(abs(d.z),1e-3);let f=tan(max(.01,u.projectionExtra.x)*.5);return d.xy/(z*f)*.5+.5;}
fn mapping(code:f32,p0:vec3f,n0:vec3f,uv:vec2f)->vec2f{let p=transformP(p0);let n=normalize(n0);let c=i32(round(code));if(c==0){return p.xz;}if(c==1){return p.xy;}if(c==2){return p.yz;}if(c==3){return uv;}let d=normalize(p0-u.projectionOrigin.xyz+vec3f(1e-6));if(c==4){return vec2f(atan2(d.z,d.x)*.159154943+.5,acos(clamp(d.y,-1.0,1.0))*.318309886);}if(c==5){return vec2f(atan2(d.z,d.x)*.159154943+.5,(1.0-d.y)*.5);}if(c==6){return cubeMap(d);}if(c==7){return octEncode(d);}if(c==8){var w=pow(abs(n)+vec3f(1e-4),vec3f(max(.05,u.projectionScale.w)));w=w/max(w.x+w.y+w.z,1e-5);return p.yz*w.x+p.xz*w.y+p.xy*w.z;}if(c==9){return vec2f(atan2(p.z,p.x)*.159154943+.5,p.y);}if(c==10){return vec2f(atan2(p.z,p.x)*.159154943+.5,length(p.xz));}if(c==11){return vec2f(dot(p,vec3f(.754,.569,.326)),dot(p,vec3f(-.438,.812,.389)));}if(c==12){let wp=p0*.01;return vec2f(dot(wp,vec3f(.487,.743,.459)),dot(wp,vec3f(-.721,.221,.657)));}if(c==13){return tangentMap(p,n);}if(c==14){let q=p0-u.cameraTime.xyz;return vec2f(dot(q,u.rightAspect.xyz),dot(q,u.upTan.xyz))*.01;}if(c==15){return projectorMap(p0-u.projectionOrigin.xyz);}if(c==16){let view=normalize(p0-u.cameraTime.xyz);return octEncode(reflect(view,n));}if(c==17){let sph=vec2f(atan2(d.z,d.x)*.159154943+.5,acos(clamp(d.y,-1.0,1.0))*.318309886);let y=sph.y-.5;return vec2f(sph.x,.5+sign(y)*pow(abs(y)*2.0,.38)*.5);}if(c==18){return dominantMap(p,n);}let q=max(1.0,u.projectionOrigin.w);let qn=normalize(round(n*q)/q+vec3f(1e-5));return dominantMap(p,qn);}
fn projectionMask(p:vec3f,n:vec3f)->f32{let code=i32(round(u.projection0.w));if(code==0){return 1.0;}if(code==4){return sat(abs(n.y));}if(code==5){return sat(length(p-u.projectionOrigin.xyz)/max(1.0,u.projectionExtra.z));}let q=fract(transformP(p).xz*.31);let d=textureSampleLevel(detailTexture,detailSampler,q,0.0);if(code==1){return d.r;}if(code==2){return d.g;}return d.b;}
fn wrapProjection(q0:vec2f)->vec2f{var q=q0+u.projectionMisc.xy*u.cameraTime.w*.05;let mode=i32(round(u.projectionMisc.z));if(mode==1){return fract(q);}if(mode==2){let f=fract(q*.5)*2.0;return 1.0-abs(f-1.0);}if(mode==3){return clamp(q,vec2f(0.0),vec2f(1.0));}return q;}
fn masterMap(p:vec3f,n:vec3f,uv:vec2f)->vec2f{let a=mapping(u.projection0.x,p,n,uv);let b=mapping(u.projection0.y,p,n,uv);return wrapProjection(mix(a,b,sat(u.projection0.z*projectionMask(p,n))));}
fn layerMap(code:f32,p:vec3f,n:vec3f,uv:vec2f)->vec2f{if(code<-.5){return masterMap(p,n,uv);}return wrapProjection(mapping(code,p,n,uv));}
struct MeshIn{@location(0) pos:vec3f,@location(1) normal:vec3f,@location(2) uv:vec2f,@location(3) edgeScale:f32};
struct MeshOut{@builtin(position) position:vec4f,@location(0) world:vec3f,@location(1) normal:vec3f,@location(2) uv:vec2f,@location(3) edgeScale:f32,@location(4) waveFoam:f32};
@vertex fn meshVertex(v:MeshIn)->MeshOut{let n=normalize(v.normal);let coord=layerMap(u.projectionLayers.x,v.pos,n,v.uv)*220.0;let a=waveSample(coord,u.cascade0,0u);let b=waveSample(coord,u.cascade1,1u);let c=waveSample(coord,u.cascade2,2u);let height=(a.displacement.y*u.cascade0.z+b.displacement.y*u.cascade1.z+c.displacement.y*u.cascade2.z)*u.projectionExtra.y*.18;let safe=min(abs(height),max(.001,v.edgeScale*u.projectionExtra.w));let world=v.pos+n*safe*sign(height);var o:MeshOut;o.position=u.vp*vec4f(world,1.0);o.world=world;o.normal=n;o.uv=v.uv;o.edgeScale=v.edgeScale;o.waveFoam=max(a.normalFoam.w,max(b.normalFoam.w,c.normalFoam.w));return o;}
fn reliefAt(coord:vec2f)->f32{let q=surfaceDetail(coord*u.pattern.x*.43).rgb*2.0-1.0;return dot(q,u.pattern.yzw)/max(1.0,u.pattern.y+u.pattern.z+u.pattern.w);}
fn fastFresnelMesh(nov:f32)->f32{let q=1.0-sat(nov);let q2=q*q;let q5=q2*q2*q;return sat(mix(u.fresnel.x,u.fresnel.y,mix(q2,q5,u.fresnel.z)));}
@fragment fn meshFragment(v:MeshOut)->@location(0) vec4f{kineticScreenUV=v.position.xy/u.render.xy;let eye=u.cameraTime.xyz-v.world;let dist=length(eye);let view=eye/max(dist,1e-4);var n=normalize(v.normal);let pcoord=layerMap(u.projectionLayers.y,v.world,n,v.uv);let eps=.004;let r=reliefAt(pcoord);let rx=reliefAt(pcoord+vec2f(eps,0))-r;let ry=reliefAt(pcoord+vec2f(0,eps))-r;let basisRef=select(vec3f(0,0,1),vec3f(0,1,0),abs(n.y)<.92);let t=normalize(cross(basisRef,n));let bt=cross(n,t);n=normalize(n+(t*rx+bt*ry)*u.liquid.w*8.0);let nov=abs(dot(n,view));let reflectedDir=reflect(-view,n);let reflectionCode=u.projectionMisc.w;var reflection=vec3f(0.0);if(reflectionCode< -1.5){reflection=envSample(reflectedDir,u.liquid.x*u.extras.x);}else{let ruv=fract(layerMap(reflectionCode,v.world,n,v.uv));reflection=applyNoixture(mixEnvironment(ruv,u.liquid.x*u.extras.x),ruv);}let f=fastFresnelMesh(nov);let ridge=smoothstep(-.08,.5,r);let trough=smoothstep(.05,.55,-r);var color=u.body.rgb*u.liquid.z*(.52+.55*ridge)*(1.0-trough*.6);color=mix(color,reflection*u.liquid.y,f);let fcoord=layerMap(u.projectionLayers.z,v.world,n,v.uv);let fd=textureSampleLevel(detailTexture,detailSampler,fract(fcoord*.57),0.0);var foamMask=sat(smoothstep(.3,.76,v.waveFoam)*u.foam.x+fd.b*.22*ridge);let foamColor=u.foamTint.rgb*u.foam.y*(.65+.5*fd.g);let maskCoord=fract(layerMap(u.projectionRotation.w,v.world,n,v.uv));foamMask=foamMask*maskFor(8u,maskCoord);color=applyBlend(color,foamColor,foamMask,u.blendModes.w,fract(fcoord));let ecoord=layerMap(u.projectionLayers.w,v.world,n,v.uv);let ed=textureSampleLevel(detailTexture,detailSampler,fract(ecoord*.81),0.0);let ambient=u.ambientLight.rgb*u.ambientLight.a*(.55+.45*abs(n.y));let spotDir=normalize(u.spotParams.xyz);let spotPow=pow(max(dot(n,spotDir),0.0),mix(1.0,28.0,sat(u.spotParams.w)));let spot=u.spotLight.rgb*u.spotLight.a*spotPow*(.2+.8*f);let emissive=u.emissiveLight.rgb*u.emissiveLight.a*sat(ridge*.25+ed.b*.7+foamMask*.35);color+=ambient*(u.body.rgb*.35+vec3f(.12))+spot+emissive;let fogStart=max(u.distance.x*.15,u.distance.x-u.distance.y);let fade=smoothstep(fogStart,u.distance.x*.96,dist);color=mix(color,sky(-view),sat(fade*u.distance.z));return vec4f(clamp(color,vec3f(0.0),vec3f(60000.0)),1.0);}
`;

export const POST=STRUCTS+/*wgsl*/`
@group(0) @binding(1) var sceneSampler:sampler;
@group(0) @binding(2) var sceneTexture:texture_2d<f32>;
fn tone(x:vec3f)->vec3f{return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),vec3f(0.0),vec3f(1.0));}
@fragment fn displayFragment(v:QuadOut)->@location(0) vec4f{let stepUV=1.0/vec2f(textureDimensions(sceneTexture));var c=textureSampleLevel(sceneTexture,sceneSampler,v.uv,0.0).rgb;if(u.finish.x>.0001){var glow=vec3f(0.0);for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){let sampleUV=clamp(v.uv+vec2f(f32(x),f32(y))*stepUV*u.finish.z,vec2f(0.0),vec2f(1.0));let s=textureSampleLevel(sceneTexture,sceneSampler,sampleUV,0.0).rgb;glow+=max(s-vec3f(u.finish.y),vec3f(0.0));}}c+=glow*(u.finish.x/9.0);}if(u.finish.w>.0001){let a=textureSampleLevel(sceneTexture,sceneSampler,v.uv+vec2f(stepUV.x,0.0),0.0).rgb;let b=textureSampleLevel(sceneTexture,sceneSampler,v.uv-vec2f(stepUV.x,0.0),0.0).rgb;let d=textureSampleLevel(sceneTexture,sceneSampler,v.uv+vec2f(0.0,stepUV.y),0.0).rgb;let e=textureSampleLevel(sceneTexture,sceneSampler,v.uv-vec2f(0.0,stepUV.y),0.0).rgb;c=max(vec3f(0.0),c+(c-(a+b+d+e)*.25)*u.finish.w);}c=tone(c*u.render.z);c=clamp((c-.5)*u.render.w+.5,vec3f(0.0),vec3f(1.0));return vec4f(pow(c,vec3f(1.0/2.2)),1.0);}
`;

export const SKYSYNTH_GPU=/*wgsl*/`
struct SynthParams {
 wave:vec4f,
 shape:vec4f,
 timing:vec4f
};
@group(0) @binding(0) var<uniform> p:SynthParams;
@group(0) @binding(1) var synthSampler:sampler;
@group(0) @binding(2) var lutTexture:texture_2d<f32>;
@group(0) @binding(3) var previousTexture:texture_2d<f32>;
struct SynthQ { @builtin(position) position:vec4f, @location(0) uv:vec2f };
@vertex fn synthVertex(@builtin(vertex_index) i:u32)->SynthQ {
 let q=vec2f(f32((i<<1u)&2u),f32(i&2u));
 var o:SynthQ;
 o.position=vec4f(q*2.0-1.0,0.0,1.0);
 o.uv=vec2f(q.x,1.0-q.y);
 return o;
}
fn planarField(x:f32,y:f32,t:f32)->f32 {
 return (sin(x*p.wave.y+t)+sin(y*p.wave.x-t*1.2)+sin((x+y)*p.wave.w+t*.6)+sin(length(vec2f(x-18.0,y-12.0))*p.wave.z-t))*.25;
}
fn sphereField(uv:vec2f,t:f32)->f32 {
 let lon=6.283185307*uv.x;
 let lat=3.141592654*uv.y;
 let sp=sin(lat);
 let x=18.0+18.0*sp*cos(lon);
 let y=12.0+12.0*cos(lat);
 let z=sp*sin(lon);
 let warp=p.shape.x*sin(z*4.0+t*.17);
 return planarField(x+warp*3.0,y+warp*2.0,t+z*.35);
}
@fragment fn synthFragment(v:SynthQ)->@location(0) vec4f {
 let value=sphereField(v.uv,p.shape.w);
 let field=.5+.5*tanh(value*p.shape.y);
 let lutU=fract(field+p.timing.x);
 let lut=textureSampleLevel(lutTexture,synthSampler,vec2f(lutU,.5),0.0).rgb;
 let bright=.3+field*field*.7;
 let current=vec4f(lut*p.shape.z*bright,1.0);
 if(p.timing.z>.5){return current;}
 let previous=textureSampleLevel(previousTexture,synthSampler,v.uv,0.0);
 return mix(previous,current,clamp(p.timing.y,0.0,1.0));
}
`;

export const ENV_RECONSTRUCT=/*wgsl*/`
struct ReconParams { a:vec4f, b:vec4f };
@group(0) @binding(0) var linearSampler:sampler;
@group(0) @binding(1) var sourceTexture:texture_2d<f32>;
@group(0) @binding(2) var<uniform> p:ReconParams;
struct Q { @builtin(position) position:vec4f, @location(0) uv:vec2f };
@vertex fn reconVertex(@builtin(vertex_index) i:u32)->Q {let q=vec2f(f32((i<<1u)&2u),f32(i&2u));var o:Q;o.position=vec4f(q*2.0-1.0,0.0,1.0);o.uv=vec2f(q.x,1.0-q.y);return o;}
fn wrapX(x:i32,w:i32)->i32{return ((x%w)+w)%w;}
fn fetch(x:i32,y:i32)->vec4f{let d=textureDimensions(sourceTexture);return textureLoad(sourceTexture,vec2i(wrapX(x,i32(d.x)),clamp(y,0,i32(d.y)-1)),0);}
fn nearestSample(uv:vec2f)->vec4f{let d=vec2f(textureDimensions(sourceTexture));let q=vec2i(floor(uv*d));return fetch(q.x,q.y);}
fn smoothSample(uv:vec2f)->vec4f{let d=vec2f(textureDimensions(sourceTexture));let q=uv*d-.5;let f=fract(q);let s=f*f*(3.0-2.0*f);return textureSampleLevel(sourceTexture,linearSampler,(floor(q)+s+.5)/d,0.0);}
fn cubicWeight(x:f32,a:f32)->f32{let q=abs(x);if(q<1.0){return (a+2.0)*q*q*q-(a+3.0)*q*q+1.0;}if(q<2.0){return a*q*q*q-5.0*a*q*q+8.0*a*q-4.0*a;}return 0.0;}
fn cubicSample(uv:vec2f,a:f32)->vec4f{let d=vec2f(textureDimensions(sourceTexture));let q=uv*d-.5;let b=vec2i(floor(q));let f=fract(q);var sum=vec4f(0.0);var weight=0.0;for(var yy:i32=-1;yy<=2;yy++){for(var xx:i32=-1;xx<=2;xx++){let w=cubicWeight(f.x-f32(xx),a)*cubicWeight(f.y-f32(yy),a);sum+=fetch(b.x+xx,b.y+yy)*w;weight+=w;}}return sum/max(abs(weight),1e-6);}
fn sincApprox(x:f32)->f32{let ax=abs(x);if(ax<1e-5){return 1.0;}let z=3.14159265*x;return sin(z)/z;}
fn lanczos2(uv:vec2f)->vec4f{let d=vec2f(textureDimensions(sourceTexture));let q=uv*d-.5;let b=vec2i(floor(q));let f=fract(q);var sum=vec4f(0.0);var weight=0.0;for(var yy:i32=-1;yy<=2;yy++){for(var xx:i32=-1;xx<=2;xx++){let dx=f.x-f32(xx);let dy=f.y-f32(yy);let wx=select(0.0,sincApprox(dx)*sincApprox(dx*.5),abs(dx)<2.0);let wy=select(0.0,sincApprox(dy)*sincApprox(dy*.5),abs(dy)<2.0);let w=wx*wy;sum+=fetch(b.x+xx,b.y+yy)*w;weight+=w;}}return sum/max(abs(weight),1e-6);}
fn nlSample(uv:vec2f)->vec4f{let d=vec2f(textureDimensions(sourceTexture));let px=1.0/d;let c=textureSampleLevel(sourceTexture,linearSampler,uv,0.0);let k=mix(2.0,18.0,clamp(p.a.y,0.0,1.5)/1.5);var acc=c;var total=1.0;let radius=max(1.0,p.a.z);let offs=array<vec2f,8>(vec2f(1,0),vec2f(-1,0),vec2f(0,1),vec2f(0,-1),vec2f(1,1),vec2f(-1,1),vec2f(1,-1),vec2f(-1,-1));for(var i=0u;i<8u;i++){let sampleValue=textureSampleLevel(sourceTexture,linearSampler,uv+offs[i]*px*radius,0.0);let diff=sampleValue.rgb-c.rgb;let w=1.0/(1.0+dot(diff,diff)*k);acc+=sampleValue*w;total+=w;}let filtered=acc/total;return mix(c,filtered,clamp(p.a.y,0.0,1.0));}
fn spatialSample(uv:vec2f)->vec4f{let d=vec2f(textureDimensions(sourceTexture));let px=1.0/d;let c=textureSampleLevel(sourceTexture,linearSampler,uv,0.0);let left=textureSampleLevel(sourceTexture,linearSampler,uv-vec2f(px.x,0.0),0.0);let right=textureSampleLevel(sourceTexture,linearSampler,uv+vec2f(px.x,0.0),0.0);let up=textureSampleLevel(sourceTexture,linearSampler,uv-vec2f(0.0,px.y),0.0);let down=textureSampleLevel(sourceTexture,linearSampler,uv+vec2f(0.0,px.y),0.0);let filtered=c*.5+(left+right+up+down)*.125;return mix(c,filtered,clamp(p.a.y,0.0,1.0));}
@fragment fn reconFragment(v:Q)->@location(0) vec4f{let mode=p.a.x;if(mode<.5){return nearestSample(v.uv);}if(mode<1.5){return textureSampleLevel(sourceTexture,linearSampler,v.uv,0.0);}if(mode<2.5){return smoothSample(v.uv);}if(mode<3.5){return cubicSample(v.uv,0.0);}if(mode<4.5){return cubicSample(v.uv,-.5);}if(mode<5.5){return lanczos2(v.uv);}if(mode<6.5){return nlSample(v.uv);}return spatialSample(v.uv);}
`;

export const ENV_PREVIEW=SCENE+/*wgsl*/`
fn previewTone(x:vec3f)->vec3f{return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),vec3f(0.0),vec3f(1.0));}
@fragment fn previewFragment(v:QuadOut)->@location(0) vec4f{kineticScreenUV=v.uv;
 let lon=(v.uv.x-.5)*6.283185307;let lat=v.uv.y*3.141592654;let d=vec3f(sin(lat)*cos(lon),cos(lat),sin(lat)*sin(lon));let c=previewTone(sky(d)*u.render.z);return vec4f(pow(c,vec3f(1.0/2.2)),1.0);
}
`;
