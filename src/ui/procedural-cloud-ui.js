import {PARAMETERS} from '../core/parameters.js';

const $=id=>document.getElementById(id);
const fmt=n=>Number.isInteger(n)?String(n):Number(Number(n).toFixed(4)).toString();
const PARAM_KEYS=['procCloudDensity','procCloudCoverage','procCloudScale','procCloudAltitude','procCloudDetail','procCloudWindSpeed','procCloudRaySteps','procCloudLightSteps','procCloudShadowDark','procCloudSunIntensity','procCloudHeight','procCloudCacheRes','procCloudCacheUpdate','procCloudCacheSmooth'];
const POS_KEYS=['procCloudCenterX','procCloudCenterY','procCloudCenterZ'];
const SIZE_KEYS=['procCloudSizeX','procCloudSizeY','procCloudSizeZ'];
const AXES=['xyz','x','y','z','xy','xz','yz'];

export function mountProceduralCloudUI(app){
 const store=app.store,workspace=$('workspace'),dock=$('dock');let panelDrag=null,worldDrag=null;
 const panel=document.createElement('section');panel.id='proceduralClouds';panel.className='proc-cloud-window window hidden';panel.setAttribute('aria-label','PROCEDURAL CLOUDS');
 panel.innerHTML=`<div class="titlebar proc-cloud-title"><button class="lamp yellow" id="procCloudMin" aria-label="MINIMIZE PROCEDURAL CLOUDS"></button><b class="titlebar-name">PROCEDURAL CLOUDS</b><span class="titlebar-spacer"></span><label class="proc-master"><input id="procCloudEnabledUI" type="checkbox"> LIVE</label></div>
 <div class="proc-cloud-body">
  <div class="panel-preset"><b>PRESET</b><select id="procCloudPreset"></select><button id="procCloudLoad">LOAD</button><button id="procCloudSave">SAVE</button><button id="procCloudDelete">−</button></div>
  <div class="proc-transform">
   <header><b>WORLD VOLUME TOOL</b><span id="procCloudWorldReadout">—</span></header>
   <div class="proc-tool-row"><button data-cloud-mode="move">MOVE</button><button data-cloud-mode="scale">SCALE</button><button id="procCloudEdit">EDIT IN VIEW</button><label><input id="procCloudBounds" type="checkbox"> BOUNDS</label></div>
   <div class="proc-axis-row">${AXES.map(a=>`<button data-cloud-axis="${a}">${a.toUpperCase()}</button>`).join('')}</div>
   <div class="proc-vector"><b>POS</b>${['X','Y','Z'].map((a,i)=>`<label>${a}<input data-cloud-number="${POS_KEYS[i]}" type="number" step="any"></label>`).join('')}</div>
   <div class="proc-vector"><b>SIZE</b>${['X','Y','Z'].map((a,i)=>`<label>${a}<input data-cloud-number="${SIZE_KEYS[i]}" type="number" step="any"></label>`).join('')}</div>
   <p>VIEW EDIT: DRAG = SELECTED MOVE/SCALE · WHEEL = VIEW-DEPTH MOVE / SCALE · SHIFT = FINE</p>
  </div>
  <div class="proc-cloud-params" id="procCloudParams"></div>
  <details><summary>ADVANCED WORLD / COMPOSITE</summary><div class="proc-cloud-advanced" id="procCloudAdvanced"></div><div class="proc-tool-row"><label><input id="procCloudDepthClip" type="checkbox"> DEPTH CLIP</label><label><input id="procCloudSkipLight" type="checkbox"> SKIP LIGHT MARCH</label></div></details>
  <p class="proc-cloud-note">REFERENCE PARAMETER ORDER IS PRESERVED. DIRECT NUMERIC ENTRY MAY EXCEED THE VISIBLE SLIDER RANGE UP TO THE VALIDATED SAFETY CAP.</p>
 </div>`;
 workspace.append(panel);
 const dockButton=document.createElement('button');dockButton.id='openProceduralClouds';dockButton.textContent='CLOUDS';dockButton.dataset.open='false';dock.append(dockButton);
 const body=$('procCloudParams'),advanced=$('procCloudAdvanced'),rows=new Map();
 function row(key,target=body){const p=PARAMETERS[key],root=document.createElement('div');root.className='proc-cloud-param';root.dataset.parameter=key;const label=document.createElement('label');label.textContent=p.label;label.title=p.help;const slider=document.createElement('input');slider.type='range';slider.min=p.min;slider.max=p.max;slider.step=p.step;slider.title=p.help;const number=document.createElement('input');number.type='number';number.step='any';number.title=`${p.help} Direct entry may extend beyond the visible slider range.`;root.append(label,slider,number);target.append(root);slider.oninput=()=>{try{store.set(key,+slider.value);}catch(e){app.notify(e.message);}};number.onchange=()=>{try{store.set(key,number.value);}catch(e){app.notify(e.message);sync();}};rows.set(key,{slider,number});}
 for(const key of PARAM_KEYS)row(key);
 for(const key of ['procCloudRenderScale','procCloudOpacity','procCloudDepthSoftness','procCloudDragSensitivity'])row(key,advanced);
 function place(){if(!panel.style.left){panel.style.left='8px';panel.style.top='43px';}const r=panel.getBoundingClientRect(),bar=$('mainbar').getBoundingClientRect();panel.style.left=Math.max(4,Math.min(innerWidth-r.width-4,parseFloat(panel.style.left)||8))+'px';panel.style.top=Math.max(bar.bottom+5,Math.min(innerHeight-46,parseFloat(panel.style.top)||43))+'px';}
 function refreshPresets(){const sel=$('procCloudPreset'),current=store.panelSelections.proceduralClouds||'Custom';sel.innerHTML='';for(const name of store.panelChoices('proceduralClouds')){const o=document.createElement('option');o.value=name;o.textContent=name;sel.append(o);}sel.value=store.panelChoices('proceduralClouds').includes(current)?current:'Custom';}
 function sync(){const s=store.settings;$('procCloudEnabledUI').checked=s.procCloudEnabled;$('procCloudBounds').checked=s.procCloudShowBounds;$('procCloudDepthClip').checked=s.procCloudDepthClip;$('procCloudSkipLight').checked=s.procCloudSkipLight;$('procCloudEdit').classList.toggle('active',s.procCloudEditActive);$('procCloudEdit').textContent=s.procCloudEditActive?'EDIT ACTIVE':'EDIT IN VIEW';for(const b of panel.querySelectorAll('[data-cloud-mode]'))b.classList.toggle('active',b.dataset.cloudMode===s.procCloudTransformMode);for(const b of panel.querySelectorAll('[data-cloud-axis]'))b.classList.toggle('active',b.dataset.cloudAxis===s.procCloudTransformAxis);for(const el of panel.querySelectorAll('[data-cloud-number]'))el.value=fmt(s[el.dataset.cloudNumber]);for(const [key,r] of rows){r.number.value=fmt(s[key]);const p=PARAMETERS[key],v=Math.max(p.min,Math.min(p.max,+s[key]));r.slider.value=v;r.slider.style.setProperty('--range-progress',`${(v-p.min)/(p.max-p.min)*100}%`);}const m=app.renderer?.metrics?.()?.kinetic?.proceduralCloud;$('procCloudWorldReadout').textContent=`${fmt(s.procCloudSizeX)}×${fmt(s.procCloudSizeY)}×${fmt(s.procCloudSizeZ)} m${m?.cache?` · ${m.cache[0]}³`:''}`;refreshPresets();}
 function visible(open){panel.classList.toggle('hidden',!open);dockButton.dataset.open=String(open);if(open){place();panel.style.zIndex='110';}}
 dockButton.onclick=()=>visible(panel.classList.contains('hidden'));
 $('procCloudMin').onclick=()=>visible(false);
 $('procCloudEnabledUI').onchange=e=>store.set('procCloudEnabled',e.target.checked);
 $('procCloudBounds').onchange=e=>store.set('procCloudShowBounds',e.target.checked);
 $('procCloudDepthClip').onchange=e=>store.set('procCloudDepthClip',e.target.checked);
 $('procCloudSkipLight').onchange=e=>store.set('procCloudSkipLight',e.target.checked);
 $('procCloudEdit').onclick=()=>store.set('procCloudEditActive',!store.settings.procCloudEditActive);
 panel.querySelectorAll('[data-cloud-mode]').forEach(b=>b.onclick=()=>store.set('procCloudTransformMode',b.dataset.cloudMode));
 panel.querySelectorAll('[data-cloud-axis]').forEach(b=>b.onclick=()=>store.set('procCloudTransformAxis',b.dataset.cloudAxis));
 panel.querySelectorAll('[data-cloud-number]').forEach(el=>el.onchange=()=>{try{store.set(el.dataset.cloudNumber,el.value);}catch(e){app.notify(e.message);sync();}});
 $('procCloudLoad').onclick=()=>{const n=$('procCloudPreset').value;if(n!=='Custom')store.applyPanelPreset('proceduralClouds',n);};
 $('procCloudSave').onclick=()=>{const n=prompt('SAVE PROCEDURAL CLOUD PRESET AS:','');if(!n)return;try{store.savePanelPreset('proceduralClouds',n);sync();}catch(e){app.notify(e.message);}};
 $('procCloudDelete').onclick=()=>{const n=$('procCloudPreset').value;if(!store.panelPresets.proceduralClouds?.[n]){app.notify('ONLY USER CLOUD PRESETS CAN BE DELETED.');return;}if(confirm(`DELETE ${n}?`))store.deletePanelPreset('proceduralClouds',n);};
 panel.querySelector('.titlebar').addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button,input,label'))return;const r=panel.getBoundingClientRect();panelDrag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();});
 window.addEventListener('pointermove',e=>{if(panelDrag){panel.style.left=panelDrag.left+e.clientX-panelDrag.x+'px';panel.style.top=panelDrag.top+e.clientY-panelDrag.y+'px';place();}});
 window.addEventListener('pointerup',()=>{panelDrag=null;});window.addEventListener('resize',place);
 function basis(){const u=app.renderer?.uniforms;if(!u)return {right:[1,0,0],up:[0,1,0],forward:[0,0,-1],camera:[0,0,0]};return {right:Array.from(u.subarray(20,23)),up:Array.from(u.subarray(24,27)),forward:Array.from(u.subarray(28,31)),camera:Array.from(u.subarray(16,19))};}
 function axisMask(axis){return [axis.includes('x')||axis==='xyz'?1:0,axis.includes('y')||axis==='xyz'?1:0,axis.includes('z')||axis==='xyz'?1:0];}
 function dragSensitivity(s,b){const c=[s.procCloudCenterX,s.procCloudCenterY,s.procCloudCenterZ],dist=Math.hypot(c[0]-b.camera[0],c[1]-b.camera[1],c[2]-b.camera[2]);return Math.max(.01,dist*.0025)*s.procCloudDragSensitivity;}
 function pointerDown(e){const s=store.settings;if(!s.procCloudEnabled||!s.procCloudEditActive||e.button!==0)return false;const b=basis();worldDrag={x:e.clientX,y:e.clientY,center:[s.procCloudCenterX,s.procCloudCenterY,s.procCloudCenterZ],size:[s.procCloudSizeX,s.procCloudSizeY,s.procCloudSizeZ],basis:b,mode:s.procCloudTransformMode,axis:s.procCloudTransformAxis,sens:dragSensitivity(s,b),fine:e.shiftKey};e.currentTarget.setPointerCapture?.(e.pointerId);app.keyboardOwner='procedural-clouds';e.preventDefault();return true;}
 function pointerMove(e){if(!worldDrag)return false;const d=worldDrag,s=store.settings,dx=e.clientX-d.x,dy=e.clientY-d.y,mask=axisMask(d.axis);
  if(d.mode==='scale'){const factor=Math.exp((dx-dy)*.005*(e.shiftKey?.1:1)*s.procCloudDragSensitivity),out=d.size.map((v,i)=>mask[i]?Math.max(.1,v*factor):v);store.patch(Object.fromEntries(SIZE_KEYS.map((k,i)=>[k,out[i]])),'cloud-gizmo');}
  else {let delta=d.basis.right.map((v,i)=>v*dx*d.sens).map((v,i)=>v+d.basis.up[i]*(-dy)*d.sens);if(mask.reduce((a,b)=>a+b,0)===1){const i=mask.findIndex(Boolean),projR=d.basis.right[i],projU=d.basis.up[i];delta=[0,0,0];delta[i]=(Math.abs(projR)>=Math.abs(projU)?dx*Math.sign(projR||1):-dy*Math.sign(projU||1))*d.sens;}const out=d.center.map((v,i)=>v+delta[i]*mask[i]*(e.shiftKey?.1:1));store.patch(Object.fromEntries(POS_KEYS.map((k,i)=>[k,out[i]])),'cloud-gizmo');}e.preventDefault();return true;}
 function pointerUp(){if(!worldDrag)return false;worldDrag=null;return true;}
 function wheel(e){const s=store.settings;if(!s.procCloudEnabled||!s.procCloudEditActive)return false;const b=basis(),fine=e.shiftKey?.1:1;if(s.procCloudTransformMode==='scale'){const mask=axisMask(s.procCloudTransformAxis),factor=Math.exp(-e.deltaY*.001*s.procCloudDragSensitivity*fine),size=[s.procCloudSizeX,s.procCloudSizeY,s.procCloudSizeZ].map((v,i)=>mask[i]?Math.max(.1,v*factor):v);store.patch(Object.fromEntries(SIZE_KEYS.map((k,i)=>[k,size[i]])),'cloud-gizmo-wheel');}else{const center=[s.procCloudCenterX,s.procCloudCenterY,s.procCloudCenterZ],dist=Math.hypot(center[0]-b.camera[0],center[1]-b.camera[1],center[2]-b.camera[2]),amount=-e.deltaY*Math.max(.01,dist*.001)*s.procCloudDragSensitivity*fine,mask=axisMask(s.procCloudTransformAxis),delta=b.forward.map(v=>v*amount),out=center.map((v,i)=>v+delta[i]*mask[i]);store.patch(Object.fromEntries(POS_KEYS.map((k,i)=>[k,out[i]])),'cloud-gizmo-wheel');}e.preventDefault();return true;}
 store.addEventListener('change',sync);sync();
 return {panel,dockButton,sync,pointerDown,pointerMove,pointerUp,wheel,open:()=>visible(true)};
}
