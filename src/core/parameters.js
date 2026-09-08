import {KINETIC_PARAMETERS,KINETIC_INTEGER_KEYS,KINETIC_CHOICES,KINETIC_DEFAULTS,KINETIC_BOOLEAN_KEYS,KINETIC_COLOR_KEYS,KINETIC_MASK_SOURCES} from './kinetic-parameters.js';
/** Absolute limits are engineering caps; user-editable safety caps live in StateStore. */
const GROUP_INFO=Object.freeze({
  plasma:'SkySynth waveform synthesis. This parameter changes the low-resolution animated HDR field before reconstruction.',
  sampling:'SkySynth source sampling, reconstruction, and post-filtering pipeline. Higher values can cost CPU/GPU time or add latency.',
  environment:'Environment-map transport shared by the visible sky and liquid reflections.',
  liquid:'Spectral liquid motion. These controls change the large-scale simulated surface.',
  pattern:'Surface relief, luminous structure and foam shaping layered over the spectral liquid.',
  reflection:'Environment reflection and pseudo-Fresnel weighting. These controls largely determine apparent material character.',
  distance:'Distance sealing, procedural cloud treatment and horizon concealment.',
  finish:'Final HDR display shaping after the scene is rendered.',
  render:'Renderer workload and presentation limits. Increase cautiously.',
  lighting:'Ambient, emissive, and spotlight shaping layered onto the liquid material.',
  projection:'Projection mapping for sphere and imported-mesh surface fields. Mapping can deliberately preserve or exaggerate distortion.',
  geometry:'Imported-mesh conditioning, adaptive retessellation, spike handling, smoothing, and displacement safety.',
  modulation:'Transient SkySynth modulation; the base parameter values remain unchanged.',
  lut:'Palette/LUT editing and variation controls.',
  noixture:'SkyNoixture procedural overlays composited into the shared environment before sky/reflection use.',
  mixer:'SkyMixer compositing between animated SkySynth radiance and the loaded HDRI.',
  mask:'Live mask channel used to modulate mixer, SkyNoixture, cloud, and foam compositing.'
});

export const BLEND_MODE_GROUPS = Object.freeze([
  ['NORMAL', [
    ['normal','Normal'],['dissolve','Dissolve'],
  ]],
  ['LIGHTEN', [
    ['lighten','Lighten only'],['luma-lighten','Luma/Luminance lighten only'],['screen','Screen'],['dodge','Dodge'],['addition','Addition'],
  ]],
  ['DARKEN', [
    ['darken','Darken only'],['luma-darken','Luma/Luminance darken only'],['multiply','Multiply'],['burn','Burn'],['linear-burn','Linear burn'],
  ]],
  ['CONTRAST', [
    ['overlay','Overlay'],['soft-light','Soft light'],['hard-light','Hard light'],['vivid-light','Vivid light'],['pin-light','Pin light'],['linear-light','Linear light'],['hard-mix','Hard mix'],
  ]],
  ['DIFFERENCE', [
    ['difference','Difference'],['exclusion','Exclusion'],['subtract','Subtract'],['grain-extract','Grain extract'],['grain-merge','Grain merge'],['divide','Divide'],
  ]],
  ['COMPONENT', [
    ['hsv-hue','HSV Hue'],['hsv-saturation','HSV Saturation'],['hsl-color','HSL Color'],['hsv-value','HSV Value'],
  ]],
  ['LCH / LUMINANCE', [
    ['lch-hue','LCh Hue'],['lch-chroma','LCh Chroma'],['lch-color','LCh Color'],['lch-lightness','LCh Lightness'],['luminance','Luminance'],
  ]],
]);
export const BLEND_MODES = Object.freeze(BLEND_MODE_GROUPS.flatMap(([,modes])=>modes.map(([value])=>value)));
export const MASK_SOURCES = Object.freeze(['constant','skysynth-luma','hdri-luma','mixed-luma','noixture','clouds','perlin','billow','ridge','weave','vertical','radial',...KINETIC_MASK_SOURCES]);
export const MASK_MIX_MODES = Object.freeze(['mix','multiply','screen','addition','difference','minimum','maximum']);
export const UPSAMPLERS = Object.freeze(['nearest','linear','smooth','bicubic','catmull-rom','lanczos2']);
export const FILTER_STAGES = Object.freeze(['none','pre','mid','post']);
export const PROJECTION_MAPPINGS = Object.freeze(['planar-xz','planar-xy','planar-yz','uv','spherical','equal-area','cubemap','octahedral','triplanar','cylindrical','radial','object3d','world3d','tangent-local','camera','projector','reflection-vector','polar-crush','axis-dominant','quantized-normal']);
export const PROJECTION_LAYER_CHOICES = Object.freeze(['master',...PROJECTION_MAPPINGS]);
export const PROJECTION_REFLECTION_CHOICES = Object.freeze(['environment','master',...PROJECTION_MAPPINGS]);
export const PROJECTION_WRAP_MODES = Object.freeze(['none','repeat','mirror','clamp']);
export const PROJECTION_MASKS = Object.freeze(['constant','perlin','billow','ridge','normal-up','radial']);

