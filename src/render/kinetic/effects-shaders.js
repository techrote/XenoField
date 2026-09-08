import {COMMON} from './common.js';
export const MASK_ROUTE=COMMON+/*wgsl*/`@fragment fn main(v:Q)->@location(0) vec4f{return vec4f(routed(v.uv),1.0);}`;
export const DEPTH_FX=COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{let uv=v.uv;let c=tap(image,uv).rgb;let d=remapDepth(depthAt(uv));let edge=depthEdge(uv);let mode=i32(k.p[31].x);let tint=k.p[32].rgb;var layer=tint*d;var weight=1.0;
 if(mode==1){layer=tap(lutTex,vec2f(fract(d+k.p[41].y),.5)).rgb*max(1.0,luminance(c));}
 if(mode==2){let q=max(2.0,k.p[12].y);layer=floor(c*q)/q;weight=d;}
 if(mode==3){layer=tint*depthBand(uv);}
 if(mode==4){let f=abs(fract(d*k.p[12].x+k.p[12].z)-.5)*2.0;let width=clamp(length(depthGrad(uv))*k.p[12].x,.015,.45);layer=tint;weight=1.0-gate(f,width,k.p[13].y*.2);}
 if(mode==5){layer=c+tint*edge;}
 if(mode==6){layer=c*(1.0-edge);}
 if(mode==7){layer=vec3f(luminance(c));weight=d;}
 if(mode==8){layer=hue(c,d*k.p[32].w*6.2831853);}
 if(mode==9){layer=tint;weight=d;}
 if(mode==10){layer=vec3f(1.0)-c/max(vec3f(1.0),c);weight=1.0-d;}
 let b=i32(k.p[31].w);var mixed=blend(c,layer,k.p[31].w);if(b==5){mixed=c*exp(-max(vec3f(0.0),layer));}let m=effectMask(k.p[45].y,uv)*sat(k.p[31].y*weight);return bounded(vec4f(mix(c,mixed,m),1.0));}
`;
export const VOLUME_COMPOSITE=COMMON+/*wgsl*/`
fn volumeUpsample(uv:vec2f)->vec4f{let size=vec2f(textureDimensions(volumeTex));let p=uv*size-.5;let base=floor(p);let f=fract(p);var col=vec4f(0.0);var sum=0.0;let d=depthAt(uv);
 for(var y=0;y<2;y++){for(var x=0;x<2;x++){let q=(base+vec2f(f32(x),f32(y))+.5)/size;let a=tap(volumeTex,q);let sampleD=depthAt(q);let volumeD=at(extraTex,q).r;let spatial=select(1.0-f.x,f.x,x==1)*select(1.0-f.y,f.y,y==1);let edge=exp(-min(30.0,abs(sampleD-d)/max(1.0,d)*40.0));let visible=select(1.0,0.0,k.p[30].z>.5&&volumeD>d+max(.1,k.p[30].w));let w=spatial*edge*visible;col+=a*w;sum+=w;}}
 return col/max(.00001,sum);}
@fragment fn main(v:Q)->@location(0) vec4f{let uv=v.uv;let c=tap(image,uv).rgb;let vcol=volumeUpsample(uv);let mode=i32(k.p[30].x);let scale=k.p[27].w;let a=tap(atlasTex,fract(uv*vec2f(scale*.02,scale*.011)));let src=i32(k.p[27].y);var detail=a.g;if(src==1){detail=hash(vec3f(floor(uv*scale),floor(k.p[4].w*k.p[20].x)));}if(src==2){detail=stochastic(uv*k.p[9].xy,2.0,floor(k.p[4].w*k.p[20].x));}if(src==3){detail=sat((a.r-.5)*k.p[51].y+.5);}if(src==4){detail=depthEdge(uv);}if(src==5){detail=normalEdge(uv);}if(src==6){detail=a.b*a.a;}
 let micro=max(0.0,mix(1.0,detail*2.0,k.p[27].x));let alpha=sat(vcol.a*micro);let radiance=vcol.rgb*micro;let m=effectMask(k.p[45].x,uv)*k.p[30].y;var outColor=c*(1.0-alpha)+radiance;
 if(mode==1){outColor=c+radiance;}if(mode==2){outColor=blend(c,radiance,2.0);}if(mode==3){outColor=c*mix(vec3f(1.0),radiance,alpha);}if(mode==4){outColor=abs(c-radiance);}if(mode==5){outColor=c*exp(-alpha*k.p[20].z*3.0)+radiance*.05;}if(mode==6){let px=1.0/vec2f(textureDimensions(volumeTex));let grad=vec2f(tap(volumeTex,uv+vec2f(px.x,0)).a-tap(volumeTex,uv-vec2f(px.x,0)).a,tap(volumeTex,uv+vec2f(0,px.y)).a-tap(volumeTex,uv-vec2f(0,px.y)).a);outColor=tap(image,uv+grad*k.p[33].x/k.p[9].xy).rgb+radiance*.1;}if(mode==7){outColor=mix(c,tap(lutTex,vec2f(fract(alpha+k.p[41].y),.5)).rgb*max(1.0,luminance(c)),alpha);}if(mode==8){outColor=c*alpha;}
 return bounded(vec4f(mix(c,outColor,sat(m)),1.0));}
