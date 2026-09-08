import test from 'node:test';
import assert from 'node:assert/strict';
import {PARAMETERS,DEFAULTS,BLEND_MODES,MASK_SOURCES,MASK_MIX_MODES,parseNumber,validateRange,validateSafetyCaps,cleanSettings} from '../src/core/parameters.js';
import {StateStore} from '../src/core/store.js';
import {defaultPalettes,parsePalette,exportPalette,varyPalette,linearPalette,validatePalette} from '../src/core/lut.js';
import {GLOBAL_PRESETS,PERFORMANCE_KEYS,PANEL_IDS,PANEL_DEFINITIONS,BUILTIN_PANEL_PRESETS,SUBMENU_IDS,SUBMENU_DEFINITIONS,PANEL_GLOBAL_IDS} from '../src/core/presets.js';
const memory=()=>({data:new Map(),getItem(k){return this.data.get(k)||null;},setItem(k,v){this.data.set(k,v);}});
for(const [key,s] of Object.entries(PARAMETERS))test(`parameter ${key}: defaults, hard bounds, finite-only`,()=>{assert.equal(parseNumber(key,s.value),s.value);assert.throws(()=>parseNumber(key,NaN));assert.throws(()=>parseNumber(key,Infinity));assert.throws(()=>parseNumber(key,''));assert.throws(()=>parseNumber(key,true));assert.throws(()=>parseNumber(key,s.hardMax+1));assert.throws(()=>parseNumber(key,s.hardMin-1));assert.deepEqual(validateRange(key,s.min,s.max),{min:s.min,max:s.max});});
test('range validation rejects reversed/equal/unsafe windows',()=>{assert.throws(()=>validateRange('speed',1,1));assert.throws(()=>validateRange('speed',2,1));assert.throws(()=>validateRange('speed',-100,4));});
test('source dimensions are even integers and geometry does not inherit FFT restrictions',()=>{assert.throws(()=>parseNumber('sourceWidth',95));assert.throws(()=>parseNumber('sourceWidth',96.5));assert.equal(parseNumber('meshResolution',385),385);});
test('state numeric edits expand the window without changing hard safety caps',()=>{const s=new StateStore(memory());s.set('speed',4);assert.equal(s.settings.speed,4);assert.equal(s.ranges.speed.max,4);assert.equal(PARAMETERS.speed.hardMax,8);s.dispose();});
test('range edits do not change the actual parameter',()=>{const s=new StateStore(memory());s.set('speed',4);s.setRange('speed',-1,1);assert.equal(s.settings.speed,4);assert.deepEqual(s.ranges.speed,{min:-1,max:1});s.dispose();});
test('malformed project import is atomic',()=>{const s=new StateStore(memory()),before=s.snapshot(),bad=s.snapshot();bad.settings.freqX=Infinity;assert.throws(()=>s.applySnapshot(bad));assert.deepEqual(s.snapshot(),before);s.dispose();});
test('valid project roundtrip retains numbers, ranges and ten LUTs',()=>{const s=new StateStore(memory());s.set('freqX',-.24);s.setRange('freqX',-.8,.8);s.replacePalette(2,varyPalette(s.palettes[2],40,91));const snap=s.snapshot(),t=new StateStore(memory());t.applySnapshot(JSON.parse(JSON.stringify(snap)));assert.deepEqual(t.snapshot(),snap);s.dispose();t.dispose();});
test('twenty-two global stacks are complete lists of valid panel preset names',()=>{
 assert.equal(Object.keys(GLOBAL_PRESETS).length,22);
 for(const [name,stack] of Object.entries(GLOBAL_PRESETS)){
  assert.equal(Object.keys(stack.panels).length,PANEL_IDS.length,`${name}: incomplete panel stack`);
  for(const panel of PANEL_IDS){const preset=stack.panels[panel];assert.ok(preset,`${name}: missing ${panel}`);assert.ok(BUILTIN_PANEL_PRESETS[panel]?.[preset],`${name}: ${panel} -> ${preset} missing`);}
 }
 for(const key of ['ION ORCHARD','VENT PARTICULATE','HDRI SYNTH FUSION','PHASE DIFFERENCE'])assert.ok(GLOBAL_PRESETS[key]);
});
test('built-in panel presets stay inside their panel ownership boundaries',()=>{
 for(const panel of PANEL_IDS){const owned=new Set(PANEL_DEFINITIONS[panel].keys);assert.ok(Object.keys(BUILTIN_PANEL_PRESETS[panel]).length>=5,`${panel}: needs a useful preset bank`);for(const [name,preset] of Object.entries(BUILTIN_PANEL_PRESETS[panel])){for(const key of Object.keys(preset.settings))assert.ok(owned.has(key),`${panel}/${name}: leaked ${key}`);assert.doesNotThrow(()=>cleanSettings(preset.settings,DEFAULTS));}}
});
test('panel presets and global stacks save/load modular state including LUT snapshots',()=>{
 const s=new StateStore(memory());s.applyPanelPreset('skysynth','ACID CELLS');assert.equal(s.panelSelections.skysynth,'ACID CELLS');const beforeLut=[...s.palettes[0]];s.savePanelPreset('lut','MY LUT');s.replacePalette(0,varyPalette(beforeLut,100,777));assert.ok(s.applyPanelPreset('lut','MY LUT'));assert.deepEqual(s.palettes[0],beforeLut);
 s.set('freqX',.333);s.saveGlobalStack('MY WORLD');const stack=s.globalStacks['MY WORLD'];assert.equal(Object.keys(stack.panels).length,PANEL_IDS.length);s.set('freqX',-.4);assert.ok(s.applyGlobalStack('MY WORLD'));assert.equal(s.settings.freqX,.333);s.dispose();
});
test('palette import/export roundtrip and exact count enforcement',()=>{const p=defaultPalettes()[0];assert.deepEqual(parsePalette(exportPalette(p)),p);assert.equal(exportPalette(p).split('\n').length,32);assert.throws(()=>parsePalette('FFFFFF'));assert.throws(()=>validatePalette([...p.slice(0,255),'NOPE!!']));assert.deepEqual(parsePalette(JSON.stringify(p.map(x=>'#'+x))),p);});
test('palette randomisation is deterministic, bounded and zero-scale identity',()=>{const p=defaultPalettes()[0];assert.deepEqual(varyPalette(p,0,2),p);assert.deepEqual(varyPalette(p,25,2),varyPalette(p,25,2));assert.notDeepEqual(varyPalette(p,100,2),p);assert.equal(linearPalette(p).length,768);});
test('invalid palette replacement cannot mutate a live bank',()=>{const s=new StateStore(memory()),old=s.palettes[0];assert.throws(()=>s.replacePalette(0,['ffffff']));assert.equal(s.palettes[0],old);s.dispose();});
test('storage failure is survivable',()=>{const s=new StateStore({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}});assert.ok(s.lastError);s.set('speed',.4);s.persist();assert.equal(s.settings.speed,.4);s.dispose();});
test('legacy savePreset/loadPreset aliases delegate to modular global stacks',()=>{const s=new StateStore(memory());s.set('speed',.71);s.savePreset('One');s.set('speed',1.3);assert.ok(s.loadPreset('One'));assert.equal(s.settings.speed,.71);assert.equal(s.globalStackName,'One');s.dispose();});