const N = (label, group, value, min, max, step, hardMin = min, hardMax = max, help = '') =>
  ({label, group, value, min, max, step, hardMin, hardMax, help:help||`${label}: ${GROUP_INFO[group]||'Adjusts this rendering parameter.'}`});
export const PARAMETERS = Object.freeze({
  ...KINETIC_PARAMETERS,
  freqY:N('Frequency Y','plasma',.22,-1,1,.005,-4,4),
  freqX:N('Frequency X','plasma',.32,-1,1,.005,-4,4),
  speed:N('Speed','plasma',.3,-1.5,1.5,.01,-8,8),
  hueShift:N('LUT drift °/s','plasma',7,-30,30,.1,-360,360),
  radius:N('Radius','plasma',.24,-1,1,.005,-4,4),
  diagonal:N('Diagonal wave','plasma',.25,-1,1,.005,-4,4),
  warp:N('Domain warp','plasma',.18,0,1,.01,0,3),
  fieldContrast:N('Field contrast','plasma',1.5,.3,3,.01,.05,6),
  radiance:N('HDR radiance','plasma',4.5,.1,12,.1,0,64,'Linear radiance, not 8-bit brightness. Values above 1 are retained.'),
  sourceWidth:N('Synth width px','sampling',96,32,256,2,16,512,'Base SkySynth panorama width. Height is half the width.'),
  envMapWidth:N('Env-map width px','sampling',96,64,512,2,16,1024,'Final shared environment-map width after the upsampling pipeline. Height remains half the width.'),
  generatorFPS:N('Generator FPS','sampling',24,6,60,1,1,60,'Independent of display FPS; at most one worker request is in flight.'),
  spatialSmooth:N('Spatial smoothing','sampling',.45,0,1,.01,0,1),
  temporalSmooth:N('Temporal smoothing s','sampling',.08,0,.5,.01,0,2),
  nlFilterStrength:N('NL filter strength','sampling',.18,0,1,.01,0,1.5,'Edge-aware non-linear smoothing inserted into the upsampling pipeline.'),
  nlFilterRadius:N('NL filter radius','sampling',1,0,3,1,0,4,'0 disables neighbourhood accumulation; 1–3 trade more smoothing for more CPU cost.'),
  envRotation:N('Environment yaw °','environment',0,-180,180,1,-3600,3600),
  envGain:N('Environment gain','environment',1,0,4,.01,0,16),
  envBlur:N('Environment blur LOD','environment',0,0,4,.05,0,9),
  waves:N('Wave energy','liquid',1.4,.1,3,.01,0,4),
  choppiness:N('Choppiness','liquid',1.2,.3,2,.01,0,2.5),
  swell:N('Swell mix','liquid',1.05,0,1.8,.01,0,2.5),
  windSea:N('Wind-sea mix','liquid',1.2,0,2,.01,0,3),
  capillary:N('Capillary mix','liquid',1.4,0,2.5,.01,0,3),
  current:N('Surface drift','liquid',.24,-1,1,.01,-3,3),
  patternScale:N('Pattern scale','pattern',.18,.02,.5,.005,.005,2),
  perlinGain:N('Perlin relief','pattern',.7,0,2,.01,0,3),
  billowGain:N('Billow relief','pattern',.9,0,2,.01,0,3),
  ridgeGain:N('Ridge relief','pattern',1.2,0,2.5,.01,0,3),
  normalStrength:N('Normal relief','pattern',.42,0,1.2,.01,0,2),
  energyEmission:N('Energy emission','pattern',.55,0,3,.01,0,8),
  foamAmount:N('Crest filaments','pattern',.65,0,1.5,.01,0,2.5),
  foamLight:N('Filament radiance','pattern',1.2,0,4,.01,0,12),
  foamBreakup:N('Foam breakup','pattern',1.1,0,2,.01,0,4),
  foamStreaks:N('Foam streaking','pattern',.8,0,2,.01,0,4),
  foamPersistence:N('Foam persistence','pattern',.7,0,2,.01,0,4),
  bodyGain:N('Body tint gain','reflection',.22,0,1,.01,0,4),
  reflectionGain:N('Reflection gain','reflection',1.15,0,3,.01,0,8),
  fresnelBias:N('Face reflection','reflection',.22,0,1,.01,0,1),
  fresnelEdge:N('Edge reflection','reflection',.94,0,1,.01,0,1),
  fresnelShape:N('Fresnel curve','reflection',.75,0,1,.01,0,1,'Blends square and fifth-power curves using multiplies, not pow().'),
  roughness:N('Reflection blur','reflection',.14,0,1,.01,0,1),
  drawDistance:N('Draw distance m','distance',1050,200,1800,10,120,2400),
  fogBand:N('Fog band m','distance',420,40,800,10,20,1600),
  fogStrength:N('Distant cloud fog','distance',.45,0,1,.01,0,2),
  cloudCoverage:N('Cloud coverage','distance',.46,0,1,.01,0,1),
  cloudOpacity:N('Cloud blend amount','distance',.34,0,1,.01,0,1.5),
  cloudScale:N('Cloud scale','distance',1.1,.2,4,.01,.1,8),
  cloudDrift:N('Cloud drift','distance',.08,-1,1,.01,-4,4),
  meshResolution:N('Mesh vertices / side','render',384,128,512,16,64,640,'Explicit geometry cap: 409,600 vertices. No FFT rebuild when this changes.'),
  renderScale:N('Render scale','render',1,.5,1.25,.05,.35,1.5,'Scene resolution multiplier, independent of SSAA area. Subject to device dimensions and the configurable texture budget.'),
  displayFPS:N('Display FPS cap','render',60,15,144,1,10,240),
  exposure:N('Exposure','finish',1,.2,2.5,.01,.05,5),
  contrast:N('Display contrast','finish',1.06,.6,1.6,.01,.4,2),
  bloom:N('HDR glow','finish',.16,0,.6,.01,0,1),
  bloomThreshold:N('Glow threshold','finish',1.4,.1,4,.05,0,16),
  bloomRadius:N('Glow radius px','finish',2.5,.5,6,.1,.25,12),
  sharpen:N('Sharpen','finish',.12,0,.5,.01,0,.6),
  ambientIntensity:N('Ambient intensity','lighting',.22,0,2,.01,0,8),
  emissiveIntensity:N('Emissive intensity','lighting',.45,0,4,.01,0,12),
  spotIntensity:N('Spot intensity','lighting',.55,0,4,.01,0,12),
  spotAzimuth:N('Spot azimuth °','lighting',28,-180,180,1,-3600,3600),
  spotElevation:N('Spot elevation °','lighting',42,-89,89,1,-89,89),
  spotFocus:N('Spot focus','lighting',.52,0,1,.01,0,1),

  projectionMix:N('Projection A/B mix','projection',0,0,1,.01,0,1,'Crossfades mapping coordinates from Projection A to Projection B. Can be modulated by the projection mask source.'),
  projectionScaleX:N('Projection scale X','projection',1,.05,4,.01,.001,64),
  projectionScaleY:N('Projection scale Y','projection',1,.05,4,.01,.001,64),
  projectionScaleZ:N('Projection scale Z','projection',1,.05,4,.01,.001,64),
  projectionRotationX:N('Projection rotate X °','projection',0,-180,180,1,-3600,3600),
  projectionRotationY:N('Projection rotate Y °','projection',0,-180,180,1,-3600,3600),
  projectionRotationZ:N('Projection rotate Z °','projection',0,-180,180,1,-3600,3600),
  projectionOffsetX:N('Projection offset X','projection',0,-4,4,.01,-128,128),
  projectionOffsetY:N('Projection offset Y','projection',0,-4,4,.01,-128,128),
  projectionOffsetZ:N('Projection offset Z','projection',0,-4,4,.01,-128,128),
  projectionOriginX:N('Projection origin X','projection',0,-100,100,.5,-10000,10000),
  projectionOriginY:N('Projection origin Y','projection',0,-100,100,.5,-10000,10000),
  projectionOriginZ:N('Projection origin Z','projection',0,-100,100,.5,-10000,10000),
  projectionSharpness:N('Projection sharpness','projection',4,.25,16,.05,.05,64,'Controls triplanar weighting and hard-axis projection transitions.'),
  projectionWarp:N('Coordinate warp','projection',0,0,2,.01,0,8),
  projectionDriftX:N('Projection drift X','projection',0,-2,2,.01,-16,16,'Animated coordinate drift along the first projected axis.'),
  projectionDriftY:N('Projection drift Y','projection',0,-2,2,.01,-16,16,'Animated coordinate drift along the second projected axis.'),
  projectionQuantize:N('Normal quantization','projection',6,2,24,1,1,64,'Number of directional steps used by Quantized Normal mapping.'),
  projectionDisplacement:N('Mesh displacement','projection',4,0,18,.1,0,80,'Displacement amplitude along the imported/spherical surface normal.'),
  projectionDisplacementSafety:N('Displacement safety','projection',.7,.05,2,.01,0,4,'Caps displacement against local mesh edge scale to reduce foldover and self-intersection.'),
  projectorFov:N('Projector FOV °','projection',70,10,160,1,1,179),
  meshScale:N('Mesh radius','geometry',100,20,180,1,1,1000),
  meshWeldEpsilon:N('Weld epsilon','geometry',.002,0,.05,.0005,0,1),
  meshTargetEdge:N('Target edge length','geometry',12,1,40,.5,.05,200),
  meshCurvatureAngle:N('Curvature split angle °','geometry',35,2,120,1,1,179,'Retessellation also splits triangles whose interpolated vertex normals diverge beyond this angle.'),
  meshSubdivideLevels:N('Retessellation passes','geometry',2,0,4,1,0,4),
  meshSmoothIterations:N('Smooth iterations','geometry',1,0,8,1,0,32),
  meshSmoothStrength:N('Smooth strength','geometry',.22,0,1,.01,0,1),
  meshSpikeThreshold:N('Spike threshold','geometry',2.8,1,8,.1,.5,32),
  meshHardEdgeAngle:N('Hard-edge angle °','geometry',55,5,175,1,1,179),
  meshTriangleCap:N('Triangle cap','geometry',350000,10000,1000000,10000,1000,2000000),
  mixerMix:N('HDRI mix','mixer',.35,0,1,.01,0,1,'Blend opacity / influence of the HDRI input in SkyMixer.'),
  noixtureAmount:N('Overlay amount','noixture',.28,0,1,.01,0,1.5,'Strength of the SkyNoixture texture overlay applied to the shared environment.'),
  noixtureScale:N('Overlay scale','noixture',1.0,.1,4,.01,.05,12,'Spatial scale of the SkyNoixture texture field.'),
  noixtureContrast:N('Overlay contrast','noixture',1.35,.2,3,.01,.05,8,'Contrast remap applied to SkyNoixture before compositing.'),
  noixtureDrift:N('Overlay drift','noixture',.12,-1,1,.01,-4,4,'Animation drift speed of the SkyNoixture texture field.'),
  maskSourceMix:N('Source mix','mask',.5,0,1,.01,0,1,'Crossfade weight between mask source A and B before mask-mix processing.'),
  maskBrightness:N('Mask brightness','mask',0,-1,1,.01,-4,4,'Adds an offset to the generated mask before thresholding.'),
  maskContrast:N('Mask contrast','mask',1,0,3,.01,0,8,'Expands or compresses mask values around mid grey.'),
  maskGamma:N('Mask gamma','mask',1,.2,3,.01,.05,8,'Power-law shaping for the generated mask.'),
  maskThreshold:N('Mask threshold','mask',0,0,1,.01,0,1,'Threshold centre. Set softness high for a continuous mask.'),
  maskSoftness:N('Mask softness','mask',.5,0,.5,.005,0,1,'Width of the smooth threshold transition; 0 is a hard threshold.'),
  maskScale:N('Mask scale','mask',1,.1,4,.01,.05,16,'Spatial scale used by procedural mask sources.'),
  maskDrift:N('Mask drift','mask',0,-1,1,.01,-4,4,'Animation drift applied to procedural mask sources.'),
  modAmplitude:N('AMP','modulation',25,0,100,1,0,100),
  modHz:N('Hz','modulation',.5,-3,3,.01,-6,6),
  modWidthMin:N('Width low %','modulation',-100,-100,100,1,-100,100),
  modWidthMax:N('Width high %','modulation',100,-100,100,1,-100,100),
  modOffset:N('Offset','modulation',0,-100,100,1,-100,100),
  lutRandomScale:N('Palette variation %','lut',25,0,100,1,0,100),
});
export const CHOICES = Object.freeze({
  ...KINETIC_CHOICES,
  ...Object.fromEntries(['volumeMask','depthMask','distortionMask','feedbackMask','positiveMask','darkMask','colourMask'].map(k=>[k,['router',...MASK_SOURCES]])),
  sceneMode:['liquid','planet','field','mesh'],
  meshAsset:['showcase','d20','imported'],
  projectionA:PROJECTION_MAPPINGS,
  projectionB:PROJECTION_MAPPINGS,
  projectionMaskSource:PROJECTION_MASKS,
  projectionWrap:PROJECTION_WRAP_MODES,
  reflectionProjection:PROJECTION_REFLECTION_CHOICES,
  maskProjection:PROJECTION_LAYER_CHOICES,
  displacementProjection:PROJECTION_LAYER_CHOICES,
  patternProjection:PROJECTION_LAYER_CHOICES,
  foamProjection:PROJECTION_LAYER_CHOICES,
  emissionProjection:PROJECTION_LAYER_CHOICES,
  meshSpikeMode:['leave','relax','clamp','cull'],
  envMode:['plasma','hdri'],
  upsampling:UPSAMPLERS,
  upsamplingStageB:['none',...UPSAMPLERS],
  processingStage:FILTER_STAGES,
  cloudBlend:BLEND_MODES,
  noixtureMode:['perlin','billow','ridge','weave'],
  noixtureBlend:BLEND_MODES,
  mixerBlend:BLEND_MODES,
  foamBlend:BLEND_MODES,
  maskSourceA:MASK_SOURCES,
  maskSourceB:MASK_SOURCES,
  maskMixMode:MASK_MIX_MODES,
  modWave:['sine','smooth-triangle','loop-noise','wander-noise']
});
export const BOOLEAN_KEYS = [...KINETIC_BOOLEAN_KEYS,'meshRetessellate','meshPreserveBoundary','meshPreserveHardEdges','modEnabled','paused','showSky','mixerEnabled','noixtureEnabled','maskEnabled','maskInvert','maskMixer','maskNoixture','maskClouds','maskFoam','ambientEnabled','emissiveEnabled','spotEnabled'];
export const COLOR_KEYS = [...KINETIC_COLOR_KEYS,'bodyColor','foamColor','uiBackground','noixtureColor','ambientColor','emissiveColor','spotColor'];
export const DEFAULTS = Object.freeze({...KINETIC_DEFAULTS,volumeMask:'constant',depthMask:'constant',distortionMask:'constant',feedbackMask:'constant',positiveMask:'constant',darkMask:'depth-edge',colourMask:'scene-depth',...Object.fromEntries(Object.entries(PARAMETERS).map(([k,s])=>[k,s.value])),sceneMode:'liquid',envMode:'plasma',upsampling:'bicubic',upsamplingStageB:'catmull-rom',processingStage:'mid',cloudBlend:'screen',noixtureMode:'billow',noixtureBlend:'soft-light',mixerBlend:'normal',foamBlend:'normal',maskSourceA:'mixed-luma',maskSourceB:'billow',maskMixMode:'mix',modWave:'sine',modEnabled:false,mixerEnabled:false,noixtureEnabled:false,maskEnabled:false,maskInvert:false,maskMixer:true,maskNoixture:false,maskClouds:false,maskFoam:false,paused:false,showSky:true,ambientEnabled:true,emissiveEnabled:true,spotEnabled:true,bodyColor:'081018',foamColor:'CFFFE8',noixtureColor:'D7E6FF',ambientColor:'A9C6FF',emissiveColor:'9BE8FF',spotColor:'FFF1C6',uiBackground:'071014',lutSlot:0,meshAsset:'showcase',projectionA:'planar-xz',projectionB:'octahedral',projectionMaskSource:'constant',projectionWrap:'none',reflectionProjection:'environment',maskProjection:'master',displacementProjection:'master',patternProjection:'master',foamProjection:'master',emissionProjection:'master',meshSpikeMode:'relax',meshRetessellate:true,meshPreserveBoundary:true,meshPreserveHardEdges:true,modTargets:['speed']});
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function parseNumber(key, value, safetyCap=null){
  const s=PARAMETERS[key]; if(!s)throw new Error(`Unknown parameter: ${key}`);
  if(typeof value==='boolean'||value===null||String(value).trim()==='')throw new Error('Enter a finite number.');
  const n=Number(value); if(!Number.isFinite(n))throw new Error('NaN and infinity are not valid parameter values.');
  const lo=safetyCap?.min??s.hardMin,hi=safetyCap?.max??s.hardMax;
  if(n<lo||n>hi)throw new Error(`${s.label}: active hard safety caps are ${lo}…${hi}.`);
  if(KINETIC_INTEGER_KEYS.includes(key)&&!Number.isInteger(n))throw new Error('This parameter requires a whole number.');
  if(['meshResolution','sourceWidth','envMapWidth','generatorFPS','displayFPS','nlFilterRadius','meshSubdivideLevels','meshSmoothIterations','meshTriangleCap','projectionQuantize'].includes(key)&&!Number.isInteger(n))throw new Error('This parameter requires a whole number.');
  if((key==='sourceWidth'||key==='envMapWidth')&&n%2)throw new Error('Use an even panorama width (2:1).');
  return n;
}
export function validateSafetyCaps(key,min,max){
  const s=PARAMETERS[key];if(!s)throw new Error('Unknown parameter.');
  const a=Number(min),b=Number(max);if(!Number.isFinite(a)||!Number.isFinite(b))throw new Error('Hard safety caps must be finite numbers.');
  if(a>=b)throw new Error('Hard safety minimum must be smaller than maximum.');
  if(a<s.hardMin||b>s.hardMax)throw new Error(`Absolute engineering range is ${s.hardMin}…${s.hardMax}.`);
  if(['meshResolution','sourceWidth','envMapWidth','generatorFPS','displayFPS','nlFilterRadius','meshSubdivideLevels','meshSmoothIterations','meshTriangleCap','projectionQuantize'].includes(key)&&(!Number.isInteger(a)||!Number.isInteger(b)))throw new Error('This parameter requires whole-number safety caps.');
  if(KINETIC_INTEGER_KEYS.includes(key)&&(!Number.isInteger(a)||!Number.isInteger(b)))throw new Error('This parameter requires whole-number safety caps.');
  if((key==='sourceWidth'||key==='envMapWidth')&&(a%2||b%2))throw new Error('Panorama width safety caps must be even.');
  return {min:a,max:b};
}
export function validateRange(key, min, max, safetyCap=null){
  const s=PARAMETERS[key]; if(!s)throw new Error('Unknown parameter.');
  const cap=safetyCap||{min:s.hardMin,max:s.hardMax};
  const a=parseNumber(key,min,cap), b=parseNumber(key,max,cap);
  if(a>=b)throw new Error('Minimum must be smaller than maximum.');
  return {min:a,max:b};
}
export function defaultRanges(){return Object.fromEntries(Object.entries(PARAMETERS).map(([k,s])=>[k,{min:s.min,max:s.max}]));}
export function defaultSafetyCaps(){return Object.fromEntries(Object.entries(PARAMETERS).map(([k,s])=>[k,{min:s.hardMin,max:s.hardMax}]));}
export function defaultFunctionalExtremums(){return Object.fromEntries(Object.keys(PARAMETERS).map(k=>[k,{min:'',max:''}]));}
export function parseFunctionalExtremum(value){const t=String(value??'').trim();if(!t)return '';const n=Number(t);if(!Number.isFinite(n))throw new Error('Functional extremums must be finite numbers or blank.');return n;}
export function cleanSettings(input, base=DEFAULTS){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Settings must be an object.');
  const out={...base,modTargets:[...(base.modTargets||[])]};
  for(const k of Object.keys(PARAMETERS))if(Object.hasOwn(input,k))out[k]=parseNumber(k,input[k]);
  for(const [k,list] of Object.entries(CHOICES))if(Object.hasOwn(input,k)){let value=input[k];if(k.endsWith('Blend')){if(value==='softlight')value='soft-light';if(value==='add'&&list.includes('addition')&&!list.includes('add'))value='addition';}if(!list.includes(value))throw new Error(`Invalid ${k}.`);out[k]=value;}
  for(const k of BOOLEAN_KEYS)if(Object.hasOwn(input,k)){if(typeof input[k]!=='boolean')throw new Error(`Invalid ${k}.`);out[k]=input[k];}
  for(const k of COLOR_KEYS)if(Object.hasOwn(input,k)){const c=String(input[k]).replace(/^#/,'');if(!/^[0-9a-f]{6}$/i.test(c))throw new Error(`Invalid ${k}: use RRGGBB.`);out[k]=c.toUpperCase();}
  if(Object.hasOwn(input,'lutSlot')){if(!Number.isInteger(input.lutSlot)||input.lutSlot<0||input.lutSlot>9)throw new Error('LUT slot must be 0…9.');out.lutSlot=input.lutSlot;}
  if(Object.hasOwn(input,'modTargets')){if(!Array.isArray(input.modTargets)||input.modTargets.some(k=>!['freqY','freqX','speed','hueShift','radius'].includes(k)))throw new Error('Invalid modulation targets.');out.modTargets=[...new Set(input.modTargets)];}
  if(out.modWidthMin>out.modWidthMax)throw new Error('Modulation width endpoints must be ordered.');
  return out;
}
