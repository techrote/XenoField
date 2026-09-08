import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,PARAMETERS,CHOICES,MASK_SOURCES,cleanSettings,parseNumber} from '../src/core/parameters.js';
import {KINETIC_PARAMETERS,KINETIC_GROUPS,KINETIC_CHOICES,KINETIC_MASK_SOURCES,kineticPanelKeys} from '../src/core/kinetic-parameters.js';
import {KINETIC_DEMOS,KINETIC_PANEL_PRESETS} from '../src/core/kinetic-presets.js';
import {PANEL_DEFINITIONS,BUILTIN_PANEL_PRESETS} from '../src/core/presets.js';
import {StateStore,STORAGE_KEY} from '../src/core/store.js';
import {planRenderSize,textureBytesPerPixel,samplerDescriptor,halton,frameJitter,jitterMatrix,cameraDiscontinuity,hasKineticWork,needsSpectralFFT,effectiveCloudCacheResolution} from '../src/render/kinetic/quality.js';
import {packKinetic,maskCode} from '../src/render/kinetic/common.js';
import {cameraMatrix,normal} from '../src/core/math.js';
import {XenoVolumeGPU} from '../src/render/kinetic/xenovolume.js';
import {ProceduralCloudGPU} from '../src/render/kinetic/procedural-cloud.js';
import {TemporalFieldGPU} from '../src/render/kinetic/temporal.js';
import {blueNoiseBytes} from '../src/render/kinetic/blue-noise.js';
const memory=()=>({data:new Map(),getItem(k){return this.data.get(k)||null;},setItem(k,v){this.data.set(k,v);}});
const withSettings=patch=>cleanSettings(patch,DEFAULTS);
test('all registered new choices roundtrip without legacy blend alias corruption',()=>{
 for(const [key,values] of Object.entries(KINETIC_CHOICES))for(const value of values)assert.equal(cleanSettings({[key]:value})[key],value,`${key}:${value}`);
 for(const key of ['feedbackBlend','volumeBlend','depthBlend','volumeGeneratorBlend'])assert.equal(cleanSettings({[key]:'add'})[key],'add');
 assert.equal(cleanSettings({foamBlend:'add'}).foamBlend,'addition');
});
test('kinetic module keys have exactly one ownership boundary',()=>{
 const keys=KINETIC_GROUPS.flatMap(kineticPanelKeys);assert.equal(new Set(keys).size,keys.length);
 for(const key of [...Object.keys(KINETIC_PARAMETERS),...Object.keys(KINETIC_CHOICES)]){if(key.startsWith('procCloud'))assert(PANEL_DEFINITIONS.proceduralClouds.keys.includes(key),key);else assert(keys.includes(key),key);}
 for(const key of keys)assert(Object.hasOwn(DEFAULTS,key),key);
});
test('all new mask sources work in the existing router and every compositor consumer',()=>{
 assert.equal(KINETIC_MASK_SOURCES.length,18);
 for(const source of KINETIC_MASK_SOURCES){assert(MASK_SOURCES.includes(source));for(const key of ['maskSourceA','maskSourceB','volumeMask','depthMask','distortionMask','feedbackMask','positiveMask','darkMask','colourMask'])assert.equal(cleanSettings({[key]:source})[key],source);assert.equal(maskCode(source),MASK_SOURCES.indexOf(source));}
 assert.equal(maskCode('router'),-1);
});
test('new numeric settings expand ranges and survive complete project serialization',()=>{
 const a=new StateStore(memory()),b=new StateStore(memory());
 for(const [key,p]of Object.entries(KINETIC_PARAMETERS))a.set(key,p.max);
 a.set('msaa','4');a.set('ssaaArea','8');a.set('textureFilter','manual32');a.set('volumeEnabled',true);a.set('feedbackPersistence',.97);a.saveGlobalStack('KINETIC ROUNDTRIP');
 b.applySnapshot(JSON.parse(JSON.stringify(a.snapshot())));assert.deepEqual(b.snapshot(),a.snapshot());a.dispose();b.dispose();
});
test('new discrete sample controls cannot request native MSAA16 or native AF32',()=>{
 assert.throws(()=>cleanSettings({msaa:'16'}));assert.throws(()=>cleanSettings({textureFilter:'af32'}));assert.throws(()=>cleanSettings({ssaaArea:'16'}));
 assert.equal(parseNumber('maxRenderMP',.25),.25);
 for(const key of ['volumeLightSteps','depthPyramidLevels','debugMip'])assert.throws(()=>parseNumber(key,2.5));
});
test('legacy V4.3b state loads with neutral optional graph and preserves user data',()=>{
 const storage=memory(),old=new StateStore(null);old.set('freqX',.123);old.set('bodyColor','AA22CC');const snapshot=old.snapshot();
 for(const key of KINETIC_GROUPS.flatMap(kineticPanelKeys))delete snapshot.settings[key];storage.setItem('abyssal-xenofield-4.3b',JSON.stringify(snapshot));
 const now=new StateStore(storage);assert.equal(now.settings.freqX,.123);assert.equal(now.settings.bodyColor,'AA22CC');assert.equal(now.settings.volumeEnabled,false);assert.equal(now.settings.temporalSamples,'off');now.persist();assert(storage.getItem(STORAGE_KEY));old.dispose();now.dispose();
});
test('all ten new stacks reset every new module rather than leaking previous effects',()=>{
 const s=new StateStore(null);assert.equal(Object.keys(KINETIC_DEMOS).length,10);
 for(const [name,demo]of Object.entries(KINETIC_DEMOS)){assert(s.applyGlobalStack(name));for(const group of KINETIC_GROUPS)for(const [key,value]of Object.entries(KINETIC_PANEL_PRESETS[group][name].settings))assert.deepEqual(s.settings[key],value,`${name}:${key}`);assert.equal(s.settings.sceneMode,demo.scene);}
 s.applyGlobalStack('ION ORCHARD');assert.equal(s.settings.volumeEnabled,false);assert.equal(s.settings.feedbackEnabled,false);assert.equal(s.settings.ssaaArea,'1');s.dispose();
});
test('module locks protect AA independently from new visual stacks',()=>{
 const s=new StateStore(null);s.set('ssaaArea','2');s.setSubmenuLock('kinetic-aa',true);s.applyGlobalStack('ABSURD AA');assert.equal(s.settings.ssaaArea,'2');assert.equal(s.settings.temporalSamples,'32');s.dispose();
});
for(const area of [1,2,4,8])test(`SSAA ${area} is pixel area, not per-axis multiplier`,()=>{
 const p=planRenderSize(withSettings({ssaaArea:String(area),textureBudgetMB:8192,maxRenderMP:128,renderScale:1}),1000,800,1);
 assert.equal(p.width,Math.floor(1000*Math.sqrt(area)));assert.equal(p.height,Math.floor(800*Math.sqrt(area)));assert(Math.abs(p.effectiveSSAA-area)<.01);assert.equal(p.limited,false);
});
test('output dimensions and internal dimensions independently obey device limits',()=>{
 const p=planRenderSize(withSettings({ssaaArea:'8',msaa:'4',temporalSamples:'32'}),14000,9000,2,{maxTextureDimension2D:4096});for(const n of [p.width,p.height,p.outputWidth,p.outputHeight])assert(n>=1&&n<=4096);assert(p.limited);assert(p.estimatedBytes<=p.budgetBytes);
});
test('memory guard also scales an enormous presentation target',()=>{
 const p=planRenderSize(withSettings({volumeEnabled:true,volumeResolution:'96',msaa:'4',ssaaArea:'8',feedbackEnabled:true,temporalSamples:'32',textureBudgetMB:64}),16000,16000,1,{maxTextureDimension2D:32768});assert(p.outputLimited);assert(p.estimatedBytes<=p.budgetBytes);assert(p.width>=1&&p.height>=1);assert(p.transitionReserveBytes>=0);
});
test('bounded allocation sweep remains finite and below configured texture budgets',()=>{
 for(const budget of [64,128,768,4096,8192])for(const area of ['1','2','4','8'])for(const msaa of ['1','4'])for(const enabled of [false,true]){
  const s=withSettings({textureBudgetMB:budget,ssaaArea:area,msaa,volumeEnabled:enabled,volumeResolution:'96',volumeRenderScale:'1',volumeTemporal:true,feedbackEnabled:enabled,feedbackResolution:'1',temporalSamples:'32',positiveEnabled:enabled,darkEnabled:enabled,bloomResolution:'2',maxRenderMP:128});
  const p=planRenderSize(s,7680,4320,1.5,{maxTextureDimension2D:8192});assert(p.estimatedBytes<=p.budgetBytes,JSON.stringify(p));assert(p.width*p.height<=128e6);assert(Number.isFinite(p.effectiveSSAA));assert(p.width<=8192&&p.height<=8192);
 }
});
test('resolution signatures change only for actual allocation changes',()=>{
 const a=planRenderSize(DEFAULTS,320,200),b=planRenderSize(withSettings({volumeDensity:8}),320,200);assert.equal(a.signature,b.signature);assert.notEqual(a.signature,planRenderSize(withSettings({msaa:'4'}),320,200).signature);
});
test('disabled optional effects do not require the kinetic graph',()=>{
 assert.equal(Boolean(hasKineticWork(DEFAULTS)),false);assert.equal(Boolean(hasKineticWork(withSettings({msaa:'4',ssaaArea:'8'}))),false);
 for(const key of ['volumeEnabled','procCloudEnabled','depthEnabled','feedbackEnabled','distortionEnabled','positiveEnabled','darkEnabled','colourEnabled','temporalEnabled'])assert(hasKineticWork(withSettings({[key]:true})),key);
 assert(hasKineticWork(withSettings({maskEnabled:true,maskSourceA:'volume-density'})));assert(hasKineticWork(withSettings({kineticDebug:'linear-depth'})));
});
test('quality accounting includes independent MSAA, depth and history ownership',()=>{
 const b=textureBytesPerPixel(DEFAULTS);assert(textureBytesPerPixel(withSettings({msaa:'4'}),4)>b);assert(textureBytesPerPixel(withSettings({volumeEnabled:true,volumeRenderScale:'1'}))>textureBytesPerPixel(withSettings({volumeEnabled:true,volumeRenderScale:'8'})));
});
test('native anisotropic presets satisfy all three required linear filters',()=>{
 for(const n of [2,4,8,16]){const s=samplerDescriptor('af'+n);assert.equal(s.maxAnisotropy,n);for(const k of ['magFilter','minFilter','mipmapFilter'])assert.equal(s[k],'linear');}
 assert.equal(samplerDescriptor('manual32').maxAnisotropy,1);assert.equal(samplerDescriptor('nearest').magFilter,'nearest');assert.equal(samplerDescriptor('bilinear').mipmapFilter,'nearest');
});
test('jitter sequences are deterministic, bounded, and repeat at their sample target',()=>{
 for(const pattern of CHOICES.jitterPattern)for(const target of CHOICES.temporalSamples){const s=withSettings({jitterPattern:pattern,temporalSamples:target,jitterScale:2});for(let frame=0;frame<32;frame++){const a=frameJitter(frame,s),b=frameJitter(frame,s);assert.deepEqual(a,b);assert(a.every(v=>Number.isFinite(v)&&Math.abs(v)<=1));if(target!=='off')assert.deepEqual(a,frameJitter(frame+Number(target),s));else assert.deepEqual(a,[0,0]);}}
 assert.equal(halton(1,2),.5);assert.equal(halton(2,2),.25);
});
test('camera jitter and inverse ray reconstruction agree in screen space',()=>{
 const pos=[3,12,-7],forward=normal([.4,-.2,.8]),width=1024,height=640,c=cameraMatrix(pos,forward,width/height),jitter=[.375,-.2],matrix=jitterMatrix(c.matrix,jitter,width,height);
 for(const uv of [[.1,.2],[.5,.5],[.9,.8]]){const q=[uv[0]-jitter[0]/width,uv[1]-jitter[1]/height],ray=normal(forward.map((f,i)=>f+c.right[i]*(q[0]*2-1)*width/height*c.tan+c.up[i]*(1-q[1]*2)*c.tan)),p=[...pos.map((v,i)=>v+ray[i]*300),1],clip=[0,0,0,0];for(let row=0;row<4;row++)for(let col=0;col<4;col++)clip[row]+=matrix[col*4+row]*p[col];assert(Math.abs(clip[0]/clip[3]*.5+.5-uv[0])<1e-6);assert(Math.abs(-clip[1]/clip[3]*.5+.5-uv[1])<1e-6);}
});
test('camera cuts are separated from small navigation changes',()=>{
 const camera={mode:'liquid',position:[0,12,0],forward:[0,0,1],orbit:330};assert(cameraDiscontinuity(null,camera));assert(!cameraDiscontinuity(camera,{...camera,position:[1,12,1]}));assert(cameraDiscontinuity(camera,{...camera,mode:'mesh'}));assert(cameraDiscontinuity(camera,{...camera,position:[500,12,0]}));assert(cameraDiscontinuity(camera,{...camera,forward:[1,0,0]}));
});
test('shared uniform block stays finite and packs independent feedback opacity/persistence',()=>{
 const uniforms=new Float32Array(176);uniforms.set([0,12,0,0],16);uniforms.set([1,0,0,1.6],20);uniforms.set([0,1,0,.5],24);uniforms.set([0,0,1],28);uniforms.set([0,1,0],136);
 const p=packKinetic(withSettings({feedbackAmount:.2,feedbackPersistence:.95}),{uniforms,width:320,height:200,outputWidth:320,outputHeight:200,frames:5},{time:1,volume:{blend:.5}},1/60);assert.equal(p.byteLength,1280);assert([...p].every(Number.isFinite));assert(Math.abs(p[36*4]-.2)<1e-6);assert(Math.abs(p[53*4]-.95)<1e-6);
});
test('density and cached light have independent clocks and immediate budget edits',()=>{
 const v=new XenoVolumeGPU({r:{uniforms:new Float32Array(176)},d:null});v.first=true;let s=withSettings({volumeDensityFPS:10,volumeLightFPS:5});v.prepare(s,0);assert(v.densityDue&&v.lightDue);v.first=false;v.prepare(s,.05);assert(!v.densityDue&&!v.lightDue);v.prepare(s,.1);assert(v.densityDue&&!v.lightDue);v.prepare(s,.2);assert(v.densityDue&&v.lightDue);
 s=withSettings({...s,volumeDensityFPS:.1,volumeLightFPS:.1});v.prepare(s,.21);assert(v.densityDue&&v.lightDue);v.prepare(s,.3);assert(!v.densityDue&&!v.lightDue);
 s=withSettings({...s,volumeLighting:'mip-shadow'});v.prepare(s,.31);assert(!v.densityDue&&v.lightDue&&v.mipsDue);
 s=withSettings({...s,volumeDensityFPS:60});v.prepare(s,.32);assert(v.densityDue);v.prepare(s,.354);assert(v.densityDue);
});
test('volume blend interpolation progresses between generations without reallocating',()=>{
 const v=new XenoVolumeGPU({r:{uniforms:new Float32Array(176)},d:null}),s=withSettings({volumeDensityFPS:10,volumeLightFPS:5});v.first=true;v.prepare(s,0);v.first=false;v.prepare(s,.05);assert(Math.abs(v.blend-.5)<1e-9);assert.equal(v.generations,1);v.prepare(s,.101);assert.equal(v.generations,2);assert.equal(v.current,1);
});
test('temporal reset invalidates only requested history without conflating tracks',()=>{
 const t=new TemporalFieldGPU({d:null});for(const name of ['scene','volume','feedback'])t.tracks.set(name,{valid:true,age:16});t.reset('volume','cache resized');assert.equal(t.tracks.get('volume').valid,false);assert.equal(t.tracks.get('scene').age,16);assert.equal(t.tracks.get('feedback').valid,true);t.reset(null,'camera cut');for(const value of t.tracks.values()){assert.equal(value.valid,false);assert.equal(value.age,0);}assert.equal(t.lastReset,'camera cut');
});
test('blue-noise tile is self-contained with balanced byte ranks',()=>{
 const noise=blueNoiseBytes();assert.equal(noise.length,64*64);const counts=new Uint32Array(256);for(const value of noise)counts[value]++;assert(counts.every(n=>n===16));assert.deepEqual(noise,blueNoiseBytes());
});