test('editable hard safety caps remain inside immutable engineering bounds',()=>{const s=new StateStore(memory());s.setSafetyCaps('speed',-2,2);assert.deepEqual(s.safetyCaps.speed,{min:-2,max:2});assert.throws(()=>s.set('speed',3));assert.throws(()=>s.setSafetyCaps('speed',-9,2));assert.throws(()=>validateSafetyCaps('speed',-9,2));s.dispose();});
test('functional extremums are persisted reference metadata and never clamp values',()=>{const s=new StateStore(memory());s.setFunctionalExtremums('speed',-.8,1.2);s.set('speed',1.5);assert.deepEqual(s.functionalExtremums.speed,{min:-.8,max:1.2});assert.equal(s.settings.speed,1.5);const t=new StateStore(memory());t.applySnapshot(JSON.parse(JSON.stringify(s.snapshot())));assert.deepEqual(t.functionalExtremums.speed,{min:-.8,max:1.2});s.dispose();t.dispose();});
test('UI tooltip preference persists in project state',()=>{const s=new StateStore(memory());s.setUISetting('tooltips',false);const t=new StateStore(memory());t.applySnapshot(JSON.parse(JSON.stringify(s.snapshot())));assert.equal(t.uiSettings.tooltips,false);s.dispose();t.dispose();});

