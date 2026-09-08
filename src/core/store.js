import {
 DEFAULTS,PARAMETERS,cleanSettings,defaultRanges,defaultSafetyCaps,defaultFunctionalExtremums,
 validateRange,validateSafetyCaps,parseNumber,parseFunctionalExtremum
} from './parameters.js';
import {defaultPalettes,validatePalette} from './lut.js';
import {PANEL_DEFINITIONS,PANEL_IDS,BUILTIN_PANEL_PRESETS,GLOBAL_PRESETS,SUBMENU_DEFINITIONS,SUBMENU_IDS,PANEL_GLOBAL_IDS} from './presets.js';
export const STORAGE_KEY='abyssal-xenofield-4.4b';
const LEGACY_STORAGE_KEYS=['abyssal-xenofield-4.4a','abyssal-xenofield-4.3b','abyssal-xenofield-4.3a','abyssal-xenofield-4.2e','abyssal-xenofield-4.2a','abyssal-xenofield-4.1b'];
const SAFE_NAMES=new Set(['__proto__','prototype','constructor']);
const KEY_PANEL=Object.freeze(Object.fromEntries(PANEL_IDS.flatMap(panel=>PANEL_DEFINITIONS[panel].keys.map(key=>[key,panel]))));
const customSelections=()=>Object.fromEntries(PANEL_IDS.map(id=>[id,'Custom']));
const emptyPanelPresets=()=>Object.fromEntries(PANEL_IDS.map(id=>[id,{}]));
const defaultSubmenuLocks=()=>Object.fromEntries(SUBMENU_IDS.map(id=>[id,false]));
const defaultPanelGlobalLocks=()=>Object.fromEntries(PANEL_GLOBAL_IDS.map(id=>[id,'none']));
const KEY_SUBMENU=Object.freeze(Object.fromEntries(SUBMENU_IDS.flatMap(id=>SUBMENU_DEFINITIONS[id].keys.map(key=>[key,id]))));
const cleanName=name=>{const n=String(name??'').trim();if(!n||n.length>64||SAFE_NAMES.has(n))throw new Error('Use a preset name of 1–64 characters.');return n;};

