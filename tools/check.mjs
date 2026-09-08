import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {SKY,LIQUID,POST,SKYSYNTH_GPU,ENV_RECONSTRUCT,ENV_PREVIEW,MESH_SURFACE} from '../src/render/shaders.js';import * as fft from '../src/render/fft-shaders.js';import {BLEND_MODES,MASK_SOURCES,MASK_MIX_MODES} from '../src/core/parameters.js';import {PANEL_IDS,PANEL_DEFINITIONS,BUILTIN_PANEL_PRESETS,GLOBAL_PRESETS,SUBMENU_IDS,SUBMENU_DEFINITIONS,PANEL_GLOBAL_IDS} from '../src/core/presets.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');let checks=0;const check=(v,m)=>{if(!v)throw Error(m);checks++;};
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);}
for(const f of walk(path.join(root,'src')).filter(f=>f.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});check(!r.status,`${f}: ${r.stderr}`);const s=fs.readFileSync(f,'utf8');for(const m of s.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))check(fs.existsSync(path.resolve(path.dirname(f),m[1])),`Missing module ${m[1]}`);}
function wgslScopeEnd(src,pos){const start=src.lastIndexOf('{',pos);if(start<0)return src.length;let depth=0;for(let i=start;i<src.length;i++){if(src[i]==='{')depth++;else if(src[i]==='}'&&--depth===0)return i;}return src.length;}
function checkImmutableLets(src,name){for(const m of src.matchAll(/\blet\s+([A-Za-z_]\w*)\s*=/g)){const id=m[1],end=wgslScopeEnd(src,m.index),segment=src.slice(m.index+m[0].length,end),assignment=new RegExp(`(?<![.\\w])${id}\\s*(?:\\+=|-=|\\*=|/=|=(?!=))`);check(!assignment.test(segment),`${name}: immutable let ${id} is reassigned`);}}
const wgslReserved=new Set(`NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto await become bf16 binding_array cast catch class co_await co_return co_yield coherent column_major common compile compile_fragment concept const_cast consteval constexpr constinit crate debugger decltype delete demote demote_to_helper do dynamic_cast enum explicit export extends extern external fallthrough filter final finally friend from fxgroup get goto groupshared handle highp impl implements import inline instanceof interface layout lowp macro macro_rules match mediump meta mod module move mut mutable namespace new nil noexcept noinline nointerpolation non_coherent noncoherent noperspective null nullptr of operator package packoffset partition pass patch pixelfragment precise precision premerge priv protected pub public readonly ref regardless register reinterpret_cast require resource restrict self set shared sizeof smooth snorm static static_assert static_cast std subroutine super target template this thread_local throw trait try type typedef typeid typename typeof union unless unorm unsafe unsized use using varying virtual volatile wgsl where with writeonly yield`.split(/\s+/));
for(const [name,s] of Object.entries({SKY,LIQUID,POST,SKYSYNTH_GPU,ENV_RECONSTRUCT,ENV_PREVIEW,MESH_SURFACE,...fft})){
 check((s.match(/{/g)||[]).length===(s.match(/}/g)||[]).length,`${name}: braces`);
 check(!/\.[xyzwrgba]{2,4}\s*(?:\+=|-=|\*=|\/=|=(?!=))/.test(s),`${name}: illegal swizzle assignment`);
 check(!/\b(?:let|var)\s+[A-Za-z_]\w*\s*=[^;\n]+,\s*[A-Za-z_]\w*\s*=(?!=)/.test(s),`${name}: WGSL declarations must use one variable per statement`);
 for(const m of s.matchAll(/\b(?:let|var(?:\s*<[^>]+>)?)\s+([A-Za-z_]\w*)/g))check(!wgslReserved.has(m[1]),`${name}: reserved WGSL identifier ${m[1]}`);
 checkImmutableLets(s,name);
}
check(!/if\(c==8\)\{let\s+w=/.test(MESH_SURFACE)&&/if\(c==8\)\{var\s+w=/.test(MESH_SURFACE),'V4.3a-r1: triplanar weight must be mutable WGSL var, not immutable let');
const fresnel=LIQUID.match(/fn fastFresnel[^]*?return [^}]+\}/)?.[0]||LIQUID.match(/fn fastFresnel[^]*?\}/)?.[0];check(!!fresnel,'Fresnel function missing');check(/q2\*q2\*q/.test(fresnel),'Fifth power must use multiplies');
const render=fs.readFileSync(path.join(root,'src/render/renderer.js'),'utf8');check(!render.includes('||this.inflight'),'V4.2d: render loop must not block on queue.onSubmittedWorkDone frame gating');check(render.includes('frames%180===0')&&render.includes('queueHealthPending'),'V4.2d: sparse queue health check missing');check(render.includes('encodeSkySynthSource')&&render.includes('gpuSkySynth:true')&&render.includes('setPalette('),'V4.2d: GPU SkySynth source path missing');check(!/WaterVolume|GPUFauna|KelpGPU|new.*Particles/.test(render),'Underwater objects returned');check(render.includes('underwaterObjects:0'),'No underwater audit');check(render.includes('rgba16float'),'HDR format missing');check(render.includes('Mesh/projection shader unavailable:')&&render.includes('&&this.meshPipeline'),'V4.3a-r1: mesh shader failure must not collapse the core renderer');check(render.indexOf("checkedModule(d,SKY")<render.indexOf("previewContext=this.previewCanvas.getContext('webgpu')"),'V4.3a-r1: preview canvas must not be WebGPU-bound before shader validation completes');
const ui=fs.readFileSync(path.join(root,'src/ui/ui.js'),'utf8');check(ui.includes('Object.entries(PARAMETERS)'),'All numerical controls need schema-backed UI');check(ui.includes('openRange(key)'),'Missing range buttons');check(ui.includes('setPointerCapture'),'Pointer cancellation protection missing');
check(SKY.includes('60000.0')&&LIQUID.includes('60000.0'),'Both half-float scene outputs require a finite HDR ceiling');

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const store=fs.readFileSync(path.join(root,'src/core/store.js'),'utf8');
const params=fs.readFileSync(path.join(root,'src/core/parameters.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src/environment/bridge.js'),'utf8');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');check(bridge.includes('standaloneURL?new Worker(standaloneURL):new Worker('),'V4.3a-r1: standalone must use a classic Blob worker under file://');const presets=fs.readFileSync(path.join(root,'src/core/presets.js'),'utf8');const exr=fs.readFileSync(path.join(root,'src/environment/exr.js'),'utf8');check(main.includes('if(!gpuSynth)this.bridge.tick')&&main.includes('workerActive=!gpuSynth'),'V4.2d: CPU SkySynth worker must idle when GPU SkySynth is active');
check(html.includes('id="skysynth"')&&!html.includes('id="keybed"'),'V4.2a: SkySynth identity missing');
check(!html.includes('id="headerWidth"')&&!html.includes('id="headerFPS"')&&html.includes('id="samplingControls"'),'V4.2c: SkySynth resolution/FPS must live in the slider bank, not the titlebar');
for(const id of ['rangeInfo','hardMin','hardMax','functionalMin','functionalMax','absoluteBounds'])check(html.includes(`id="${id}"`),`V4.2a: advanced parameter field missing ${id}`);
check(store.includes('setSafetyCaps(')&&store.includes('functionalExtremums')&&store.includes('setFunctionalExtremums('),'V4.2a: editable safety caps / functional extrema store paths missing');
check(params.includes('defaultSafetyCaps')&&params.includes('defaultFunctionalExtremums'),'V4.2a: safety/extremum defaults missing');
check(html.includes('id="tooltipsEnabled"')&&ui.includes('applyTooltips()')&&ui.includes('data-tip'),'V4.2a: tooltip settings/path missing');
check(html.includes('class="skysynth-params"')&&ui.includes("'plasmaControls'"),'V4.2d: SkySynth horizontal slider bank missing');check(html.includes('id="skyYResize"')&&ui.includes("['skyYResize','skysynth'"),'V4.2d: SkySynth vertical drag-resize handle missing');
check(html.includes('id="keycaps"')&&ui.includes('class="sign"')&&ui.includes('class="key"'),'V4.2a: compact keycap corner labels missing');
for(const id of ['modulation','skynoixture','skymixer'])check(html.includes(`id="${id}"`)&&html.includes('sidepanel'),`V4.2a: SkySynth sidepanel missing ${id}`);
check(html.includes('id="skyModMeter"')&&ui.includes("$('skyModMeter').onclick")&&ui.includes('updateModulation'),'V4.2a: live modulation meter/toggle missing');
check(html.includes('id="upsamplingQuick"')&&ui.includes("'spatialSmooth','temporalSmooth'"),'V4.2a: compact upsampling parameters missing');
check(html.includes('accept=".exr,.hdr')&&bridge.includes('decodeEXRLocal')&&exr.includes('decodeEXRLocal')&&bridge.includes('decodeHDR'),'V4.2a: local HDR/EXR input/decoder path missing');
for(const key of ['mixerMix','noixtureAmount','noixtureScale','noixtureContrast','noixtureDrift'])check(params.includes(`${key}:`),`V4.2a: missing ${key}`);
check(LIQUID.includes('hdriTexture')&&LIQUID.includes('mixEnvironment')&&LIQUID.includes('applyNoixture'),'V4.2a: GPU environment mixer / SkyNoixture missing');
check(LIQUID.includes('rawFoam')&&LIQUID.includes('sheetFoam')&&LIQUID.includes('foamMask'),'V4.2a: enriched foam shaping missing');
check(POST.includes('sceneTexture')&&!POST.includes('detailTexture'),'V4.2a: post shader must not inherit scene-only detail bindings');
check(render.includes('Float32Array(176)')&&render.includes('binding:5')&&render.includes("pendingEnvironment={plasma:null,hdri:null}")&&render.includes('queueEnvironment')&&render.includes('encodePlasmaReconstruction')&&render.includes('GPU SkySynth preview'),'V4.2c: GPU environment renderer contract missing');
check(main.includes("version:'4.4b'")&&main.includes('mixerEnabled')&&main.includes('applyPreviewNoixture')&&main.includes('previewMask')&&main.includes('updateProfiler'),'V4.2e: main runtime integration missing');
check(main.includes('GPU RENDERER INITIALISATION FAILED')&&main.includes('fallbackReason'),'V4.2a: CPU fallback must distinguish shader/renderer failure from absent WebGPU');
check(BLEND_MODES.length===34&&new Set(BLEND_MODES).size===34,'V4.2a: expected 34 distinct performant blend modes');
for(const mode of ['normal','dissolve','luma-lighten','dodge','linear-burn','overlay','soft-light','hard-light','vivid-light','pin-light','linear-light','hard-mix','grain-extract','grain-merge','divide','hsv-hue','hsv-saturation','hsl-color','hsv-value','lch-hue','lch-chroma','lch-color','lch-lightness','luminance'])check(BLEND_MODES.includes(mode),`V4.2a: missing blend mode ${mode}`);
check(MASK_SOURCES.length>=12&&MASK_MIX_MODES.length>=7,'V4.2a: live mask source/mix banks incomplete');
for(const id of ['mixerBlend','noixtureBlend','cloudBlend','foamBlend'])check(html.includes(`id="${id}"`)&&html.includes('data-blend-select'),`V4.2a: blend selector missing ${id}`);
for(const id of ['maskEnabled','maskSourceA','maskSourceB','maskMixMode','maskInvert','maskMixer','maskNoixture','maskClouds','maskFoam','maskControls'])check(html.includes(`id="${id}"`),`V4.2a: mask UI missing ${id}`);
check(LIQUID.includes('fn blendResult')&&LIQUID.includes('fn applyBlend')&&LIQUID.includes('fn maskValue')&&LIQUID.includes('oklabComponentBlend'),'V4.2a: GPU blend/mask implementation incomplete');
check(LIQUID.includes('maskFor(1u')&&LIQUID.includes('maskFor(2u')&&LIQUID.includes('maskFor(4u')&&LIQUID.includes('maskFor(8u'),'V4.2a: mask channel is not routed to mixer/noixture/clouds/foam');
check(PANEL_IDS.length===21,'V4.4b: expected twenty-one independently presettable panels');
for(const panel of PANEL_IDS){check(!!PANEL_DEFINITIONS[panel],`V4.3a: missing panel definition ${panel}`);check(Object.keys(BUILTIN_PANEL_PRESETS[panel]||{}).length>=5,`V4.3a: panel ${panel} needs a useful built-in bank`);check(html.includes(`preset-${panel}`)||(['depth','temporal','volume','compositor','aa','performance'].includes(panel)&&ui.includes('mountKineticUI(app)'))||(panel==='proceduralClouds'&&ui.includes('mountProceduralCloudUI(app)')),`V4.3a: panel preset UI missing ${panel}`);}
check(Object.keys(GLOBAL_PRESETS).length===22,'V4.2a: expected twenty-two global stack defaults');
for(const [name,stack] of Object.entries(GLOBAL_PRESETS))for(const panel of PANEL_IDS)check(!!BUILTIN_PANEL_PRESETS[panel]?.[stack.panels?.[panel]],`V4.2a: global ${name} has invalid ${panel} reference`);
check(store.includes('savePanelPreset(')&&store.includes('applyPanelPreset(')&&store.includes('saveGlobalStack(')&&store.includes('applyGlobalStack('),'V4.2a: modular preset store paths missing');
check(bridge.includes('publishImported')&&bridge.includes('this.importing=true')&&bridge.includes("sourceType='exr'"),'V4.2a: HDRI imports must bypass the continuous SkySynth queue');

check(html.includes('id="renderGate"')&&main.includes('waitForRenderStart'),'V4.2d: click-to-start render gate missing');
check(html.includes('id="surfaceYResize"')&&ui.includes("['surfaceYResize','surface'"),'V4.2d: liquid panel Y resize missing');
check(html.includes('class="titlebar liquid-titlebar"')&&html.includes('id="liquidTabs" class="tabs title-tabs"')&&!html.includes('<b class="titlebar-name">LIQUID</b>'),'V4.2d: liquid tabs must live in titlebar without LIQUID label');
check(render.includes('timestamp-query')&&render.includes('gpuTimingsMs')&&render.includes('beginGpuTimestampSample'),'V4.2d: sparse GPU timestamp profiler missing');
check(ui.includes("'fps','#ffffff'")&&ui.includes('FPS')&&ui.includes(' ms'),'V4.2d: profiler FPS/ms overlay missing');
for(const [name,stack] of Object.entries(GLOBAL_PRESETS))check(!!stack.panels?.lut,`V4.2d: global preset ${name} must include LUT`);
check(html.indexOf('id="globalPreset"')<html.indexOf('id="skysynth"'),'V4.2d: global preset controls must remain in upper app bar');


check(SUBMENU_IDS.length>=13&&PANEL_GLOBAL_IDS.length===3,'V4.2e: modular lock topology incomplete');
for(const id of ['skysynth-synth','skysynth-sampling','surface-motion','surface-geometry','surface-projection','surface-material','surface-pattern','surface-atmosphere','surface-lighting','surface-output','lut'])check(!!SUBMENU_DEFINITIONS[id]&&html.includes(`data-submenu-lock="${id}"`),`V4.2e: submenu lock UI missing ${id}`);
for(const id of PANEL_GLOBAL_IDS)check(html.includes(`data-panel-global-lock="${id}"`),`V4.2e: panel-global lock UI missing ${id}`);
check(store.includes('globalKeyLocked')&&store.includes('setPanelGlobalLock')&&store.includes("version:5"),'V4.2e: lock persistence/application paths missing');
check(html.indexOf('id="previewWrap"')<html.indexOf('class="window-body skysynth-scroll"'),'V4.2e: SkySynth preview must be pinned above scrollable controls');
check(html.indexOf('class="profiler-pin"')<html.indexOf('data-panel-preset="output"'),'V4.2e: profiler must be pinned at top of output tab');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');check(css.includes('input[type=range]::-webkit-slider-thumb')&&css.includes('background:#fff!important;border:2px solid #fff!important'),'V4.2e: hollow white range thumb styling missing');
for(const [panel,preset] of Object.entries({skysynth:'Glitch Lattice',liquid:'Glass Swell',reflection:'Dark Chrome',pattern:'Signal Wakes',atmosphere:'Sealed Basin',lighting:'Noir Edge',output:'Hero Shot',modulation:'Loop Drift',lut:'Palette 1',noixture:'Weave Circuit',mixer:'Synth Only',mask:'Noise Window'}))check(GLOBAL_PRESETS['ION ORCHARD'].panels[panel]===preset,`V4.3a: Ion Orchard reference panel changed ${panel}`);
for(const [panel,preset] of Object.entries({skysynth:'Glitch Lattice',liquid:'Orbital Field',reflection:'Dark Chrome',pattern:'Dry Noise',atmosphere:'Sealed Basin',lighting:'Hard Spot',output:'Field Study',modulation:'Wander',lut:'Palette 1',noixture:'Weave Circuit',mixer:'Synth Only',mask:'Noise Window'}))check(GLOBAL_PRESETS['8 Field Scan'].panels[panel]===preset,`V4.3a: Field Scan reference panel changed ${panel}`);
check(GLOBAL_PRESETS['PHASE DIFFERENCE'].panels.pattern==='Phase Filaments'&&GLOBAL_PRESETS['PHASE DIFFERENCE'].panels.output==='Phase Punch','V4.2e: Phase Difference tune missing');

const meshTools=fs.readFileSync(path.join(root,'src/mesh/mesh-tools.js'),'utf8');
check(html.includes('id="loadMesh"')&&html.includes('id="meshFile"')&&html.includes('.glb,.gltf')&&main.includes('importMesh('),'V4.3a: mesh import UI/runtime missing');
for(const term of ['parseSTL','parseOBJ','parsePLY','parseGLB','parseGLTF','retessellateMesh','handleSpikes','conditionMesh'])check(meshTools.includes(term),`V4.3a: mesh conditioning feature missing ${term}`);
for(const map of ['planar-xz','uv','spherical','equal-area','cubemap','octahedral','triplanar','cylindrical','radial','object3d','world3d','tangent-local','camera','projector','reflection-vector','polar-crush','axis-dominant','quantized-normal'])check(params.includes(`'${map}'`),`V4.3a: projection mapping missing ${map}`);
check(MESH_SURFACE.includes('masterMap')&&MESH_SURFACE.includes('projectionMask')&&MESH_SURFACE.includes('edgeScale'),'V4.3a: projection mesh shader incomplete');
check(params.includes('PROJECTION_WRAP_MODES')&&params.includes('reflectionProjection')&&params.includes('projectionDriftX'),'V4.3a: projection wrap/drift/reflection controls missing');
check(GLOBAL_PRESETS['5 Weather Engine'].panels.geometry==='D20 Conditioned'&&GLOBAL_PRESETS['5 Weather Engine'].panels.projection==='D20 Facet Storm','V4.3a: Weather Engine D20 showcase missing');
check(GLOBAL_PRESETS['6 Economy Interactive'].panels.geometry==='Showcase Knot'&&GLOBAL_PRESETS['6 Economy Interactive'].panels.projection==='Triplanar Volume','V4.3a: Economy projection showcase missing');
check(GLOBAL_PRESETS['7 Planetary Orbit'].panels.projection==='Octahedral Planet','V4.3a: Planetary Orbit octahedral mapping missing');
check(ui.includes("finally{select.focus();}"),'V4.3a: global LOAD must return focus to global preset selector');
check(!/<details open/.test(html),'V4.3a: submenus must default closed');
const lutEditor=fs.readFileSync(path.join(root,'src/ui/lut-editor.js'),'utf8');
for(const id of ['lutToolSelect','lutToolBrush','lutToolPick','lutUndo','lutRedo','lutSelectAll','lutSelectNone','lutCopy','lutCut','lutPaste','lutSelectionStatus','lutColorA','lutColorB','lutGradient','lutBrushShape'])check(html.includes(`id="${id}"`),`V4.3b: LUT editor UI missing ${id}`);
check(lutEditor.includes('XENOFIELD_LUT_REGION_V1')&&lutEditor.includes('decodeClipboard')&&lutEditor.includes('pasteRegion'),'V4.3b: shape-preserving LUT clipboard protocol missing');
check(lutEditor.includes("e.shiftKey?'add'")&&lutEditor.includes("e.altKey?'subtract'")&&lutEditor.includes("?'toggle'"),'V4.3b: modifier-assisted LUT area selection missing');
check(lutEditor.includes("shape==='irregular'")&&lutEditor.includes("GRADIENT")&&lutEditor.includes("radial"),'V4.3b: LUT irregular brush / gradient tools missing');
check(lutEditor.includes('history.length>64')&&lutEditor.includes('redoEdit'),'V4.3b: LUT bounded undo/redo history missing');
console.log(`XENOFIELD static contracts: ${checks} passed. These are not GPU compilation or performance measurements.`);
check(main.includes('setPreviewEnabled')&&html.includes('CLICK TO ENABLE PREVIEW'),'V4.2c: optional preview collapse missing');
check(main.includes('lastModUI')&&main.includes('>=100'),'V4.2c: high-rate smoothed modulation UI missing');
check(bridge.includes('2.6*1024*1024*1024'),'V4.2d: EXR/HDRI 2.6 GiB file cap missing');check(exr.includes('30720')&&exr.includes('17280'),'V4.2d: EXR 30720×17280 dimension cap missing');check(exr.includes('outWidth')&&exr.includes('sourceYForDest'),'V4.2d: large EXR direct-downsample decode path missing');
const processor=fs.readFileSync(path.join(root,'src/environment/processor.js'),'utf8');check(processor.includes('gpuReconstruction:true')&&!processor.includes('pipelineResize(pixels'),'V4.2c: SkySynth CPU upsampling should be removed from worker');