test('field mode only runs spectral compute when a live volume consumes it',()=>{
 assert.equal(needsSpectralFFT(withSettings({sceneMode:'field'})),false);
 assert.equal(needsSpectralFFT(withSettings({sceneMode:'field',volumeEnabled:true,volumeSource:'perlin'})),false);
 assert.equal(needsSpectralFFT(withSettings({sceneMode:'field',volumeEnabled:true,volumeSource:'spectral'})),true);
 assert.equal(needsSpectralFFT(withSettings({sceneMode:'field',volumeEnabled:true,volumeSourceB:'spectral'})),true);
 assert.equal(needsSpectralFFT(withSettings({sceneMode:'field',volumeEnabled:true,volumeSource:'spectral',paused:true})),false);
});


test('procedural cloud panel preserves the reference playground control vocabulary and order',()=>{
 const expected=['procCloudEnabled','procCloudDensity','procCloudCoverage','procCloudScale','procCloudAltitude','procCloudDetail','procCloudWindSpeed','procCloudSkipLight','procCloudRaySteps','procCloudLightSteps','procCloudShadowDark','procCloudSunIntensity','procCloudHeight','procCloudCacheRes','procCloudCacheUpdate','procCloudCacheSmooth'];
 assert.deepEqual(PANEL_DEFINITIONS.proceduralClouds.keys.slice(0,expected.length),expected);
 for(const key of expected)assert(Object.hasOwn(DEFAULTS,key),key);
});

