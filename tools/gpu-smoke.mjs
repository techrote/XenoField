/** Optional offscreen WebGPU integration test. Requires Dawn's native Node binding.
 * NATIVE_DAWN=/absolute/path/dawn.node node tools/gpu-smoke.mjs
 * Alternatively install the official optional `webgpu` package outside the release.
 * This tests real GPU command validation; only the presentation canvas is emulated.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {statistics,readTexture,writePresentationPNG} from './gpu-readback.mjs';
import {KINETIC_DEMOS} from '../src/core/kinetic-presets.js';
import {XenoVolumeGPU} from '../src/render/kinetic/xenovolume.js';
import {safePipeline,texture,renderPass} from '../src/render/kinetic/gpu-utils.js';
import {parseOBJ} from '../src/mesh/mesh-tools.js';
import {decodeEXRLocal} from '../src/environment/exr.js';
import {mipChain} from '../src/environment/pattern.js';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {XenofieldRenderer} from '../src/render/renderer.js';
import {StateStore} from '../src/core/store.js';
import {DEFAULTS,CHOICES,MASK_SOURCES,PROJECTION_MAPPINGS,cleanSettings} from '../src/core/parameters.js';
const require=createRequire(import.meta.url),native=process.env.NATIVE_DAWN?require(process.env.NATIVE_DAWN):await import('webgpu');
Object.assign(globalThis,native.globals);const nativeBackend=process.env.NATIVE_DAWN_BACKEND||'vulkan';Object.defineProperty(globalThis.navigator,'gpu',{configurable:true,value:native.create([`backend=${nativeBackend}`])});globalThis.devicePixelRatio=1;
const originalFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{const u=url instanceof URL?url:new URL(String(url),new URL('../',import.meta.url));if(u.protocol==='file:')return new Response(await fs.readFile(fileURLToPath(u)));return originalFetch(url,options);};
const root=fileURLToPath(new URL('../',import.meta.url)),outDir=process.env.GPU_TEST_OUT||path.join(root,'docs','validation');await fs.mkdir(outDir,{recursive:true});
class TestCanvas{
 constructor(w=320,h=200){this.clientWidth=w;this.clientHeight=h;this.width=w;this.height=h;this.context={configure:config=>{this.device=config.device;this.format=config.format;},unconfigure:()=>{this.target?.destroy();this.target=null;},getCurrentTexture:()=>{if(!this.target||this.target.width!==this.width||this.target.height!==this.height){const old=this.target;this.target=this.device.createTexture({label:'offscreen test presentation',size:[this.width,this.height],format:this.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});if(old)this.device.queue.onSubmittedWorkDone().then(()=>old.destroy());}return this.target;}};}
 getContext(name){if(name!=='webgpu')throw new Error('Only WebGPU is emulated by this presentation target.');return this.context;}
}
const canvas=new TestCanvas(),errors=[];let r=new XenofieldRenderer(canvas,message=>{errors.push(message);console.error(message);});const store=new StateStore(null);let settings=cleanSettings({...DEFAULTS,sceneMode:'field',sourceWidth:32,envMapWidth:64,meshResolution:64,renderScale:1,displayFPS:30});
const report={kind:'Native Dawn / software-adapter integration validation; not a browser or hardware benchmark',started:new Date().toISOString(),initialization:false,cases:[],errors};
async function frame(s,count=2){for(let i=0;i<count;i++){r.render(1/30,s,store.palettes[s.lutSlot]);await r.device.queue.onSubmittedWorkDone();await new Promise(resolve=>setTimeout(resolve,0));}if(!r.ready||r.lost)throw Error('Renderer stopped after a GPU error.');}
async function run(name,patch,count=2){const startErrors=errors.length;settings=cleanSettings({...settings,...patch});const geometryKey=JSON.stringify([settings.meshAsset,r.meshConditionSettings(settings)]);if(geometryKey!==r.__testGeometryKey){r.setMeshAsset(settings.meshAsset,settings);r.__testGeometryKey=geometryKey;}if(r.meshN!==settings.meshResolution)r.setMeshResolution(settings.meshResolution);r.resize(settings,true);r.setPalette(store.palettes[settings.lutSlot]);await frame(settings,count);report.cases.push({name,errors:errors.slice(startErrors),renderSize:[r.width,r.height],passes:{...r.kinetic?.passCounts},metrics:r.kinetic?.metrics()});console.log('CASE',name,errors.length-startErrors?'ERROR':'OK');assert.equal(errors.length,startErrors,`GPU validation errors in ${name}`);await fs.writeFile(path.join(outDir,'native-webgpu.json'),JSON.stringify(report,null,2));}
async function probe(texture,label){const image=await readTexture(r.device,texture),stats=statistics(image);assert.equal(stats.nonfinite,0,`${label} contains nonfinite pixels`);return {image,stats};}
async function shot(label){const {image,stats}=await probe(canvas.target,label);await writePresentationPNG(path.join(outDir,label+'.png'),image);report.cases.at(-1).presentation=stats;}

async function renderDemos(){
  // Actual preset images; all use their shipped values except bounded test-screen/mesh budgets.
  canvas.clientWidth=480;canvas.clientHeight=300;r.resetCamera();
  for(const name of Object.keys(KINETIC_DEMOS)){canvas.clientWidth=name==='ABSURD AA'?160:480;canvas.clientHeight=name==='ABSURD AA'?100:300;store.applyGlobalStack(name);settings=cleanSettings({...store.settings,sourceWidth:64,envMapWidth:128,meshResolution:64});await run(`demo ${name}`,{},name==='ABSURD AA'?2:6);await shot('demo-'+name.toLowerCase().replaceAll(' ','-'));}
  assert.equal(new Set(report.cases.filter(c=>c.presentation).map(c=>c.presentation.sha256)).size,10,'Demo strategies must not all render the same image');
}

try{
 await r.init(settings);r.setPalette(store.palettes[settings.lutSlot]);report.initialization=r.ready;report.adapter={vendor:r.adapter.info.vendor,architecture:r.adapter.info.architecture,device:r.adapter.info.device,description:r.adapter.info.description};report.kineticInitializationErrors={...r.kinetic?.errors};await run('all effects off',{},2);
 if(process.env.GPU_TEST_CLOUD==='1'){
  await run('procedural cloud reference',{procCloudEnabled:true,procCloudCacheRes:24,procCloudRaySteps:16,procCloudLightSteps:1,procCloudCenterX:0,procCloudCenterY:12,procCloudCenterZ:0,procCloudSizeX:420,procCloudSizeY:220,procCloudSizeZ:420},2);assert(r.kinetic.cloud.generations>0&&r.kinetic.passCounts['Cloud Raymarch']&&r.kinetic.passCounts['Cloud Composite']);
  await run('procedural cloud video cellular extreme',{procCloudDensity:4,procCloudCoverage:1,procCloudScale:5.85,procCloudAltitude:.58,procCloudDetail:0,procCloudWindSpeed:.15,procCloudRaySteps:16,procCloudLightSteps:1,procCloudShadowDark:20,procCloudSunIntensity:20,procCloudHeight:5,procCloudCacheRes:32,procCloudCacheUpdate:1,procCloudCacheSmooth:.95,procCloudCenterX:71,procCloudCenterY:44,procCloudCenterZ:-35,procCloudSizeX:333,procCloudSizeY:177,procCloudSizeZ:281},2);assert.deepEqual(r.kinetic.cloud.metrics().worldCenter,[71,44,-35]);assert.deepEqual(r.kinetic.cloud.metrics().worldSize,[333,177,281]);
  await run('procedural cloud disabled bypass',{procCloudEnabled:false},1);assert.equal(r.kinetic.passCounts['Cloud Density'],undefined);assert.equal(r.kinetic.passCounts['Cloud Raymarch'],undefined);assert.equal(r.kinetic.cloud.n,0);
 }
 if(process.env.GPU_DEMO_ONLY==='1')await renderDemos();
 if(process.env.GPU_TEST_INITIAL!=='1'&&process.env.GPU_DEMO_ONLY!=='1'){
  await run('depth / pyramid / bands',{depthEnabled:true,depthOperator:'bands'},3);
  await run('stable + feedback independent',{temporalSamples:'8',feedbackEnabled:true,feedbackBlend:'screen'},3);
  await run('32 cube sparse volume',{volumeEnabled:true,volumeSpace:'camera-slab',volumeResolution:'32',volumeSteps:'8',volumeRenderScale:'4',volumeLighting:'gradient'},4);
  await run('cached short march',{volumeLighting:'cached-march',volumeLightFPS:30},2);
  await run('cached mip shadow',{volumeLighting:'mip-shadow',volumeLightFPS:30},2);
  await run('signed bloom / distortion',{positiveEnabled:true,darkEnabled:true,distortionEnabled:true,distortionSource:'volume-gradient',colourEnabled:true},3);
  await run('scene material depth mask',{sceneMode:'liquid',maskEnabled:true,maskSourceA:'scene-depth',maskSourceB:'volume-density',maskFoam:true},3);
  await run('MSAA4 + SSAA2 + Temporal32',{msaa:'4',ssaaArea:'2',temporalSamples:'32'},3);
  await run('SSAA8 bounded / AF16',{ssaaArea:'8',textureFilter:'af16'},2);
  await run('mesh + manual AF32',{sceneMode:'mesh',ssaaArea:'1',textureFilter:'manual32',volumeSpace:'mesh-normal-shell'},2);
  await run('planet shell',{sceneMode:'planet',volumeSpace:'planet-shell',volumeOffsetY:0},2);
  canvas.clientWidth=353;canvas.clientHeight=217;await run('resize active histories',{},2);
  await run('disable all optional passes',{sceneMode:'field',volumeEnabled:false,depthEnabled:false,distortionEnabled:false,feedbackEnabled:false,positiveEnabled:false,darkEnabled:false,colourEnabled:false,temporalEnabled:false,temporalSamples:'off',maskEnabled:false,kineticDebug:'final',ssaaArea:'1',msaa:'1'},2);
 }

 if(process.env.GPU_TEST_MATRIX==='1'){
  canvas.clientWidth=192;canvas.clientHeight=120;
  await run('matrix baseline',{...DEFAULTS,sceneMode:'field',sourceWidth:32,envMapWidth:64,meshResolution:64,volumeEnabled:true,volumeSpace:'camera-slab',volumeSteps:'8',volumeRenderScale:'4',volumeSource:'perlin',volumeSourceB:'ridge',volumeDensityFPS:60,volumeLightFPS:60},2);
  for(const value of CHOICES.volumeResolution){await run(`cache ${value}³`,{volumeResolution:value},2);const {stats}=await probe(r.kinetic.volume.caches[r.kinetic.volume.current],'voxel cache');assert(stats.mean[0]>0,'Density cache must not be empty');assert(stats.mean[1]>0,'Cached light must be used');assert(stats.mean[2]>0,'Structural channel must be used');assert(stats.mean[3]>0,'Emission channel must be used');report.cases.at(-1).cache=stats;}
  for(const value of CHOICES.volumeSteps)await run(`ray steps ${value}`,{volumeResolution:'24',volumeSteps:value},1);
  for(const value of CHOICES.volumeRenderScale)await run(`ray resolution 1/${value}`,{volumeRenderScale:value},1);
  for(const value of CHOICES.volumeLighting)await run(`lighting ${value}`,{volumeRenderScale:'4',volumeLighting:value,volumeLightSteps:4},2);
  for(const value of CHOICES.volumeSpace){await run(`space ${value}`,{sceneMode:value==='planet-shell'?'planet':value.includes('mesh')?'mesh':value==='surface-shell'?'liquid':'field',volumeSpace:value,volumeOffsetY:0},2);const {stats}=await probe(r.kinetic.volume.raw,'raw volume');report.cases.at(-1).rawVolume=stats;assert(stats.min[3]>=0&&stats.max[3]<=1.001);}
  for(const value of CHOICES.volumeSource)await run(`generator ${value}`,{volumeSource:value,sceneMode:'field',volumeSpace:'camera-slab',volumeResolution:'16'},1);
  const spectralTime=r.ocean.time;await run('field volume drives live spectral compute',{sceneMode:'field',volumeSource:'spectral'},2);assert(r.ocean.time>spectralTime);const restingTime=r.ocean.time;await run('field procedural source stops spectral compute',{volumeSource:'perlin',volumeSourceB:'ridge'},2);assert.equal(r.ocean.time,restingTime);
  for(const value of CHOICES.volumeShape)await run(`shape ${value}`,{volumeShape:value},1);
  for(const value of CHOICES.volumeGeneratorBlend)await run(`generator blend ${value}`,{volumeGeneratorBlend:value},1);
  for(const value of CHOICES.volumeDitherType)await run(`dither ${value}`,{volumeDitherType:value},1);
  for(const value of CHOICES.volumeBlend)await run(`volume blend ${value}`,{volumeBlend:value},1);
  for(const value of CHOICES.textureFilter)await run(`surface filter ${value}`,{sceneMode:'mesh',textureFilter:value},1);
  for(const value of CHOICES.downsampleFilter)await run(`SSAA reconstruction ${value}`,{downsampleFilter:value,ssaaArea:'2',msaa:'4'},1);
  for(const value of CHOICES.temporalSamples)await run(`temporal target ${value}`,{ssaaArea:'1',msaa:'1',temporalSamples:value,feedbackEnabled:true},2);
  for(const value of CHOICES.feedbackBlend){await run(`feedback blend ${value}`,{feedbackBlend:value},2);const {stats}=await probe(r.kinetic.temporal.current('feedback'),'feedback');report.cases.at(-1).feedback=stats;}
  const tracks=r.kinetic.temporal.tracks;assert.notEqual(tracks.get('scene').buffers[0],tracks.get('feedback').buffers[0]);assert.notEqual(tracks.get('scene').buffers[0],tracks.get('volume').buffers[0]);
  for(const value of CHOICES.depthOperator)await run(`depth operator ${value}`,{depthEnabled:true,depthOperator:value},1);
  for(const value of CHOICES.distortionSource)await run(`distortion ${value}`,{distortionEnabled:true,distortionSource:value},1);
  for(const value of CHOICES.kineticDebug){await run(`debug ${value}`,{kineticDebug:value,positiveEnabled:true,darkEnabled:true,colourEnabled:true},1);const {stats}=await probe(r.displayTexture,'debug HDR');report.cases.at(-1).debug=stats;}
  await run('coincident depth endpoints and hard thresholds',{kineticDebug:'final',depthNear:100,depthFar:100,depthSoftness:0,depthThreshold:1,depthGamma:.05,volumeSoftness:0,volumeThreshold:1,volumeQuantize:96,volumeSlices:128,volumeStepQuantize:128,volumeDropout:1},2);await probe(r.displayTexture,'extreme depth / empty volume');
  await run('extreme feedback remains finite',{feedbackEnabled:true,feedbackPersistence:1,feedbackAmount:1,feedbackGain:8,feedbackDecay:1,feedbackZoom:.1,feedbackWarp:1,feedbackRotation:720,feedbackHue:720},6);await probe(r.displayTexture,'extreme feedback');
  // Camera jumps, same-size volume-target replacement, and mode changes must reset histories.
  await run('new cache target with scene volume mask',{...DEFAULTS,sceneMode:'mesh',volumeEnabled:true,volumeSpace:'mesh-normal-shell',volumeRenderScale:'4',maskEnabled:true,maskSourceA:'volume-density',maskSourceB:'feedback',temporalSamples:'8',feedbackEnabled:true,meshResolution:64,sourceWidth:32,envMapWidth:64},2);
  await run('same scene allocation / new volume target',{volumeRenderScale:'3'},2);
  const resetBefore=r.kinetic.temporal.resetCount;r.camera.yaw+=2;await run('camera cut',{},1);assert(r.kinetic.temporal.resetCount>resetBefore);assert.equal(r.kinetic.temporal.tracks.get('scene').age,1);
  await run('slow density and light clocks',{sceneMode:'field',volumeSpace:'camera-slab',volumeSource:'perlin',volumeShape:'none',volumeThreshold:.35,volumeSoftness:.1,volumeDropout:0,volumeDensityFPS:.1,volumeLightFPS:.1},1);const generation=r.kinetic.volume.generations,lights=r.kinetic.volume.lightingUpdates,caches=[...r.kinetic.volume.cacheTextures];await frame(settings,4);assert.equal(r.kinetic.volume.generations,generation);assert.equal(r.kinetic.volume.lightingUpdates,lights);assert.deepEqual(r.kinetic.volume.cacheTextures,caches);
  await run('lighting edit bypasses slow cadence',{volumeLighting:'cached-march'},1);assert(r.kinetic.volume.lightingUpdates>lights);
  await run('one density generation each frame',{volumeDensityFPS:60,volumeLightFPS:60},2);const fastGeneration=r.kinetic.volume.generations;await frame(settings,3);assert.equal(r.kinetic.volume.generations-fastGeneration,3);
  // Exercise shared projection helpers and the extended router, not just their enumerations.
  for(const projection of PROJECTION_MAPPINGS)await run(`shared surface/cache projection ${projection}`,{sceneMode:'mesh',volumeSpace:'mesh-normal-shell',volumeSource:'projection',projectionA:projection,volumeResolution:'16',volumeSteps:'4',volumeDensityFPS:30,maskEnabled:false},1);
  for(const source of MASK_SOURCES.slice(12))await run(`scene and cache mask ${source}`,{sceneMode:'mesh',volumeUseMask:true,volumeMask:'router',maskEnabled:true,maskSourceA:source,maskSourceB:'constant',maskSourceMix:0,maskFoam:true},1);
  // Imported geometry and a same-asset conditioning change invalidate active histories.
  const imported=parseOBJ('v -1 -1 -1\nv 1 -1 -1\nv 0 1 -1\nv 0 0 1\nf 1 3 2\nf 1 2 4\nf 2 3 4\nf 3 1 4');imported.name='Native test tetrahedron';r.setImportedMesh(imported,settings);
  await run('imported OBJ with a normal shell',{meshAsset:'imported',volumeUseMask:false,maskEnabled:false,temporalSamples:'8'},2);assert.equal(r.meshStats.asset,'imported');assert.equal(r.meshAssetName,imported.name);
  const geometryResets=r.kinetic.temporal.resetCount;await run('same imported asset rebuilt at another scale',{meshScale:90},1);assert(r.kinetic.temporal.resetCount>geometryResets);
  // All min-depth pyramid texels match CPU reference reductions, including odd extents.
  canvas.clientWidth=193;canvas.clientHeight=121;
  await run('odd-sized linear-depth pyramid pixels',{...DEFAULTS,sceneMode:'planet',depthEnabled:true,meshResolution:64,sourceWidth:32,envMapWidth:64},2);
  let previous=await readTexture(r.device,r.kinetic.aux.depth);let checkedDepthTexels=0;
  for(let mip=1;mip<r.kinetic.aux.mipCount;mip++){const current=await readTexture(r.device,r.kinetic.aux.pyramid,mip);for(let y=0;y<current.height;y++)for(let x=0;x<current.width;x++){let expected=Infinity;for(let sy=Math.floor(y*previous.height/current.height);sy<Math.ceil((y+1)*previous.height/current.height);sy++)for(let sx=Math.floor(x*previous.width/current.width);sx<Math.ceil((x+1)*previous.width/current.width);sx++)expected=Math.min(expected,previous.values[sy*previous.width+sx]);assert(Math.abs(expected-current.values[y*current.width+x])<.001);checkedDepthTexels++;}previous=current;}report.depthPyramidCheckedTexels=checkedDepthTexels;
  // Low-resolution volume depths must not penetrate the corresponding full-resolution foreground.
  await run('depth-clipped shell pixel contract',{volumeEnabled:true,volumeSpace:'planet-shell',volumeOffsetY:0,volumeDensity:1,volumeTemporal:false,volumeDither:0,volumeDropout:0,volumeDepthClip:true},2);
  const fullDepth=await readTexture(r.device,r.kinetic.aux.depth),rawDepth=await readTexture(r.device,r.kinetic.volume.depth),rawVolume=await readTexture(r.device,r.kinetic.volume.raw);let checkedVolumePixels=0;
  for(let y=0;y<rawDepth.height;y++)for(let x=0;x<rawDepth.width;x++){const i=y*rawDepth.width+x;if(rawVolume.values[i*4+3]<.001)continue;const sx=Math.min(fullDepth.width-1,Math.floor((x+.5)*fullDepth.width/rawDepth.width)),sy=Math.min(fullDepth.height-1,Math.floor((y+.5)*fullDepth.height/rawDepth.height));assert(rawDepth.values[i]<=fullDepth.values[sy*fullDepth.width+sx]+.01);checkedVolumePixels++;}assert(checkedVolumePixels>0);report.depthClippedVolumePixels=checkedVolumePixels;
  // Normalized blur must preserve a constant HDR image through both separable directions.
  const constant=texture(r.device,'TEST constant HDR',2,2),horizontal=texture(r.device,'TEST blur horizontal',9,7),vertical=texture(r.device,'TEST blur vertical',9,7);r.device.queue.writeTexture({texture:constant},new Uint16Array([14336,13312,15360,15360,14336,13312,15360,15360,14336,13312,15360,15360,14336,13312,15360,15360]),{bytesPerRow:16},[2,2]);
  const blurEncoder=r.device.createCommandEncoder();renderPass(blurEncoder,r.kinetic.pipelines.positiveH,r.kinetic.group({image:constant}),[horizontal],'TEST normalized blur H');renderPass(blurEncoder,r.kinetic.pipelines.positiveV,r.kinetic.group({image:horizontal}),[vertical],'TEST normalized blur V');r.device.queue.submit([blurEncoder.finish()]);const blurred=await probe(vertical,'constant bloom blur');for(let c=0;c<3;c++)assert(Math.abs(blurred.stats.mean[c]-[.5,.25,1][c])<.002);report.constantBloom=blurred.stats;constant.destroy();horizontal.destroy();vertical.destroy();
  // Actual local EXR decode -> half-float environment upload -> HDRI/SkySynth mixing.
  const bytes=await fs.readFile(path.join(root,'assets/calibration-panorama.exr')),decoded=await decodeEXRLocal(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),{maxWidth:128,maxHeight:64});r.queueEnvironment({levels:mipChain(decoded.data,decoded.width,decoded.height)},'hdri');
  await run('EXR environment with compositor and mixer',{...DEFAULTS,sceneMode:'mesh',meshAsset:'d20',volumeEnabled:true,volumeSpace:'mesh-normal-shell',envMode:'hdri',mixerEnabled:true,mixerMix:.5,noixtureEnabled:true,maskEnabled:true,maskSourceA:'normal-facing',maskMixer:true,volumeEnvironment:.5,temporalSamples:'8',sourceWidth:32,envMapWidth:64,meshResolution:64},2);assert(r.hdriAvailable);await probe(r.displayTexture,'EXR mixed scene');
  await run('volume environment SkySynth reference',{...DEFAULTS,sceneMode:'field',paused:true,volumeEnabled:true,volumeSpace:'camera-slab',volumeRange:100,volumeDensity:.1,volumeCoverage:1,volumeThreshold:.2,volumeDither:0,volumeDropout:0,volumeTemporal:false,volumeInterpolate:false,volumeEnvironment:1,volumeColor:'FFFFFF',volumeLightColor:'000000',volumeAmbient:0,volumeRim:0,volumeEmission:0,volumeCellEdges:0,sourceWidth:32,envMapWidth:64,meshResolution:64},2);const synthVolume=await probe(r.kinetic.volume.raw,'SkySynth volume');
  r.queueEnvironment({levels:mipChain(new Float32Array([8,0,0,1]),1,1)},'hdri');await run('volume environment consumes selected HDRI',{envMode:'hdri'},2);const hdriVolume=await probe(r.kinetic.volume.raw,'HDRI volume');assert(hdriVolume.stats.mean[0]>synthVolume.stats.mean[0]+.01);assert(hdriVolume.stats.max[1]<.001&&hdriVolume.stats.max[2]<.001);report.volumeEnvironment={skysynth:synthVolume.stats,hdri:hdriVolume.stats};
  // Pixel-level absorption evidence with deterministic sampling and identical geometry.
  await run('absorption low',{...DEFAULTS,sceneMode:'field',meshResolution:64,sourceWidth:32,envMapWidth:64,paused:true,volumeEnabled:true,volumeSpace:'camera-slab',volumeRange:100,volumeDensity:.1,volumeCoverage:1,volumeThreshold:.2,volumeDither:0,volumeDropout:0,volumeTemporal:false,volumeInterpolate:false,volumeAbsorption:.1},2);const low=await probe(r.kinetic.volume.raw,'low absorption');
  await run('absorption high',{volumeAbsorption:4},2);const high=await probe(r.kinetic.volume.raw,'high absorption');assert(high.stats.mean[3]>low.stats.mean[3]+.01,'Absorption must affect actual ray transmission');report.absorption={low:low.stats,high:high.stats};
  // Force the validated fallback, not just its source string.
  r.kinetic.volume.dispose();r.kinetic.volumeResult=null;r.kinetic.volume=new XenoVolumeGPU(r.kinetic);await r.kinetic.volume.init(['rgba16float']);await run('RGBA16F cache fallback execution',{paused:false,volumeResolution:'24',volumeLighting:'mip-shadow'},2);assert.equal(r.kinetic.volume.format,'rgba16float');await probe(r.kinetic.volume.raw,'fallback volume');
  // Fail-open behaviour: disabled optional owners preserve the same authoritative base scene.
  r.kinetic.volume.ready=false;await run('fail-open unavailable volume',{},1);assert.equal(r.kinetic.passCounts['Volume Raymarch'],undefined);r.kinetic.volume.ready=true;
  const reduce=r.kinetic.aux.reduce;r.kinetic.aux.reduce=null;await run('fail-open unavailable depth pyramid',{depthEnabled:true},1);assert.equal(r.kinetic.passCounts['Depth Pyramid'],undefined);r.kinetic.aux.reduce=reduce;
  r.kinetic.temporal.ready=false;await run('fail-open unavailable temporal',{temporalSamples:'8',feedbackEnabled:true},1);assert.equal(r.kinetic.passCounts.Temporal,undefined);r.kinetic.temporal.ready=true;
  r.msaaAvailable=false;await run('MSAA setup fallback to 1x',{msaa:'4'},1);assert.equal(r.sampleCount,1);r.msaaAvailable=true;
  const beforeErrors=errors.length;await assert.rejects(()=>safePipeline(r.device,'EXPECTED TEST shader failure','this is not valid WGSL'));await run('valid frame after isolated shader failure',{msaa:'1'},1);assert.equal(errors.length,beforeErrors);
  await renderDemos();
  await run('final all-off bypass',{...DEFAULTS,sceneMode:'field',sourceWidth:32,envMapWidth:64,meshResolution:64,msaa:'1',ssaaArea:'1'},2);assert.deepEqual(r.kinetic.passCounts,{});assert.equal(r.kinetic.volume.n,0);assert.equal(r.kinetic.temporal.tracks.size,0);assert.equal(r.kinetic.aux.targets.length,0);assert.equal(r.kinetic.ping,null);
  report.preRestart=r.metrics();r.dispose();await r.device.lost;
  r=new XenofieldRenderer(canvas,message=>{errors.push(message);console.error(message);});await r.init(settings);await run('device destroy and fresh renderer restart',{},2);assert(r.ready&&!r.lost);
 }
 report.final=r.metrics();
}catch(e){report.exception=e.stack||String(e);console.error(report.exception);}finally{report.finished=new Date().toISOString();await fs.writeFile(path.join(outDir,'native-webgpu.json'),JSON.stringify(report,null,2));r.dispose();store.dispose();}
process.exitCode=report.exception||errors.length||Object.keys(report.kineticInitializationErrors||{}).length?1:0;