`;
export const DISTORTION_COMMON=/*wgsl*/`
fn vectorAt(uv:vec2f)->vec2f{let src=i32(k.p[35].x);var v=at(auxTex,uv).xy;if(src==1){v=depthGrad(uv);}if(src==2){let p=1.0/vec2f(textureDimensions(signalTex));v=vec2f(tap(signalTex,uv+vec2f(p.x,0)).r-tap(signalTex,uv-vec2f(p.x,0)).r,tap(signalTex,uv+vec2f(0,p.y)).r-tap(signalTex,uv-vec2f(0,p.y)).r);}if(src==3){let q=uv*k.p[33].y*6.2831853+k.p[35].y*6.2831853+k.p[4].w*k.p[35].w;v=vec2f(sin(q.y+cos(q.x)),cos(q.x+sin(q.y)));}if(src==4){let p=1.0/k.p[9].xy;v=vec2f(routed(uv+vec2f(p.x,0)).z-routed(uv-vec2f(p.x,0)).z,routed(uv+vec2f(0,p.y)).z-routed(uv-vec2f(0,p.y)).z);}if(src==5){let a=tap(image,uv).rgb-tap(historyTex,uv).rgb;v=vec2f(a.r-a.b,a.g-a.b);}if(src==6||src==7){v=tap(atlasTex,fract(uv*k.p[33].y+k.p[4].w*k.p[35].w*.01)).rg*2.0-1.0;}
 let co=cos(k.p[35].z);let si=sin(k.p[35].z);v=vec2f(v.x*co-v.y*si,v.x*si+v.y*co);return v*gate(length(v),k.p[33].w,.03)*(1.0+remapDepth(depthAt(uv))*k.p[33].z);}