test('reference-video cellular membrane preset captures the demonstrated extreme end-stop state',()=>{
 const p=BUILTIN_PANEL_PRESETS.proceduralClouds['VIDEO · CELL MEMBRANES'].settings;
 assert.deepEqual(Object.fromEntries(['procCloudDensity','procCloudCoverage','procCloudScale','procCloudAltitude','procCloudDetail','procCloudWindSpeed','procCloudRaySteps','procCloudLightSteps','procCloudShadowDark','procCloudSunIntensity','procCloudHeight','procCloudCacheRes','procCloudCacheUpdate','procCloudCacheSmooth'].map(k=>[k,p[k]])),{
  procCloudDensity:4,procCloudCoverage:1,procCloudScale:5.85,procCloudAltitude:.58,procCloudDetail:0,procCloudWindSpeed:.15,procCloudRaySteps:16,procCloudLightSteps:1,procCloudShadowDark:20,procCloudSunIntensity:20,procCloudHeight:5,procCloudCacheRes:128,procCloudCacheUpdate:1,procCloudCacheSmooth:.95
 });
});

test('procedural cloud cache is budget-aware while retaining the requested extreme cache at normal budgets',()=>{
 assert.equal(effectiveCloudCacheResolution(withSettings({procCloudCacheRes:128,textureBudgetMB:768})),128);
 const constrained=effectiveCloudCacheResolution(withSettings({procCloudCacheRes:256,textureBudgetMB:64}));assert(constrained>=16&&constrained<256);
 const p=planRenderSize(withSettings({procCloudEnabled:true,procCloudCacheRes:256,textureBudgetMB:64,ssaaArea:'8',msaa:'4'}),3840,2160,1.5,{maxTextureDimension2D:8192});assert(p.estimatedBytes<=p.budgetBytes,JSON.stringify(p));
});