export class StateStore extends EventTarget{
 constructor(storage){
  super();try{this.storage=storage===undefined?globalThis.localStorage:storage;}catch{this.storage=null;}
  this.settings=cleanSettings(DEFAULTS);this.ranges=defaultRanges();this.safetyCaps=defaultSafetyCaps();this.functionalExtremums=defaultFunctionalExtremums();this.uiSettings={tooltips:true};this.palettes=defaultPalettes();
  this.panelPresets=emptyPanelPresets();this.panelSelections=customSelections();this.globalStacks={};this.globalStackName='Custom';this.submenuLocks=defaultSubmenuLocks();this.panelGlobalLocks=defaultPanelGlobalLocks();this.lastError='';this.saveTimer=null;this.load();
 }
 emit(keys=[],reason='change'){this.dispatchEvent(new CustomEvent('change',{detail:{keys,reason}}));clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.persist(),350);}
 markDirtyForKeys(keys){let changed=false;for(const key of keys){const panel=KEY_PANEL[key];if(panel&&this.panelSelections[panel]!=='Custom'){this.panelSelections[panel]='Custom';changed=true;}}if(keys.length||changed)this.globalStackName='Custom';}
 set(key,value){
  const parsed=PARAMETERS[key]?parseNumber(key,value,this.safetyCaps[key]):value;const next=cleanSettings({[key]:parsed},this.settings);this.settings=next;
  if(PARAMETERS[key]){const r=this.ranges[key],n=next[key];r.min=Math.min(r.min,n);r.max=Math.max(r.max,n);}this.markDirtyForKeys([key]);this.emit([key]);
 }
 patch(values,reason='change',{markDirty=true}={}){
  const checked={...values};for(const k of Object.keys(PARAMETERS))if(Object.hasOwn(checked,k))checked[k]=parseNumber(k,checked[k],this.safetyCaps[k]);
  this.settings=cleanSettings(checked,this.settings);this.expandRanges();if(markDirty)this.markDirtyForKeys(Object.keys(values));this.emit(Object.keys(values),reason);
 }
 expandRanges(){for(const k of Object.keys(PARAMETERS)){this.ranges[k].min=Math.min(this.ranges[k].min,this.settings[k]);this.ranges[k].max=Math.max(this.ranges[k].max,this.settings[k]);}}
 setRange(key,min,max){this.ranges[key]=validateRange(key,min,max,this.safetyCaps[key]);this.emit([],'ranges');}
 resetRange(key){const s=PARAMETERS[key],cap=this.safetyCaps[key];this.setRange(key,Math.max(s.min,cap.min),Math.min(s.max,cap.max));}
 setSafetyCaps(key,min,max){const cap=validateSafetyCaps(key,min,max),value=this.settings[key];if(value<cap.min||value>cap.max)throw new Error(`Current value ${value} lies outside the proposed hard safety caps.`);this.safetyCaps[key]=cap;const r=this.ranges[key];r.min=Math.max(r.min,cap.min);r.max=Math.min(r.max,cap.max);if(r.min>=r.max)this.ranges[key]={min:cap.min,max:cap.max};this.emit([],'safety-caps');}
 resetSafetyCaps(key){const s=PARAMETERS[key];this.setSafetyCaps(key,s.hardMin,s.hardMax);}
 setFunctionalExtremums(key,min,max){if(!PARAMETERS[key])throw new Error('Unknown parameter.');this.functionalExtremums[key]={min:parseFunctionalExtremum(min),max:parseFunctionalExtremum(max)};this.emit([],'functional-extremums');}
 setUISetting(key,value){if(key!=='tooltips')throw new Error('Unknown UI setting.');this.uiSettings[key]=!!value;this.emit([],'ui-settings');}
 replacePalette(slot,values){if(!Number.isInteger(slot)||slot<0||slot>9)throw new Error('Invalid palette slot.');this.palettes[slot]=validatePalette(values);this.panelSelections.lut='Custom';this.globalStackName='Custom';this.emit(['palette'],'palette');}

 setSubmenuLock(id,value){if(!SUBMENU_DEFINITIONS[id])throw new Error('Unknown submenu lock.');this.submenuLocks[id]=!!value;this.emit([],'locks');}
 setPanelGlobalLock(id,state){if(!PANEL_GLOBAL_IDS.includes(id)||!['none','lock','unlock'].includes(state))throw new Error('Invalid panel-global lock state.');this.panelGlobalLocks[id]=state;this.emit([],'locks');}
 globalKeyLocked(key){const submenu=KEY_SUBMENU[key];if(!submenu)return false;const group=SUBMENU_DEFINITIONS[submenu].globalPanel,state=this.panelGlobalLocks[group]||'none';if(state==='lock')return true;if(state==='unlock')return false;return !!this.submenuLocks[submenu];}
 globalSubmenuLocked(id){const def=SUBMENU_DEFINITIONS[id];if(!def)return false;const state=this.panelGlobalLocks[def.globalPanel]||'none';if(state==='lock')return true;if(state==='unlock')return false;return !!this.submenuLocks[id];}
 panelChoices(panel){return ['Custom',...Object.keys(BUILTIN_PANEL_PRESETS[panel]||{}),...Object.keys(this.panelPresets[panel]||{}).filter(n=>!Object.hasOwn(BUILTIN_PANEL_PRESETS[panel]||{},n))];}
 resolvePanelPreset(panel,name){if(!PANEL_DEFINITIONS[panel]||!name||name==='Custom')return null;return this.panelPresets[panel]?.[name]||BUILTIN_PANEL_PRESETS[panel]?.[name]||null;}
 capturePanel(panel){const def=PANEL_DEFINITIONS[panel];if(!def)throw new Error('Unknown panel.');const settings={};for(const key of def.keys)settings[key]=structuredClone(this.settings[key]);const out={settings};if(def.palette)out.palette=[...this.palettes[this.settings.lutSlot]];return out;}
 applyPanelPreset(panel,name,{emit=true,markGlobal=true,globalLoad=false}={}){
  const def=PANEL_DEFINITIONS[panel],preset=this.resolvePanelPreset(panel,name);if(!def||!preset)return false;const patch=preset.settings||preset;
  const filtered={},skipped=[];for(const key of def.keys)if(Object.hasOwn(patch,key)){if(globalLoad&&this.globalKeyLocked(key)){skipped.push(key);continue;}filtered[key]=patch[key];}for(const k of Object.keys(PARAMETERS))if(Object.hasOwn(filtered,k))filtered[k]=parseNumber(k,filtered[k],this.safetyCaps[k]);
  if(Object.keys(filtered).length)this.settings=cleanSettings(filtered,this.settings);const paletteAllowed=def.palette&&preset.palette&&(!globalLoad||!this.globalSubmenuLocked('lut'));if(paletteAllowed)this.palettes[this.settings.lutSlot]=validatePalette(preset.palette);this.expandRanges();if(!globalLoad||(!skipped.length&&Object.keys(filtered).length===def.keys.filter(k=>Object.hasOwn(patch,k)).length))this.panelSelections[panel]=name;else if(Object.keys(filtered).length||paletteAllowed)this.panelSelections[panel]='Custom';if(markGlobal)this.globalStackName='Custom';if(emit)this.emit([...Object.keys(filtered),...(paletteAllowed?['palette']:[])],`panel-preset:${panel}`);return Object.keys(filtered).length>0||paletteAllowed;
 }
 savePanelPreset(panel,name,{emit=true}={}){if(!PANEL_DEFINITIONS[panel])throw new Error('Unknown panel.');const n=cleanName(name);if(Object.hasOwn(BUILTIN_PANEL_PRESETS[panel]||{},n))throw new Error('Built-in panel preset names are read-only. Choose another name.');this.panelPresets[panel][n]=this.capturePanel(panel);this.panelSelections[panel]=n;this.globalStackName='Custom';if(emit)this.emit([],'panel-preset-saved');return n;}
 deletePanelPreset(panel,name){if(!this.panelPresets[panel]?.[name])return false;delete this.panelPresets[panel][name];if(this.panelSelections[panel]===name)this.panelSelections[panel]='Custom';this.globalStackName='Custom';this.emit([],'panel-preset-deleted');return true;}

 globalChoices(){return ['Custom',...Object.keys(GLOBAL_PRESETS),...Object.keys(this.globalStacks).filter(n=>!Object.hasOwn(GLOBAL_PRESETS,n))];}
 resolveGlobal(name){return this.globalStacks[name]||GLOBAL_PRESETS[name]||null;}
 applyGlobalStack(name){const stack=this.resolveGlobal(name);if(!stack)return false;const keys=[];for(const panel of PANEL_IDS){const presetName=stack.panels?.[panel];if(!presetName)continue;const before={...this.settings};this.applyPanelPreset(panel,presetName,{emit:false,markGlobal:false,globalLoad:true});for(const key of PANEL_DEFINITIONS[panel].keys)if(before[key]!==this.settings[key])keys.push(key);if(PANEL_DEFINITIONS[panel].palette&&!this.globalSubmenuLocked('lut'))keys.push('palette');}this.globalStackName=name;this.emit([...new Set(keys)],'global-stack');return true;}
 saveGlobalStack(name){const n=cleanName(name);if(Object.hasOwn(GLOBAL_PRESETS,n))throw new Error('Built-in global preset names are read-only. Choose another name.');const panels={};for(const panel of PANEL_IDS){let selection=this.panelSelections[panel];if(!selection||selection==='Custom'){const auto=`${n} · ${PANEL_DEFINITIONS[panel].label}`.slice(0,64);selection=this.savePanelPreset(panel,auto,{emit:false});}panels[panel]=selection;}this.globalStacks[n]={description:'User global stack',panels};this.globalStackName=n;this.emit([],'global-stack-saved');return n;}
 deleteGlobalStack(name){if(!this.globalStacks[name])return false;delete this.globalStacks[name];if(this.globalStackName===name)this.globalStackName='Custom';this.emit([],'global-stack-deleted');return true;}
 // Compatibility aliases: legacy scripts now operate on modular global stacks.
 savePreset(name){return this.saveGlobalStack(name);}
 loadPreset(name){return this.applyGlobalStack(name);}

 snapshot(){return {version:5,settings:structuredClone(this.settings),ranges:structuredClone(this.ranges),safetyCaps:structuredClone(this.safetyCaps),functionalExtremums:structuredClone(this.functionalExtremums),uiSettings:{...this.uiSettings},palettes:structuredClone(this.palettes),panelPresets:structuredClone(this.panelPresets),panelSelections:{...this.panelSelections},globalStacks:structuredClone(this.globalStacks),globalStackName:this.globalStackName,submenuLocks:{...this.submenuLocks},panelGlobalLocks:{...this.panelGlobalLocks}};}
 applySnapshot(data){
  if(!data||![1,2,3,4,5].includes(data.version))throw new Error('Unsupported project version.');const settings=cleanSettings(data.settings,DEFAULTS),palettes=data.palettes?.map(validatePalette);if(!palettes||palettes.length!==10)throw new Error('A project must have ten complete palettes.');
  const safetyCaps=defaultSafetyCaps();if(data.version>=2)for(const k of Object.keys(PARAMETERS))if(data.safetyCaps?.[k])safetyCaps[k]=validateSafetyCaps(k,data.safetyCaps[k].min,data.safetyCaps[k].max);for(const k of Object.keys(PARAMETERS))parseNumber(k,settings[k],safetyCaps[k]);
  const ranges=defaultRanges();for(const k of Object.keys(PARAMETERS))if(data.ranges?.[k])ranges[k]=validateRange(k,data.ranges[k].min,data.ranges[k].max,safetyCaps[k]);const functional=defaultFunctionalExtremums();if(data.version>=2)for(const k of Object.keys(PARAMETERS))if(data.functionalExtremums?.[k])functional[k]={min:parseFunctionalExtremum(data.functionalExtremums[k].min),max:parseFunctionalExtremum(data.functionalExtremums[k].max)};
  this.settings=settings;this.palettes=palettes;this.ranges=ranges;this.safetyCaps=safetyCaps;this.functionalExtremums=functional;this.uiSettings={tooltips:data.uiSettings?.tooltips!==false};this.panelPresets=emptyPanelPresets();this.panelSelections=customSelections();this.globalStacks={};this.globalStackName='Custom';this.submenuLocks=defaultSubmenuLocks();this.panelGlobalLocks=defaultPanelGlobalLocks();
  if(data.version>=4){for(const panel of PANEL_IDS)for(const [name,p] of Object.entries(data.panelPresets?.[panel]||{})){if(SAFE_NAMES.has(name))continue;const settings={};for(const key of PANEL_DEFINITIONS[panel].keys)if(Object.hasOwn(p.settings||{},key))settings[key]=structuredClone(p.settings[key]);this.panelPresets[panel][name]={settings};if(PANEL_DEFINITIONS[panel].palette&&p.palette)this.panelPresets[panel][name].palette=validatePalette(p.palette);}for(const [name,stack] of Object.entries(data.globalStacks||{})){if(SAFE_NAMES.has(name)||!stack?.panels)continue;this.globalStacks[name]={description:String(stack.description||'User global stack'),panels:{...stack.panels}};}for(const panel of PANEL_IDS){const n=data.panelSelections?.[panel];if(typeof n==='string')this.panelSelections[panel]=n;}if(typeof data.globalStackName==='string')this.globalStackName=data.globalStackName;}
  if(data.version>=5){for(const id of SUBMENU_IDS)if(typeof data.submenuLocks?.[id]==='boolean')this.submenuLocks[id]=data.submenuLocks[id];for(const id of PANEL_GLOBAL_IDS)if(['none','lock','unlock'].includes(data.panelGlobalLocks?.[id]))this.panelGlobalLocks[id]=data.panelGlobalLocks[id];}
  this.emit(Object.keys(PARAMETERS),'project');
 }
 persist(){try{this.storage?.setItem(STORAGE_KEY,JSON.stringify(this.snapshot()));}catch{this.lastError='Browser storage unavailable: export the project to keep your changes.';}}
 load(){try{let text=this.storage?.getItem(STORAGE_KEY);if(!text){for(const key of LEGACY_STORAGE_KEYS){text=this.storage?.getItem(key);if(text){this.lastError='Previous XENOFIELD settings were migrated. Existing LUT data was preserved for the V4.4b cloud-volume editor.';break;}}}if(!text)return;this.applySnapshot(JSON.parse(text));}catch(e){this.lastError=`Stored state was rejected: ${e.message}`;this.settings=cleanSettings(DEFAULTS);this.ranges=defaultRanges();this.safetyCaps=defaultSafetyCaps();this.functionalExtremums=defaultFunctionalExtremums();this.uiSettings={tooltips:true};this.palettes=defaultPalettes();this.panelPresets=emptyPanelPresets();this.panelSelections=customSelections();this.globalStacks={};this.globalStackName='Custom';this.submenuLocks=defaultSubmenuLocks();this.panelGlobalLocks=defaultPanelGlobalLocks();}}
 dispose(){clearTimeout(this.saveTimer);this.persist();}
}
