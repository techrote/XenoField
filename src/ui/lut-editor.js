import {PALETTE_NAMES,hexRGB,rgbHex,parsePalette,exportPalette,varyPalette} from '../core/lut.js';

const GRID=16, COUNT=256;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const indexXY=i=>[i%GRID,Math.floor(i/GRID)];
const xyIndex=(x,y)=>y*GRID+x;
const isHex=v=>/^#?[0-9a-f]{6}$/i.test(String(v||''));
const normalizeHex=v=>String(v).replace(/^#/,'').toUpperCase();

function rectBounds(indices){
 if(!indices.length)return null;
 let minX=GRID-1,minY=GRID-1,maxX=0,maxY=0;
 for(const i of indices){const [x,y]=indexXY(i);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 return {minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1};
}
function lineHexCounts(text){
 return String(text).trim().split(/\r?\n/).map(line=>(line.match(/#?[0-9a-f]{6}/ig)||[]).length).filter(Boolean);
}
function decodeClipboard(text){
 const raw=String(text||'').trim();
 if(!raw)return null;
 if(raw.startsWith('XENOFIELD_LUT_REGION_V1\n')){
  try{
   const data=JSON.parse(raw.slice(raw.indexOf('\n')+1));
   if(!Number.isInteger(data.width)||!Number.isInteger(data.height)||data.width<1||data.height<1||data.width>GRID||data.height>GRID)throw new Error('bad LUT region dimensions');
   if(!Array.isArray(data.colors)||data.colors.length!==data.width*data.height)throw new Error('bad LUT region colours');
   const colors=data.colors.map(v=>v==null?null:(isHex(v)?normalizeHex(v):null));
   const mask=Array.isArray(data.mask)&&data.mask.length===colors.length?data.mask.map(Boolean):colors.map(v=>v!==null);
   return {width:data.width,height:data.height,colors,mask};
  }catch{return null;}
 }
 const hits=(raw.match(/#?[0-9a-f]{6}/ig)||[]).map(normalizeHex);
 if(!hits.length)return null;
 const counts=lineHexCounts(raw),uniform=counts.length>1&&counts.every(v=>v===counts[0]);
 let width=uniform?counts[0]:(hits.length===COUNT?GRID:hits.length),height=uniform?counts.length:(hits.length===COUNT?GRID:1);
 if(width>GRID||height>GRID||width*height!==hits.length){width=Math.min(GRID,hits.length);height=Math.ceil(hits.length/width);}
 const total=width*height,colors=Array(total).fill(null),mask=Array(total).fill(false);
 for(let i=0;i<Math.min(total,hits.length);i++){colors[i]=hits[i];mask[i]=true;}
 return {width,height,colors,mask};
}
function encodeClipboard(region){return `XENOFIELD_LUT_REGION_V1\n${JSON.stringify(region)}`;}
function interpolateHex(a,b,t){
 const aa=hexRGB(a),bb=hexRGB(b);return rgbHex(aa.map((v,i)=>v+(bb[i]-v)*clamp(t,0,1)));
}
function hash01(n){n=(n^61)^(n>>>16);n=Math.imul(n,9);n=n^(n>>>4);n=Math.imul(n,0x27d4eb2d);n=n^(n>>>15);return (n>>>0)/4294967295;}

export function installLUTEditor({store,$,notify,download}){
 const grid=$('lutGrid'),strip=$('lutStrip'),slot=$('lutSlot');
 const cells=[],inputs=[];let selection=new Set(),activeIndex=0,drag=null,tool='select',internalClipboard=null,history=[],redo=[],stroke=null,strokeSeed=1;
 const colors={a:'ED57AE',b:'32A68F'};
 const toolButtons={select:$('lutToolSelect'),brush:$('lutToolBrush'),pick:$('lutToolPick')};

 for(let i=0;i<10;i++){const o=document.createElement('option');o.value=i;o.textContent=`${i} · ${PALETTE_NAMES[i]}`;slot.append(o);}
 slot.onchange=()=>store.set('lutSlot',+slot.value);

 function current(){return store.palettes[store.settings.lutSlot];}
 function setTool(next){tool=next;for(const [name,b] of Object.entries(toolButtons)){if(!b)continue;b.classList.toggle('active',name===tool);b.setAttribute('aria-pressed',String(name===tool));}grid.dataset.tool=tool;updateStatus();}
 function selectedIndices(){return [...selection].sort((a,b)=>a-b);}
 function targetIndices(){const s=selectedIndices();return s.length?s:[activeIndex];}
 function updateStatus(extra=''){
  const s=selectedIndices(),b=rectBounds(s);$('lutSelectionStatus').textContent=s.length?`${s.length} CELLS · ${b.width}×${b.height} · X${b.minX}–${b.maxX} Y${b.minY}–${b.maxY}${extra?` · ${extra}`:''}`:`NO SELECTION · ACTIVE ${activeIndex}${extra?` · ${extra}`:''}`;
  $('lutUndo').disabled=!history.length;$('lutRedo').disabled=!redo.length;
 }
 function paintCell(i,value=current()[i]){
  const c=normalizeHex(value);inputs[i].value=c;inputs[i].style.background='#'+c;const [r,g,b]=hexRGB(c);inputs[i].style.color=r*.2126+g*.7152+b*.0722>.48?'#071014':'#fff';
  cells[i].classList.toggle('selected',selection.has(i));cells[i].classList.toggle('active',i===activeIndex);
 }
 function paintSelection(){for(let i=0;i<COUNT;i++){cells[i].classList.toggle('selected',selection.has(i));cells[i].classList.toggle('active',i===activeIndex);}updateStatus();}
 function paintStrip(p=current()){
  const ctx=strip.getContext('2d'),w=strip.width,h=strip.height;for(let i=0;i<COUNT;i++){ctx.fillStyle='#'+p[i];ctx.fillRect(i*w/COUNT,0,Math.ceil(w/COUNT),h);}
 }
 function syncPalette(){const p=current();for(let i=0;i<COUNT;i++)paintCell(i,p[i]);paintStrip(p);slot.value=store.settings.lutSlot;updateColorUI();updateStatus();}
 function pushHistory(before,after,label,slotIndex=store.settings.lutSlot){
  if(before.every((v,i)=>v===after[i]))return false;history.push({slot:slotIndex,before:[...before],after:[...after],label});if(history.length>64)history.shift();redo.length=0;updateStatus(label);return true;
 }
 function commit(next,label,before=[...current()]){next=next.map(normalizeHex);if(!pushHistory(before,next,label))return false;store.replacePalette(store.settings.lutSlot,next);return true;}
 function applyRecorded(rec,which){const target=which==='before'?rec.before:rec.after;store.replacePalette(rec.slot,target);if(rec.slot===store.settings.lutSlot)syncPalette();}
 function undo(){const rec=history.pop();if(!rec)return;redo.push(rec);applyRecorded(rec,'before');updateStatus(`UNDO ${rec.label}`);}
 function redoEdit(){const rec=redo.pop();if(!rec)return;history.push(rec);applyRecorded(rec,'after');updateStatus(`REDO ${rec.label}`);}

 for(let i=0;i<COUNT;i++){
  const cell=document.createElement('div');cell.className='lut-cell';cell.dataset.i=i;const f=document.createElement('input');f.maxLength=6;f.dataset.i=i;f.readOnly=true;f.spellcheck=false;f.autocomplete='off';f.setAttribute('aria-label',`LUT CELL ${i}`);
  f.ondblclick=e=>{e.stopPropagation();activeIndex=i;f.readOnly=false;f.focus();f.select();paintSelection();};
  f.onblur=()=>{f.readOnly=true;};
  f.onkeydown=e=>{if(e.key==='Enter'){f.blur();}else if(e.key==='Escape'){f.value=current()[i];f.blur();}};
  f.onchange=()=>{try{if(!isHex(f.value))throw new Error('A LUT cell must be six hexadecimal digits.');const before=[...current()],next=[...before];next[i]=normalizeHex(f.value);activeIndex=i;selection=new Set([i]);commit(next,'CELL EDIT',before);}catch(e){notify(e.message);syncPalette();}};
  cell.append(f);grid.append(cell);cells.push(cell);inputs.push(f);
 }

 function setRect(a,b,mode='replace'){
  const [ax,ay]=indexXY(a),[bx,by]=indexXY(b),minX=Math.min(ax,bx),maxX=Math.max(ax,bx),minY=Math.min(ay,by),maxY=Math.max(ay,by),rect=[];
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)rect.push(xyIndex(x,y));
  const base=drag?.base||new Set();if(mode==='replace')selection=new Set(rect);else{selection=new Set(base);if(mode==='add')rect.forEach(i=>selection.add(i));else if(mode==='subtract')rect.forEach(i=>selection.delete(i));else if(mode==='toggle')rect.forEach(i=>base.has(i)?selection.delete(i):selection.add(i));}
  activeIndex=b;paintSelection();
 }
 function pointerCell(e){return document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.lut-cell');}
 function selectionMode(e){return e.altKey?'subtract':(e.ctrlKey||e.metaKey)?'toggle':e.shiftKey?'add':'replace';}
 function beginSelect(i,e){drag={kind:'select',anchor:i,last:i,mode:selectionMode(e),base:new Set(selection)};setRect(i,i,drag.mode);grid.setPointerCapture?.(e.pointerId);e.preventDefault();}
 function brushOffsets(shape,size,seed,center){
  const r=Math.max(0,size-1),out=[];for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
   let ok=shape==='square'||(shape==='diamond'?Math.abs(dx)+Math.abs(dy)<=r:(shape==='round'?dx*dx+dy*dy<=r*r+.3:true));
   if(shape==='pixel')ok=dx===0&&dy===0;
   if(shape==='irregular'){const dist=Math.sqrt(dx*dx+dy*dy);ok=dist<=r+.35&&hash01(seed+center*131+dx*733+dy*1999)>(dist/Math.max(1,r+1))*.28;}
   if(ok)out.push([dx,dy]);
  }return out;
 }
 function beginStroke(i,e){const before=[...current()];stroke={before,draft:[...before],changed:new Set(),seed:++strokeSeed,color:e.button===2?colors.b:colors.a};applyBrush(i);grid.setPointerCapture?.(e.pointerId);e.preventDefault();}
 function applyBrush(i){if(!stroke)return;const [cx,cy]=indexXY(i),shape=$('lutBrushShape').value,size=+$('lutBrushSize').value||1;for(const [dx,dy] of brushOffsets(shape,size,stroke.seed,i)){const x=cx+dx,y=cy+dy;if(x<0||x>=GRID||y<0||y>=GRID)continue;const n=xyIndex(x,y);stroke.draft[n]=stroke.color;stroke.changed.add(n);paintCell(n,stroke.color);}paintStrip(stroke.draft);activeIndex=i;}
 function endStroke(){if(!stroke)return;const s=stroke;stroke=null;if(s.changed.size){selection=new Set(s.changed);commit(s.draft,'BRUSH STROKE',s.before);}else syncPalette();}
 function pick(i,secondary=false){const c=current()[i];colors[secondary?'b':'a']=c;activeIndex=i;selection=new Set([i]);updateColorUI();paintSelection();updateStatus(`PICK ${secondary?'B':'A'}`);}

 grid.oncontextmenu=e=>e.preventDefault();
 grid.addEventListener('pointerdown',e=>{const cell=e.target.closest('.lut-cell');if(!cell||![0,2].includes(e.button))return;const i=+cell.dataset.i;if(tool==='brush')beginStroke(i,e);else if(tool==='pick'){e.preventDefault();pick(i,e.button===2);}else beginSelect(i,e);});
 grid.addEventListener('pointermove',e=>{if(stroke){const cell=pointerCell(e);if(cell)applyBrush(+cell.dataset.i);return;}if(!drag)return;const cell=pointerCell(e);if(!cell)return;const i=+cell.dataset.i;if(i!==drag.last){drag.last=i;setRect(drag.anchor,i,drag.mode);}});
 grid.addEventListener('pointerup',()=>{if(stroke)endStroke();drag=null;});grid.addEventListener('pointercancel',()=>{if(stroke)endStroke();drag=null;});

 function regionFromSelection(){
  const ids=targetIndices(),b=rectBounds(ids),sel=new Set(ids),p=current(),colorsOut=[],mask=[];for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++){const i=xyIndex(x,y),on=sel.has(i);colorsOut.push(on?p[i]:null);mask.push(on);}return {width:b.width,height:b.height,colors:colorsOut,mask};
 }
 async function copy(cut=false){
  const region=regionFromSelection(),text=encodeClipboard(region);internalClipboard={...region,colors:[...region.colors],mask:[...region.mask]};try{await navigator.clipboard?.writeText?.(text);}catch{}
  if(cut){const before=[...current()],next=[...before];for(const i of targetIndices())next[i]='000000';commit(next,'CUT',before);}updateStatus(cut?'CUT':'COPIED');
 }
 function pasteRegion(region){
  if(!region)return notify('NO LUT REGION IS AVAILABLE TO PASTE.');const before=[...current()],next=[...before],ids=selectedIndices();let changed=0;
  if(ids.length){const b=rectBounds(ids),dest=new Set(ids);for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++){const di=xyIndex(x,y);if(!dest.has(di))continue;const sx=(x-b.minX)%region.width,sy=(y-b.minY)%region.height,si=sy*region.width+sx;if(region.mask[si]&&region.colors[si]){next[di]=region.colors[si];changed++;}}}
  else{const [ax,ay]=indexXY(activeIndex);for(let sy=0;sy<region.height;sy++)for(let sx=0;sx<region.width;sx++){const si=sy*region.width+sx,x=ax+sx,y=ay+sy;if(x>=GRID||y>=GRID||!region.mask[si]||!region.colors[si])continue;next[xyIndex(x,y)]=region.colors[si];changed++;}}
  if(changed)commit(next,'PASTE',before);else notify('PASTE REGION DID NOT OVERLAP AN EDITABLE DESTINATION.');
 }
 async function paste(){let region=null;try{const text=await navigator.clipboard?.readText?.();region=decodeClipboard(text);}catch{}if(!region)region=internalClipboard;pasteRegion(region);}

 function selectAll(){selection=new Set(Array.from({length:COUNT},(_,i)=>i));paintSelection();}
 function selectNone(){selection.clear();paintSelection();}
 function invertSelection(){const next=new Set();for(let i=0;i<COUNT;i++)if(!selection.has(i))next.add(i);selection=next;paintSelection();}
 function selectRow(){const [,y]=indexXY(activeIndex);selection=new Set(Array.from({length:GRID},(_,x)=>xyIndex(x,y)));paintSelection();}
 function selectColumn(){const [x]=indexXY(activeIndex);selection=new Set(Array.from({length:GRID},(_,y)=>xyIndex(x,y)));paintSelection();}
 function fill(){const before=[...current()],next=[...before];for(const i of targetIndices())next[i]=colors.a;commit(next,'FILL',before);}
 function gradient(){
  const ids=selectedIndices().length?selectedIndices():Array.from({length:COUNT},(_,i)=>i),b=rectBounds(ids),sel=new Set(ids),before=[...current()],next=[...before],mode=$('lutGradientMode').value,cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2,maxR=Math.max(.001,Math.hypot(Math.max(cx-b.minX,b.maxX-cx),Math.max(cy-b.minY,b.maxY-cy)));
  for(const i of ids){if(!sel.has(i))continue;const [x,y]=indexXY(i);let t=0;if(mode==='vertical')t=(y-b.minY)/Math.max(1,b.height-1);else if(mode==='diagonal')t=((x-b.minX)/Math.max(1,b.width-1)+(y-b.minY)/Math.max(1,b.height-1))*.5;else if(mode==='radial')t=Math.hypot(x-cx,y-cy)/maxR;else t=(x-b.minX)/Math.max(1,b.width-1);next[i]=interpolateHex(colors.a,colors.b,t);}
  commit(next,`GRADIENT ${mode.toUpperCase()}`,before);
 }
 function transform(kind){
  const ids=targetIndices(),b=rectBounds(ids),sel=new Set(ids),before=[...current()],next=[...before];for(const i of ids){const [x,y]=indexXY(i),rx=x-b.minX,ry=y-b.minY;let sx=rx,sy=ry;if(kind==='flip-h')sx=b.width-1-rx;else if(kind==='flip-v')sy=b.height-1-ry;else if(kind==='rotate-180'){sx=b.width-1-rx;sy=b.height-1-ry;}const src=xyIndex(b.minX+sx,b.minY+sy);if(sel.has(src))next[i]=before[src];}commit(next,kind.toUpperCase(),before);
 }

 function updateColorUI(){for(const k of ['a','b']){const picker=$(`lutColor${k.toUpperCase()}`),hex=$(`lutColor${k.toUpperCase()}Hex`);picker.value='#'+colors[k];if(document.activeElement!==hex)hex.value=colors[k];$(`lutSwatch${k.toUpperCase()}`).style.background='#'+colors[k];}}
 function bindColor(k){const picker=$(`lutColor${k.toUpperCase()}`),hex=$(`lutColor${k.toUpperCase()}Hex`);picker.oninput=()=>{colors[k]=normalizeHex(picker.value);updateColorUI();};hex.onchange=()=>{if(!isHex(hex.value)){notify('COLOUR MUST BE SIX HEX DIGITS.');updateColorUI();return;}colors[k]=normalizeHex(hex.value);updateColorUI();};}
 bindColor('a');bindColor('b');$('lutSwapColors').onclick=()=>{[colors.a,colors.b]=[colors.b,colors.a];updateColorUI();};

 $('lutToolSelect').onclick=()=>setTool('select');$('lutToolBrush').onclick=()=>setTool('brush');$('lutToolPick').onclick=()=>setTool('pick');
 $('lutSelectAll').onclick=selectAll;$('lutSelectNone').onclick=selectNone;$('lutInvertSelection').onclick=invertSelection;$('lutSelectRow').onclick=selectRow;$('lutSelectColumn').onclick=selectColumn;
 $('lutCopy').onclick=()=>copy(false);$('lutCut').onclick=()=>copy(true);$('lutPaste').onclick=paste;$('lutUndo').onclick=undo;$('lutRedo').onclick=redoEdit;
 $('lutFill').onclick=fill;$('lutGradient').onclick=gradient;$('lutFlipH').onclick=()=>transform('flip-h');$('lutFlipV').onclick=()=>transform('flip-v');$('lutRotate180').onclick=()=>transform('rotate-180');
 $('randomLUT').onclick=()=>{try{const before=[...current()],next=varyPalette(before,store.settings.lutRandomScale,Date.now()>>>0);commit(next,'RANDOMISE',before);}catch(e){notify(e.message);}};
 $('exportLUT').onclick=()=>download(`Xenofield-LUT-${store.settings.lutSlot}.txt`,exportPalette(current()),'text/plain');$('importLUT').onclick=()=>$('lutFile').click();$('lutFile').onchange=async()=>{const f=$('lutFile').files[0];if(f)try{const before=[...current()],next=parsePalette(await f.text());commit(next,'IMPORT LUT',before);}catch(e){notify(e.message);}$('lutFile').value='';};

 $('lut').addEventListener('paste',e=>{const region=decodeClipboard(e.clipboardData?.getData('text'));if(region){e.preventDefault();internalClipboard=region;pasteRegion(region);}});
 $('lut').addEventListener('copy',e=>{const region=regionFromSelection();internalClipboard={...region,colors:[...region.colors],mask:[...region.mask]};if(e.clipboardData){e.clipboardData.setData('text/plain',encodeClipboard(region));e.preventDefault();}updateStatus('COPIED');});
 $('lut').addEventListener('cut',e=>{const region=regionFromSelection();internalClipboard={...region,colors:[...region.colors],mask:[...region.mask]};if(e.clipboardData){e.clipboardData.setData('text/plain',encodeClipboard(region));e.preventDefault();}const before=[...current()],next=[...before];for(const i of targetIndices())next[i]='000000';commit(next,'CUT',before);});
 $('lut').addEventListener('keydown',e=>{
  if(e.target.closest('input:not([readonly]),select,textarea'))return;const mod=e.ctrlKey||e.metaKey;if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();selectAll();}else if(mod&&e.key.toLowerCase()==='c'){e.preventDefault();copy(false);}else if(mod&&e.key.toLowerCase()==='x'){e.preventDefault();copy(true);}else if(mod&&e.key.toLowerCase()==='v'){return;}else if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoEdit():undo();}else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redoEdit();}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();const before=[...current()],next=[...before];for(const i of targetIndices())next[i]='000000';commit(next,'CLEAR',before);}else if(e.key.toLowerCase()==='b'){setTool('brush');}else if(e.key.toLowerCase()==='s'){setTool('select');}else if(e.key.toLowerCase()==='i'){setTool('pick');}
 });
 strip.addEventListener('pointerdown',e=>{const r=strip.getBoundingClientRect(),i=clamp(Math.floor((e.clientX-r.left)/Math.max(1,r.width)*COUNT),0,COUNT-1);activeIndex=i;selection=new Set([i]);paintSelection();});

 setTool('select');updateColorUI();syncPalette();
 return {syncPalette,decodeClipboard,selectAll,selectNone,setTool};
}
