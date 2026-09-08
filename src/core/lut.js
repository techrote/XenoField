import {clamp} from './parameters.js';
export const LUT_SIZE=256;
export const PALETTE_NAMES=['Ion Orchard','Ultraviolet','Solar Copper','Cryogenic','Sulfur','Magnetar','Petroleum','Opaline','Infrared','Monochrome'];
const ANCHORS=[
 ['04051C','201154','752095','ED57AE','FFD887','B3FC75','32A68F','074052'],
 ['020116','13094D','3C1692','8452DE','EB80FA','DFFFFF','538CE0','151D60'],
 ['100308','380913','8F2014','DE5722','FFC178','FFF2B3','AB602B','311C16'],
 ['010B18','032D44','056976','35BDBA','B5FFF5','D8DAFF','547CB2','10233B'],
 ['080B02','243912','587624','AEC82D','FFFFA4','A0E275','279252','093720'],
 ['0B0316','400822','931C4C','F04880','FFC7DD','FEFCCA','696DF2','251F70'],
 ['010909','06262A','0D5B52','26A380','C3DE87','AA60A1','354370','071525'],
 ['0A0D1A','43506A','88AFA7','E2F8D2','FFEADA','EAA4D0','9C82B7','242E59'],
 ['0B0105','320209','790B14','DE2528','FC8251','FFE6A8','873967','220C31'],
 ['010305','101A22','314452','708794','D4E5E9','FAFFFF','78939B','1D2E3C']
];
export const srgbToLinear=x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);
export const linearToSrgb=x=>x<=.0031308?12.92*x:1.055*Math.pow(Math.max(0,x),1/2.4)-.055;
export function hexRGB(hex){const s=String(hex).replace(/^#/,'');if(!/^[\da-f]{6}$/i.test(s))throw new Error('A colour must have six hexadecimal digits.');return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255);}
export function rgbHex(rgb){return rgb.map(v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('').toUpperCase();}
export function cyclicPalette(anchors,size=LUT_SIZE){
 const rgb=anchors.map(hexRGB);return Array.from({length:size},(_,i)=>{const x=i*rgb.length/size,j=Math.floor(x),t=x-j,u=t*t*(3-2*t);return rgbHex(rgb[j].map((v,k)=>v+(rgb[(j+1)%rgb.length][k]-v)*u));});
}
export function defaultPalettes(){return ANCHORS.map(a=>cyclicPalette(a));}
export function validatePalette(values){if(!Array.isArray(values)||values.length!==LUT_SIZE)throw new Error('A LUT must contain exactly 256 RRGGBB colours.');return values.map(v=>{if(typeof v!=='string'||!/^#?[\da-f]{6}$/i.test(v))throw new Error('Invalid LUT value; nothing was changed.');return v.replace(/^#/,'').toUpperCase();});}
export function parsePalette(text){
 if(typeof text!=='string')throw new Error('Paste palette text.');
 const values=text.trim().replace(/[\[\]"']/g,'').split(/[\s,]+/).filter(Boolean);
 return validatePalette(values);
}
export function exportPalette(values){const v=validatePalette(values);return Array.from({length:32},(_,i)=>v.slice(i*8,i*8+8).join(', ')).join('\n');}
export function linearPalette(values){const p=new Float32Array(256*3);validatePalette(values).forEach((h,i)=>hexRGB(h).forEach((c,j)=>p[i*3+j]=srgbToLinear(c)));return p;}
export function seeded(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function hsv(h,s,v){const f=(n)=>{const k=(n+h*6)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1));};return [f(5),f(3),f(1)];}
export function varyPalette(current,scale,seed){
 const old=validatePalette(current);if(!Number.isFinite(scale)||scale<0||scale>100)throw new Error('Palette variation must be 0…100.');if(scale===0)return old;
 const rng=seeded(seed),h=rng(),s=.4+rng()*.5;
 const anchors=Array.from({length:8},(_,i)=>rgbHex(hsv((h+i*.08+.06*rng())%1,s, .07+.87*Math.pow(Math.sin(Math.PI*(i+.5)/8),2))));
 const next=cyclicPalette(anchors),t=scale/100;
 return old.map((c,i)=>rgbHex(hexRGB(c).map((v,j)=>linearToSrgb(srgbToLinear(v)*(1-t)+srgbToLinear(hexRGB(next[i])[j])*t))));
}
