import {seeded} from '../core/lut.js';
const TAU=Math.PI*2;
function gaussian(rng){
  const u=Math.max(1e-7,rng()),v=Math.max(1e-7,rng());
  return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v);
}

/**
 * Seed an approximately JONSWAP-shaped directional spectrum. The frequency-domain
 * state is initialized on the CPU once because it is deterministic startup work;
 * all time evolution and inverse transforms remain GPU-resident thereafter.
 */
export function makeSpectrum(n,span,seed,{wind=10.5,peak=90}={}){
  const rng=seeded(seed),raw=new Float32Array(n*n*2);
  const primary=-.25,secondary=1.02,g=9.81;
  const windDir=[Math.cos(primary),Math.sin(primary)];
  const crossDir=[Math.cos(secondary),Math.sin(secondary)];
  const omegaPeak=Math.sqrt(g*TAU/Math.max(peak,4));
  let energy=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const sx=x<=n/2?x:x-n,sz=z<=n/2?z:z-n;
    const kx=TAU*sx/span,kz=TAU*sz/span,k=Math.hypot(kx,kz),o=(z*n+x)*2;
    if(k<1e-6){raw[o]=raw[o+1]=0;continue;}
    const omega=Math.sqrt(g*k),sigma=omega<=omegaPeak?.07:.09;
    const r=Math.exp(-((omega-omegaPeak)**2)/(2*sigma*sigma*omegaPeak*omegaPeak));
    const gamma=Math.pow(3.3,r);
    const base=.0081*g*g/Math.max(omega**5,1e-8)*Math.exp(-1.25*Math.pow(omegaPeak/omega,4))*gamma;
    // Convert S(omega) to a rough wavenumber density and apply directional spreading.
    const jac=.5*g/Math.max(omega,1e-5),dir0=Math.max(0,(kx*windDir[0]+kz*windDir[1])/k);
    const dir1=Math.max(0,(kx*crossDir[0]+kz*crossDir[1])/k);
    const spreading=Math.pow(dir0,4)*.86+Math.pow(dir1,6)*.14;
    const capillaryDamp=Math.exp(-Math.pow(k*.30,2));
    const density=base*jac*spreading*capillaryDamp*(.65+.035*wind);
    const s=Math.sqrt(Math.max(density,0)*.5),re=gaussian(rng)*s,im=gaussian(rng)*s;
    raw[o]=re;raw[o+1]=im;energy+=re*re+im*im;
  }
  // Normalize to a stable per-cascade RMS so quality changes do not radically alter sea state.
  const desired=.72,scale=desired*n*n/Math.max(Math.sqrt(energy),1e-6);
  for(let i=0;i<raw.length;i++)raw[i]*=scale;
  const out=new Float32Array(n*n*4);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const nx=(n-x)%n,nz=(n-z)%n,i=z*n+x,ni=nz*n+nx,o=i*4;
    out[o]=raw[i*2];out[o+1]=raw[i*2+1];out[o+2]=raw[ni*2];out[o+3]=-raw[ni*2+1];
  }
  return out;
}

