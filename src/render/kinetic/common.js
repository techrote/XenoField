import {MASK_SOURCES,MASK_MIX_MODES,CHOICES} from '../../core/parameters.js';
import {hexRGB,srgbToLinear} from '../../core/lut.js';
export const KINETIC_UNIFORM_BYTES=80*16;
export const code=(key,value)=>Math.max(0,CHOICES[key]?.indexOf(value)??0);
export const maskCode=value=>value==='router'?-1:Math.max(0,MASK_SOURCES.indexOf(value));
export function packKinetic(s,r,graph,dt){
 const p=new Float32Array(320),put=(i,v)=>p.set(v,i*4),rgb=h=>hexRGB(h).map(srgbToLinear),a=r.uniforms;
 p.set(graph.previousVP||a.subarray(0,16),0);
 put(4,[...a.subarray(16,19),graph.time]);put(5,[...a.subarray(20,24)]);put(6,[...a.subarray(24,28)]);put(7,[...a.subarray(28,31),Math.max(4000,s.drawDistance*1.8)]);
 put(8,[...(graph.previousCamera||a.subarray(16,19)),graph.historyValid?1:0]);put(9,[r.width,r.height,r.frames,s.paused?0:Math.min(.25,Math.max(1/240,dt))]);
 put(10,[...(r.frameJitter||[0,0]),...(graph.previousJitter||[0,0])]);
 put(11,[s.depthNear,s.depthFar,s.depthGamma,s.depthInvert?1:0]);put(12,[s.depthBands,s.depthQuantize,s.depthPhase+graph.time*s.depthDrift,s.depthRadius]);put(13,[s.depthEdge,s.depthSoftness,s.depthThreshold,s.depthPyramidEnabled?1:0]);
 put(14,[s.temporalWeight,s.temporalDepthReject,s.temporalLumaReject,s.temporalClamp]);put(15,[s.temporalSamples==='off'?32:+s.temporalSamples,s.temporalResponse,0,0]);
 put(16,[+s.volumeResolution,+s.volumeSteps,+s.volumeRenderScale,code('volumeSpace',s.volumeSpace)]);put(17,[s.volumeDensity,s.volumeCoverage,s.volumeThreshold,s.volumeSoftness]);put(18,[s.volumeScale,s.volumeDetail,s.volumeWarp,s.volumePower]);put(19,[s.volumeQuantize,s.volumeDropout,code('volumeDitherType',s.volumeDitherType),s.volumeDither]);
 put(20,[s.volumePhaseSpeed,s.volumeEmission,s.volumeAbsorption,s.volumeRim]);put(21,[...rgb(s.volumeColor),s.volumeEnvironment]);put(22,[...rgb(s.volumeLightColor),s.volumeAmbient]);put(23,[s.volumeShellOffset,s.volumeShellThickness,s.volumeRange,s.volumeSize]);put(24,[s.volumeOffsetX,s.volumeOffsetY,s.volumeOffsetZ,code('volumeSource',s.volumeSource)]);
 put(25,[code('volumeLighting',s.volumeLighting),s.volumeLightSteps,s.volumeAttenuation,s.volumeSpeed]);put(26,[code('volumeShape',s.volumeShape),s.volumeInvert?1:0,s.volumePhase,s.volumePosterize]);put(27,[s.volumeMicrodetail,code('volumeMicroSource',s.volumeMicroSource),s.volumeCellEdges,s.volumeMicroScale]);put(28,[...a.subarray(136,139),s.volumeRim]);
 put(29,[graph.volume?.blend??1,s.volumeInterpolate?1:0,s.volumeInterpolation==='nearest'?0:1,s.volumeSlices]);put(30,[code('volumeBlend',s.volumeBlend),s.volumeAmount,s.volumeDepthClip?1:0,s.volumeDepthSoftness]);
 put(31,[code('depthOperator',s.depthOperator),s.depthAmount,0,code('depthBlend',s.depthBlend)]);put(32,[...rgb(s.depthColor),s.depthHue]);put(33,[s.distortionStrength,s.distortionScale,s.distortionDepth,s.distortionThreshold]);put(34,[s.distortionChromatic,s.distortionR,s.distortionG,s.distortionB]);put(35,[code('distortionSource',s.distortionSource),s.distortionPhase,s.distortionDirection*Math.PI/180,s.distortionDrift]);
 put(36,[s.feedbackAmount,s.feedbackDecay,s.feedbackGain,s.feedbackHue*Math.PI/180]);put(37,[s.feedbackZoom,s.feedbackRotation*Math.PI/180,s.feedbackX,s.feedbackY]);put(38,[s.feedbackWarp,s.feedbackDepthReject?1:0,code('feedbackBlend',s.feedbackBlend),maskCode(s.feedbackMask)]);
 put(39,[s.positiveAmount,s.positiveThreshold,s.positiveRadius,maskCode(s.positiveMask)]);put(40,[s.darkAmount,s.darkThreshold,s.darkRadius,maskCode(s.darkMask)]);put(41,[s.colourAmount,s.colourPhase,s.colourSpeed,maskCode(s.colourMask)]);
 put(42,[maskCode(s.maskSourceA),maskCode(s.maskSourceB),s.maskSourceMix,Math.max(0,MASK_MIX_MODES.indexOf(s.maskMixMode))]);put(43,[s.maskBrightness,s.maskContrast,s.maskGamma,s.maskThreshold]);put(44,[s.maskSoftness,s.maskInvert?1:0,s.maskEnabled?1:0,s.maskScale]);put(45,[maskCode(s.volumeMask),maskCode(s.depthMask),maskCode(s.distortionMask),s.volumeUseMask?1:0]);
 put(46,[code('kineticDebug',s.kineticDebug),Math.min(s.debugMip,Math.max(0,(graph.aux?.mipCount||1)-1)),s.feedbackThreshold,s.distortionDepthGuard?1:0]);put(47,[code('downsampleFilter',s.downsampleFilter),r.outputWidth,r.outputHeight,graph.aux?.mipCount||1]);put(48,[code('volumeSourceB',s.volumeSourceB),s.volumeSourceMix,code('volumeGeneratorBlend',s.volumeGeneratorBlend),s.volumeStepQuantize]);
 put(49,[s.projectionScaleX,s.projectionScaleY,s.projectionScaleZ,s.meshScale]);put(50,[s.projectionOffsetX,s.projectionOffsetY,s.projectionOffsetZ,code('projectionA',s.projectionA)]);put(51,[s.noixtureScale,s.noixtureContrast,code('noixtureMode',s.noixtureMode),s.noixtureDrift]);put(52,[s.mixerMix,r.hdriAvailable?1:0,s.envMode==='hdri'?1:0,s.mixerEnabled?1:0]);
 put(53,[s.feedbackPersistence,0,0,0]);
 const rad=Math.PI/180;put(54,[s.projectionOriginX,s.projectionOriginY,s.projectionOriginZ,s.projectionQuantize]);put(55,[s.projectionRotationX*rad,s.projectionRotationY*rad,s.projectionRotationZ*rad,0]);put(56,[s.projectionScaleX,s.projectionScaleY,s.projectionScaleZ,s.projectionSharpness]);put(57,[s.projectionOffsetX,s.projectionOffsetY,s.projectionOffsetZ,s.projectionWarp]);put(58,[code('projectionA',s.projectionA),code('projectionB',s.projectionB),s.projectionMix,code('projectionMaskSource',s.projectionMaskSource)]);put(59,[s.projectorFov*rad,s.projectionDisplacement,s.meshScale,s.projectionDisplacementSafety]);put(60,[s.projectionDriftX,s.projectionDriftY,code('projectionWrap',s.projectionWrap),0]);
 put(61,[s.procCloudDensity,s.procCloudCoverage,s.procCloudScale,s.procCloudAltitude]);
 put(62,[s.procCloudDetail,s.procCloudShadowDark,s.procCloudSunIntensity,s.procCloudHeight]);
 put(63,[graph.cloud?.blend??1,s.procCloudCacheSmooth,s.procCloudSkipLight?1:0,s.procCloudOpacity]);
 put(64,[s.procCloudCenterX,s.procCloudCenterY,s.procCloudCenterZ,s.procCloudRaySteps]);
 put(65,[s.procCloudSizeX,s.procCloudSizeY,s.procCloudSizeZ,s.procCloudLightSteps]);
 put(66,[s.procCloudDepthClip?1:0,s.procCloudDepthSoftness,s.procCloudShowBounds?1:0,s.procCloudEditActive?1:0]);
 put(67,[graph.cloud?.cloudTime??graph.time*s.procCloudWindSpeed,s.procCloudCacheRes,s.procCloudCacheUpdate,s.procCloudRenderScale]);
 put(68,[code('procCloudTransformMode',s.procCloudTransformMode),code('procCloudTransformAxis',s.procCloudTransformAxis),s.procCloudDragSensitivity,0]);
 return p;
}
export const COMMON=/*wgsl*/`
struct Params { p:array<vec4f,80> }; @group(0) @binding(0) var<uniform> k:Params;
@group(0) @binding(1) var samp:sampler;
@group(0) @binding(2) var image:texture_2d<f32>;
@group(0) @binding(3) var depthTex:texture_2d<f32>;
@group(0) @binding(4) var auxTex:texture_2d<f32>;
@group(0) @binding(5) var volumeTex:texture_2d<f32>;
@group(0) @binding(6) var signalTex:texture_2d<f32>;
@group(0) @binding(7) var historyTex:texture_2d<f32>;
@group(0) @binding(8) var historyDepth:texture_2d<f32>;
@group(0) @binding(9) var feedbackTex:texture_2d<f32>;
@group(0) @binding(10) var atlasTex:texture_2d<f32>;
@group(0) @binding(11) var environmentTex:texture_2d<f32>;
@group(0) @binding(12) var lutTex:texture_2d<f32>;
@group(0) @binding(13) var noiseTex:texture_2d<f32>;
@group(0) @binding(14) var pyramidTex:texture_2d<f32>;
@group(0) @binding(15) var extraTex:texture_2d<f32>;
@group(0) @binding(16) var routerTex:texture_2d<f32>;
@group(0) @binding(17) var hdriTex:texture_2d<f32>;
struct Q { @builtin(position) position:vec4f,@location(0) uv:vec2f };
@vertex fn quad(@builtin(vertex_index) i:u32)->Q{let p=vec2f(f32((i<<1u)&2u),f32(i&2u));var o:Q;o.position=vec4f(p*2.0-1.0,0.0,1.0);o.uv=vec2f(p.x,1.0-p.y);return o;}
fn sat(x:f32)->f32{return clamp(x,0.0,1.0);}
fn luminance(c:vec3f)->f32{return dot(c,vec3f(.2126,.7152,.0722));}
fn bounded(c:vec4f)->vec4f{return clamp(c,vec4f(0.0),vec4f(60000.0));}
fn hash(p:vec3f)->f32{return fract(sin(dot(p,vec3f(127.1,311.7,74.7)))*43758.5453);}
fn at(t:texture_2d<f32>,uv:vec2f)->vec4f{let dim=vec2i(textureDimensions(t));return textureLoad(t,clamp(vec2i(floor(uv*vec2f(dim))),vec2i(0),dim-1),0);}
fn tap(t:texture_2d<f32>,uv:vec2f)->vec4f{return textureSampleLevel(t,samp,clamp(uv,vec2f(0.0),vec2f(1.0)),0.0);}
fn linearLoad(t:texture_2d<f32>,uv:vec2f)->vec4f{let d=vec2i(textureDimensions(t));let p=uv*vec2f(d)-.5;let i=vec2i(floor(p));let f=fract(p);return mix(mix(textureLoad(t,clamp(i,vec2i(0),d-1),0),textureLoad(t,clamp(i+vec2i(1,0),vec2i(0),d-1),0),f.x),mix(textureLoad(t,clamp(i+vec2i(0,1),vec2i(0),d-1),0),textureLoad(t,clamp(i+vec2i(1,1),vec2i(0),d-1),0),f.x),f.y);}
fn depthAt(uv:vec2f)->f32{return at(depthTex,uv).r;}
fn remapDepth(d:f32)->f32{let delta=k.p[11].y-k.p[11].x;let denom=select(max(delta,.0001),min(delta,-.0001),delta<0.0);var x=pow(sat((d-k.p[11].x)/denom),1.0/max(.05,k.p[11].z));if(k.p[11].w>.5){x=1.0-x;}return x;}
fn gate(x:f32,t:f32,w:f32)->f32{if(w<.00001){return select(0.0,1.0,x>=t);}return smoothstep(t-w,t+w,x);}
fn depthGrad(uv:vec2f)->vec2f{let px=max(1.0,k.p[12].w)/k.p[9].xy;let d=max(1.0,depthAt(uv));return vec2f(depthAt(uv+vec2f(px.x,0.0))-depthAt(uv-vec2f(px.x,0.0)),depthAt(uv+vec2f(0.0,px.y))-depthAt(uv-vec2f(0.0,px.y)))/d;}
fn depthEdge(uv:vec2f)->f32{return sat(length(depthGrad(uv))*k.p[13].x);}
fn normalEdge(uv:vec2f)->f32{let px=max(1.0,k.p[12].w)/k.p[9].xy;let n=at(auxTex,uv).xyz;return sat(length(n-at(auxTex,uv+vec2f(px.x,0.0)).xyz)+length(n-at(auxTex,uv+vec2f(0.0,px.y)).xyz));}
fn depthBand(uv:vec2f)->f32{return gate(.5+.5*sin((remapDepth(depthAt(uv))*k.p[12].x+k.p[12].z)*6.2831853),k.p[13].z,k.p[13].y);}
fn ray(uv:vec2f)->vec3f{let q=uv-k.p[10].xy/k.p[9].xy;return normalize(k.p[7].xyz+k.p[5].xyz*(q.x*2.0-1.0)*k.p[5].w*k.p[6].w+k.p[6].xyz*(1.0-q.y*2.0)*k.p[6].w);}
fn previousUV(uv:vec2f,d:f32)->vec3f{let w=k.p[4].xyz+ray(uv)*d;let vp=mat4x4f(k.p[0],k.p[1],k.p[2],k.p[3]);let clip=vp*vec4f(w,1.0);if(clip.w<=.00001){return vec3f(-1.0,-1.0,0.0);}return vec3f(clip.xy/clip.w*vec2f(.5,-.5)+.5,length(w-k.p[8].xyz));}
fn historyConfidence(uv:vec2f,d:f32)->f32{if(k.p[8].w<.5||any(uv<vec2f(0.0))||any(uv>vec2f(1.0))){return 0.0;}let old=at(historyDepth,uv).r;let isSky=d>=k.p[7].w*.98;let wasSky=old>=k.p[7].w*.98;if(isSky!=wasSky){return 0.0;}if(isSky){return 1.0;}return 1.0-gate(abs(old-d)/max(1.0,d),k.p[14].y,k.p[14].y*.35);}
fn hue(c:vec3f,angle:f32)->vec3f{let axis=normalize(vec3f(1.0));let co=cos(angle);return max(vec3f(0.0),c*co+cross(axis,c)*sin(angle)+axis*dot(axis,c)*(1.0-co));}
fn blend(base:vec3f,src:vec3f,mode:f32)->vec3f{let m=i32(round(mode));if(m==1){return base+src;}if(m==2){return base+src-base*src/max(vec3f(1.0),max(base,src));}if(m==3){return base*src;}if(m==4){return abs(base-src);}if(m==5){return max(base,src);}if(m==6){return min(base,src);}return src;}
fn source(code:f32,uv:vec2f)->f32{
 let c=i32(round(code));if(c<0){return tap(routerTex,uv).b;}if(c==0){return 1.0;}
 if(c==1){return luminance(tap(environmentTex,uv).rgb);}if(c==2){return luminance(tap(hdriTex,uv).rgb);}if(c==3){let m=select(k.p[52].z,k.p[52].x,k.p[52].w>.5)*k.p[52].y;return luminance(mix(tap(environmentTex,uv).rgb,tap(hdriTex,uv).rgb,m));}let q=fract((uv-.5)*max(.01,k.p[44].w)+.5+k.p[4].w*.01);let a=tap(atlasTex,fract(q*7.0));
 if(c==4){return sat((a.g-.5)*k.p[51].y+.5);}if(c==5){return gate(a.r*.6+a.g*.4,.5,.2);}if(c==6){return a.r;}if(c==7){return a.g;}if(c==8){return a.b;}if(c==9){return a.a;}if(c==10){return q.y;}if(c==11){return sat(1.0-length(q-.5)*1.41421356);}
 let d=remapDepth(depthAt(uv));if(c==12){return d;}if(c==13){return 1.0-d;}if(c==14){return depthEdge(uv);}if(c==15){return depthBand(uv);}if(c==16){return .5+.5*sin((d*k.p[12].x+k.p[12].z)*6.2831853);}if(c==17){return floor(d*k.p[12].y)/max(1.0,k.p[12].y-1.0);}if(c==18){return sat(length(depthGrad(uv)));}
 if(c==19){let level=i32(min(k.p[47].w-1.0,floor(log2(max(1.0,k.p[12].w)))));let dim=textureDimensions(pyramidTex,level);let nearD=textureLoad(pyramidTex,clamp(vec2i(uv*vec2f(dim)),vec2i(0),vec2i(dim)-1),level).r;return max(depthEdge(uv),sat((depthAt(uv)-nearD)/max(1.0,depthAt(uv))*k.p[13].x));}
 let aux=at(auxTex,uv);if(c==20){return sat(abs(dot(aux.xyz,-ray(uv))));}if(c==21){return normalEdge(uv);}if(c==22){return sat(aux.a);}let v=tap(signalTex,uv);if(c==23){return sat(v.r);}if(c==24){return sat(v.g);}if(c==25){return sat(v.b);}if(c==26){return sat(v.a);}if(c==27){return sat(luminance(tap(historyTex,uv).rgb));}if(c==28){return sat(abs(luminance(tap(image,uv).rgb)-luminance(tap(historyTex,uv).rgb)));}return sat(luminance(tap(feedbackTex,uv).rgb));
}
fn routed(uv:vec2f)->vec3f{let a=source(k.p[42].x,uv);let b=source(k.p[42].y,uv);let m=k.p[42].z;let mode=i32(round(k.p[42].w));var x=mix(a,b,m);if(mode==1){x=a*b;}if(mode==2){x=1.0-(1.0-a)*(1.0-b);}if(mode==3){x=a+b*m;}if(mode==4){x=abs(a-b*m);}if(mode==5){x=min(a,b);}if(mode==6){x=max(a,b);}x=pow(max(0.0,(x-.5)*k.p[43].y+.5+k.p[43].x),1.0/max(.05,k.p[43].z));if(k.p[44].x<.499){x=gate(x,k.p[43].w,k.p[44].x);}x=sat(x);if(k.p[44].y>.5){x=1.0-x;}return vec3f(a,b,x);}
fn effectMask(code:f32,uv:vec2f)->f32{if(code<-.5){return routed(uv).z;}return sat(source(code,uv));}
fn stochastic(pixel:vec2f,kind:f32,phase:f32)->f32{let c=i32(round(kind));if(c==4){return .5;}if(c==1){let v=vec2u(pixel)%vec2u(4u);let b=(v.x&1u)*2u+(v.y&1u);let a=((v.x>>1u)&1u)*2u+((v.y>>1u)&1u);let ranks=array<u32,4>(0u,2u,3u,1u);return fract((f32(ranks[b]*4u+ranks[a])+.5)/16.0+phase*.61803399);}if(c==2){let dim=vec2f(textureDimensions(noiseTex));return fract(at(noiseTex,fract((pixel+vec2f(17.0,29.0)*phase)/dim)).r+phase*.61803399);}if(c==3){return hash(vec3f(pixel,phase));}return fract(52.9829189*fract(dot(pixel+phase*vec2f(5.588238,5.588238),vec2f(.06711056,.00583715))));}
`;
export function createCommonLayout(d){return d.createBindGroupLayout({label:'kinetic shared texture vocabulary',entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform',minBindingSize:KINETIC_UNIFORM_BYTES}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},...Array.from({length:16},(_,i)=>({binding:i+2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:[3,8,14,15].includes(i+2)?'unfilterable-float':'float'}}))]});}
