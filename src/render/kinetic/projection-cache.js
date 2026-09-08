/** Reuse the scene's mapping implementation in the coarse cache, not a second mapping bank.
 * A volume has no mesh UV or material normal: its fallback UV is planar and its normal is radial.
 * All geometric mappings, A/B mixing, transforms, wrapping and projection masks remain shared.
 */
import {MESH_SURFACE} from '../shaders.js';
const first=MESH_SURFACE.indexOf('fn rotX('),last=MESH_SURFACE.indexOf('struct MeshIn',first);
if(first<0||last<first)throw new Error('Shared scene projection helpers were not found.');
const uniforms={projectionOrigin:54,projectionRotation:55,projectionScale:56,projectionOffset:57,projection0:58,projectionExtra:59,projectionMisc:60,cameraTime:4,rightAspect:5,upTan:6};
export const CACHE_PROJECTION=MESH_SURFACE.slice(first,last).replace(/\bu\.([A-Za-z0-9_]+)/g,(_,key)=>{if(!Object.hasOwn(uniforms,key))throw new Error(`Unmapped volume projection uniform: ${key}`);return `k.p[${uniforms[key]}]`;}).replace(/\bdetailTexture\b/g,'atlas').replace(/\bdetailSampler\b/g,'samp');