test('modulation width order is validated at the common setting boundary',()=>{assert.throws(()=>cleanSettings({modWidthMin:50,modWidthMax:-20}));});

test('blend-mode bank exposes the practical GIMP-style RGB modes and legacy aliases',()=>{
  assert.equal(BLEND_MODES.length,34);
  for(const mode of ['normal','dissolve','screen','dodge','addition','multiply','burn','linear-burn','overlay','soft-light','hard-light','vivid-light','pin-light','linear-light','hard-mix','difference','exclusion','subtract','grain-extract','grain-merge','divide','hsv-hue','hsv-saturation','hsl-color','hsv-value','lch-hue','lch-chroma','lch-color','lch-lightness','luminance'])assert.ok(BLEND_MODES.includes(mode),mode);
  for(const key of ['mixerBlend','noixtureBlend','cloudBlend','foamBlend'])for(const mode of BLEND_MODES)assert.equal(cleanSettings({[key]:mode})[key],mode);
  assert.equal(cleanSettings({cloudBlend:'add'}).cloudBlend,'addition');
  assert.equal(cleanSettings({noixtureBlend:'softlight'}).noixtureBlend,'soft-light');
});
test('live mask schema supports mixed sources, image manipulation and multi-target routing',()=>{
  for(const source of ['skysynth-luma','hdri-luma','mixed-luma','noixture','clouds','perlin','billow','ridge','weave','vertical','radial'])assert.ok(MASK_SOURCES.includes(source),source);
  for(const mode of ['mix','multiply','screen','addition','difference','minimum','maximum'])assert.ok(MASK_MIX_MODES.includes(mode),mode);
  const s=cleanSettings({maskEnabled:true,maskSourceA:'mixed-luma',maskSourceB:'ridge',maskMixMode:'screen',maskBrightness:.2,maskContrast:1.4,maskGamma:.8,maskThreshold:.35,maskSoftness:.15,maskMixer:true,maskNoixture:true,maskClouds:true,maskFoam:true});
  assert.equal(s.maskEnabled,true);assert.equal(s.maskSourceB,'ridge');assert.equal(s.maskMixMode,'screen');assert.equal(s.maskContrast,1.4);assert.equal(s.maskFoam,true);
});


test('submenu locks protect only their keys during global loads',()=>{
 const s=new StateStore(memory());
 s.applyGlobalStack('ION ORCHARD');
 s.set('freqX',-.321);s.set('sourceWidth',80);s.set('bodyGain',.33);
 s.setSubmenuLock('skysynth-synth',true);
 s.applyGlobalStack('0 Balanced Ocean');
 assert.equal(s.settings.freqX,-.321,'locked synth frequency should survive global preset');
 assert.notEqual(s.settings.sourceWidth,80,'unlocked sampling/env should accept global preset');
 assert.notEqual(s.settings.bodyGain,.33,'surface material should accept global preset');
 s.dispose();
});