fn guardedOffset(uv:vec2f,offset:vec2f)->vec2f{let q=clamp(uv+offset,vec2f(0.0),vec2f(1.0));if(k.p[46].w>.5){let d=depthAt(uv);let other=depthAt(q);let ok=1.0-gate(abs(other-d)/max(1.0,d),.08,.04);return mix(uv,q,ok);}return q;}
`;
export const DISTORTION=COMMON+DISTORTION_COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{let uv=v.uv;let offset=vectorAt(uv)*k.p[33].x/k.p[9].xy*effectMask(k.p[45].z,uv);let co=k.p[34];let r=tap(image,guardedOffset(uv,offset*(1.0+co.x*co.y))).r;let g=tap(image,guardedOffset(uv,offset*(1.0+co.x*co.z))).g;let b=tap(image,guardedOffset(uv,offset*(1.0+co.x*co.w))).b;return bounded(vec4f(r,g,b,1.0));}
`;
export function bloomMaskShader(dark=false){return COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{${dark?'let signal=effectMask(k.p[40].w,v.uv);let c=vec3f(gate(signal,k.p[40].y,.08));':'let signal=effectMask(k.p[39].w,v.uv);let c=max(vec3f(0.0),tap(image,v.uv).rgb-k.p[39].y)*signal;'}return bounded(vec4f(c,1.0));}
`;}
export function bloomBlurShader(dark=false,vertical=false){return COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{let radius=k.p[${dark?40:39}].z;let step=vec2f(${vertical?'0.0,radius/k.p[9].y':'radius/k.p[9].x,0.0'})/3.0;var color=tap(image,v.uv).rgb;var total=1.0;for(var i=1;i<=4;i++){let fi=f32(i);let w=exp(-fi*fi/4.5);color+=(tap(image,v.uv+step*fi).rgb+tap(image,v.uv-step*fi).rgb)*w;total+=2.0*w;}return bounded(vec4f(color/total,1.0));}
`;}
export function bloomCompositeShader(dark=false){return COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{let base=tap(image,v.uv).rgb;let spread=linearLoad(extraTex,v.uv).rgb;return bounded(vec4f(${dark?'base*exp(-spread*k.p[40].x*2.0)':'base+spread*k.p[39].x'},1.0));}
`;}
export const COLOUR=COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{let c=tap(image,v.uv).rgb;let value=effectMask(k.p[41].w,v.uv);let q=fract(value+k.p[41].y+k.p[4].w*k.p[41].z);let tint=tap(lutTex,vec2f(q,.5)).rgb;return bounded(vec4f(mix(c,tint*max(1.0,luminance(c)),k.p[41].x*sat(value)),1.0));}
`;
export const AA_RESOLVE=COMMON+/*wgsl*/`
fn sinc(x:f32)->f32{if(abs(x)<.00001){return 1.0;}return sin(x*3.14159265)/(x*3.14159265);}
fn cubic(x:f32)->f32{let a=abs(x);if(a<=1.0){return (1.5*a-2.5)*a*a+1.0;}if(a<2.0){return ((-.5*a+2.5)*a-4.0)*a+2.0;}return 0.0;}
@fragment fn main(v:Q)->@location(0) vec4f{let mode=i32(k.p[47].x);if(mode==1){return tap(image,v.uv);}let dims=vec2f(textureDimensions(image));let footprint=max(vec2f(1.0),dims/k.p[47].yz);let centre=v.uv*dims;let radius=select(footprint*.5,footprint*2.0,mode>=2);let begin=vec2i(floor(centre-radius));let end=vec2i(ceil(centre+radius));var sum=vec4f(0.0);var weight=0.0;
 for(var y=0;y<20;y++){for(var x=0;x<20;x++){let p=begin+vec2i(x,y);if(any(p>=end)){continue;}let offset=(vec2f(p)+.5-centre)/footprint;var w=0.0;if(mode==0){let lo=max(vec2f(p),centre-footprint*.5);let hi=min(vec2f(p)+1.0,centre+footprint*.5);let overlap=max(vec2f(0.0),hi-lo);w=overlap.x*overlap.y;}else if(mode==2){w=cubic(offset.x)*cubic(offset.y);}else if(all(abs(offset)<vec2f(2.0))){w=sinc(offset.x)*sinc(offset.x*.5)*sinc(offset.y)*sinc(offset.y*.5);}sum+=textureLoad(image,clamp(p,vec2i(0),vec2i(dims)-1),0)*w;weight+=w;}}
 return bounded(sum/max(.00001,weight));}
`;
export const DEBUG_VIEW=COMMON+DISTORTION_COMMON+/*wgsl*/`
@fragment fn main(v:Q)->@location(0) vec4f{let uv=v.uv;let mode=i32(k.p[46].x);var c=tap(image,uv).rgb;
 if(mode==1){c=vec3f(remapDepth(depthAt(uv)));}if(mode==2){let level=i32(min(k.p[46].y,k.p[47].w-1.0));let dim=textureDimensions(pyramidTex,level);c=vec3f(remapDepth(textureLoad(pyramidTex,clamp(vec2i(uv*vec2f(dim)),vec2i(0),vec2i(dim)-1),level).r));}if(mode==3||mode==4){c=at(auxTex,uv).rgb*.5+.5;}if(mode==5){c=vec3f(at(auxTex,uv).a);}if(mode>=6&&mode<=9){let sig=tap(signalTex,uv);c=vec3f(sig[u32(mode-6)]);}if(mode==10){c=tap(volumeTex,uv).rgb;}if(mode==11){c=tap(historyTex,uv).rgb;}if(mode==12){let d=depthAt(uv);let prev=previousUV(uv,d);let accept=historyConfidence(prev.xy,prev.z);c=vec3f(1.0-accept,accept*.7,0.0);}if(mode==13){c=tap(feedbackTex,uv).rgb;}if(mode==14||mode==15){c=linearLoad(extraTex,uv).rgb;}if(mode==16){c=vec3f(vectorAt(uv)*.5+.5,.5);}if(mode==17){c=routed(uv);}
 return bounded(vec4f(c,1.0));}
`;
