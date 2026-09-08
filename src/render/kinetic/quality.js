/** Pure, testable workload accounting. Units are bytes and physical pixels. */
export function effectiveCloudCacheResolution(s){
 const requested=Math.max(16,Math.min(256,Math.round(+s.procCloudCacheRes||96)));
 const budget=Math.max(64,+s.textureBudgetMB||768)*1024**2;
 // Two RGBA16F ping-pong volumes = 16 bytes per voxel. Keep this optional
 // instrument below 35% of the configured texture budget so screen targets and
 // retired allocations still have room during quality transitions.
 const maxN=Math.max(16,Math.floor(Math.cbrt((budget*.35)/16)));
 return Math.min(requested,maxN);
}
export function needsSpectralFFT(s){return !s.paused&&(s.sceneMode!=='field'||(s.volumeEnabled&&(s.volumeSource==='spectral'||s.volumeSourceB==='spectral')));}
export function hasKineticWork(s){return s.depthEnabled||s.volumeEnabled||s.procCloudEnabled||s.distortionEnabled||s.feedbackEnabled||s.positiveEnabled||s.darkEnabled||s.colourEnabled||s.temporalEnabled||s.temporalSamples!=='off'||s.kineticDebug!=='final'||(s.maskEnabled&&[s.maskSourceA,s.maskSourceB].some(v=>/^(scene-|inverse-|depth-|normal-|surface-|volume-|history-|feedback|silhouette)/.test(v)));}
export function textureBytesPerPixel(s,msaa=Number(s.msaa)||1){
 let b=8+4*msaa+(msaa===4?32:0); // HDR resolve + depth + optional MSAA HDR.
 if(hasKineticWork(s)) b+=16+16+8+8+16/3; // Aux, compositor ping-pong, pre/post masks, depth pyramid.
 if(s.temporalEnabled||s.temporalSamples!=='off') b+=20; // Independent colour histories and previous ray-depth.
 if(s.feedbackEnabled) b+=20/(+s.feedbackResolution)**2+4;
 if(s.volumeEnabled) b+=(20+ (s.volumeTemporal?24:0))/(+s.volumeRenderScale)**2;
 if(s.procCloudEnabled) b+=8/(Math.max(1,+s.procCloudRenderScale||1))**2;
 if(s.positiveEnabled||s.darkEnabled) b+=48/(+s.bloomResolution)**2;
 return b;
}
export function planRenderSize(s,cssWidth,cssHeight,dpr=1,limits={maxTextureDimension2D:8192}){
 const limit=Math.max(1,limits.maxTextureDimension2D||8192),pixelRatio=Math.max(.1,Math.min(dpr||1,1.5));
 const wantedOutputWidth=Math.max(1,Math.round(cssWidth*pixelRatio)),wantedOutputHeight=Math.max(1,Math.round(cssHeight*pixelRatio));
 const msaa=+s.msaa===4?4:1,area=[1,2,4,8].includes(+s.ssaaArea)?+s.ssaaArea:1,bpp=textureBytesPerPixel(s,msaa);
 // Reserve the fallback 8-byte voxel format as well. Three caches include their 3D mip chains.
 const cloudN=s.procCloudEnabled?effectiveCloudCacheResolution(s):0;
 const fixed=32*1024**2+(s.volumeEnabled?Math.ceil((+s.volumeResolution)**3*8*3*8/7):0)+(cloudN?Math.ceil(cloudN**3*8*2):0);
 const budget=Math.max(64,s.textureBudgetMB||768)*1024**2;
 // Normally hold 32% for retired allocations. At the minimum budget, fixed resources may
 // consume more: reduce that reserve rather than returning an impossible negative extent.
 const usable=Math.min(budget*.95,Math.max(budget*.68,fixed+2*1024**2));
 const outputPixels=Math.max(1,(usable-fixed)*.4/12); // HDR downsample + presentation texture.
 const outputScale=Math.min(1,limit/Math.max(wantedOutputWidth,wantedOutputHeight),Math.sqrt(outputPixels/(wantedOutputWidth*wantedOutputHeight)));
 const outputWidth=Math.max(1,Math.floor(wantedOutputWidth*outputScale)),outputHeight=Math.max(1,Math.floor(wantedOutputHeight*outputScale));
 const outputBytes=outputWidth*outputHeight*12,axis=s.renderScale*Math.sqrt(area),wantW=Math.max(1,outputWidth*axis),wantH=Math.max(1,outputHeight*axis);
 const pixelsByMemory=Math.max(1,(usable-fixed-outputBytes)/bpp),pixels=Math.min((s.maxRenderMP||32)*1e6,pixelsByMemory);
 const scale=Math.min(1,Math.sqrt(pixels/(wantW*wantH)),limit/Math.max(wantW,wantH));
 const width=Math.max(1,Math.floor(wantW*scale)),height=Math.max(1,Math.floor(wantH*scale));
 return {width,height,outputWidth,outputHeight,msaa,requestedSSAA:area,effectivePixelFactor:width*height/(outputWidth*outputHeight),effectiveSSAA:width*height/(outputWidth*outputHeight*s.renderScale*s.renderScale),limited:scale<.999||outputScale<.999,outputLimited:outputScale<.999,estimatedBytes:Math.ceil(width*height*bpp+fixed+outputBytes),budgetBytes:budget,transitionReserveBytes:Math.max(0,Math.floor(budget-usable)),signature:[width,height,outputWidth,outputHeight,msaa].join(':')};
}
export function samplerDescriptor(mode='trilinear'){
 const af=mode.startsWith('af')?Math.min(16,Math.max(1,Number(mode.slice(2))||1)):1;
 return {addressModeU:'repeat',addressModeV:'repeat',magFilter:mode==='nearest'?'nearest':'linear',minFilter:mode==='nearest'?'nearest':'linear',mipmapFilter:mode==='nearest'||mode==='bilinear'?'nearest':'linear',maxAnisotropy:af};
}
export function halton(index,base){let f=1,r=0;for(let i=index;i>0;i=Math.floor(i/base)){f/=base;r+=f*(i%base);}return r;}
/** Progressive toroidal best-candidate blue-noise samples; authored seed 442. */
export const BLUE_NOISE_JITTER=Object.freeze([[-0.250000000,-0.250000000],[0.250000000,0.250000000],[0.256008877,-0.250397037],[-0.254206806,0.260509522],[-0.013691864,0.008554049],[-0.487563948,-0.006140029],[-0.486898847,-0.486908473],[0.000132751,0.493173982],[0.253511477,0.002799217],[-0.000725857,-0.256920087],[0.252492680,0.487934109],[0.493299145,0.262028680],[-0.242112425,-0.485012061],[0.011077499,0.249375754],[-0.260469627,-0.019397632],[-0.486616557,-0.238686903],[0.125635534,-0.128682564],[0.380289321,0.128831299],[-0.360691911,0.394337678],[0.123085816,-0.380592349],[0.366029205,-0.384434256],[0.379636183,-0.127202440],[-0.382143920,0.141595945],[-0.115882356,0.366724440],[-0.156396516,0.114269809],[0.384011679,0.385966897],[-0.120264016,-0.372162635],[-0.113537794,-0.128891878],[0.123221671,0.376663319],[0.129888132,0.122498005],[-0.381974838,-0.357926995],[-0.382409329,-0.123602205]].map(Object.freeze));
export function frameJitter(frame,s){
 if(s.temporalSamples==='off')return [0,0];const count=Math.max(2,+s.temporalSamples||2),i=frame%count,scale=s.jitterScale;
 let x=0,y=0;switch(s.jitterPattern){case 'checker2':x=(i%2+.5)/2-.5;y=(Math.floor(i/2)%2+.5)/2-.5;break;case 'checker4':x=(i%4+.5)/4-.5;y=(Math.floor(i/4)%4+.5)/4-.5;break;case 'fixed':break;case 'ign':x=((i*.754877666)%1)-.5;y=((i*.569840296)%1)-.5;break;case 'blue-noise':[x,y]=BLUE_NOISE_JITTER[i%32];break;default:x=halton(i+1,2)-.5;y=halton(i+1,3)-.5;}
 return [x*scale,y*scale];
}
export function jitterMatrix(matrix,jitter,width,height){const m=new Float32Array(matrix),x=2*jitter[0]/width,y=-2*jitter[1]/height;for(let c=0;c<4;c++){m[c*4]+=x*m[c*4+3];m[c*4+1]+=y*m[c*4+3];}return m;}
export function cameraDiscontinuity(previous,current){if(!previous)return true;return previous.mode!==current.mode||Math.hypot(...current.position.map((x,i)=>x-previous.position[i]))>Math.max(30,current.orbit*.3)||current.forward.reduce((a,x,i)=>a+x*previous.forward[i],0)<.78;}