test('panel-global LOCK and UNLOCK override submenu locks without changing them',()=>{
 const s=new StateStore(memory());
 s.applyGlobalStack('ION ORCHARD');
 s.set('freqX',-.222);s.set('sourceWidth',80);s.setSubmenuLock('skysynth-synth',true);
 s.setPanelGlobalLock('skysynth','lock');
 const before={freqX:s.settings.freqX,sourceWidth:s.settings.sourceWidth};
 s.applyGlobalStack('VENT PARTICULATE');
 assert.equal(s.settings.freqX,before.freqX);assert.equal(s.settings.sourceWidth,before.sourceWidth);
 assert.equal(s.submenuLocks['skysynth-synth'],true,'panel override must not alter submenu lock');
 s.setPanelGlobalLock('skysynth','unlock');
 s.applyGlobalStack('0 Balanced Ocean');
 assert.notEqual(s.settings.freqX,before.freqX,'UNLOCK should override locked submenu');
 assert.equal(s.submenuLocks['skysynth-synth'],true,'UNLOCK override must not mutate submenu lock');
 s.setPanelGlobalLock('skysynth','none');
 const lockedValue=s.settings.freqX;s.applyGlobalStack('VENT PARTICULATE');assert.equal(s.settings.freqX,lockedValue,'NONE should honour submenu lock again');
 s.dispose();
});

test('lock topology covers requested physical submenus and persists in project state',()=>{
 for(const id of ['skysynth-synth','skysynth-sampling','surface-motion','surface-material','surface-pattern','surface-atmosphere','surface-lighting','surface-output','lut'])assert.ok(SUBMENU_DEFINITIONS[id],id);
 assert.deepEqual(PANEL_GLOBAL_IDS,['skysynth','surface','lut']);
 const s=new StateStore(memory());s.setSubmenuLock('lut',true);s.setPanelGlobalLock('surface','lock');const snap=s.snapshot();assert.equal(snap.version,5);
 const t=new StateStore(memory());t.applySnapshot(JSON.parse(JSON.stringify(snap)));assert.equal(t.submenuLocks.lut,true);assert.equal(t.panelGlobalLocks.surface,'lock');s.dispose();t.dispose();
});

test('Ion Orchard and Field Scan retain their legacy visual stacks while Phase Difference is tuned',()=>{
 const legacyPanels=['skysynth','liquid','reflection','pattern','atmosphere','lighting','output','modulation','lut','noixture','mixer','mask'];
 const ion={skysynth:'Glitch Lattice',liquid:'Glass Swell',reflection:'Dark Chrome',pattern:'Signal Wakes',atmosphere:'Sealed Basin',lighting:'Noir Edge',output:'Hero Shot',modulation:'Loop Drift',lut:'Palette 1',noixture:'Weave Circuit',mixer:'Synth Only',mask:'Noise Window'};
 const field={skysynth:'Glitch Lattice',liquid:'Orbital Field',reflection:'Dark Chrome',pattern:'Dry Noise',atmosphere:'Sealed Basin',lighting:'Hard Spot',output:'Field Study',modulation:'Wander',lut:'Palette 1',noixture:'Weave Circuit',mixer:'Synth Only',mask:'Noise Window'};
 for(const panel of legacyPanels){assert.equal(GLOBAL_PRESETS['ION ORCHARD'].panels[panel],ion[panel],`Ion Orchard changed ${panel}`);assert.equal(GLOBAL_PRESETS['8 Field Scan'].panels[panel],field[panel],`Field Scan changed ${panel}`);}
 assert.equal(GLOBAL_PRESETS['ION ORCHARD'].panels.projection,'Planar Legacy');assert.equal(GLOBAL_PRESETS['8 Field Scan'].panels.projection,'Planar Legacy');
 assert.equal(GLOBAL_PRESETS['PHASE DIFFERENCE'].panels.pattern,'Phase Filaments');assert.equal(GLOBAL_PRESETS['PHASE DIFFERENCE'].panels.output,'Phase Punch');
});