test('procedural cloud cache cadence and interpolation are independent of display FPS',()=>{
 const cloud=new ProceduralCloudGPU({r:{},d:null});let s=withSettings({procCloudCacheUpdate:4,procCloudWindSpeed:.15});
 cloud.first=true;cloud.prepare(s,10,0);assert(cloud.densityDue);assert.equal(cloud.generations,1);assert.equal(cloud.cloudTime,1.5);
 cloud.first=false;cloud.prepare(s,10.01,1);assert(!cloud.densityDue);assert(cloud.blend>0&&cloud.blend<1);
 cloud.prepare(s,10.02,4);assert(cloud.densityDue);assert.equal(cloud.generations,2);
 s=withSettings({...s,procCloudScale:5.85});cloud.prepare(s,10.03,5);assert(cloud.densityDue,'generator edits bypass the cadence');
});

test('shared kinetic block packs cloud optics and independent world transform',()=>{
 const uniforms=new Float32Array(176);uniforms.set([0,12,0,0],16);uniforms.set([1,0,0,1.6],20);uniforms.set([0,1,0,.5],24);uniforms.set([0,0,1],28);uniforms.set([0,1,0],136);
 const s=withSettings({procCloudDensity:4,procCloudCoverage:1,procCloudScale:5.85,procCloudAltitude:.58,procCloudCenterX:123,procCloudCenterY:-45,procCloudCenterZ:67,procCloudSizeX:321,procCloudSizeY:54,procCloudSizeZ:678,procCloudRaySteps:16,procCloudLightSteps:1});
 const graph={time:2,cloud:{blend:.75,cloudTime:.3},aux:{mipCount:1}};const p=packKinetic(s,{uniforms,width:320,height:200,outputWidth:320,outputHeight:200,frames:5,hdriAvailable:false},graph,1/60);
 assert.deepEqual(Array.from(p.slice(61*4,61*4+4)),[4,1,5.85,.58].map(Math.fround));assert.deepEqual(Array.from(p.slice(64*4,64*4+4)),[123,-45,67,16]);assert.deepEqual(Array.from(p.slice(65*4,65*4+4)),[321,54,678,1]);
});
