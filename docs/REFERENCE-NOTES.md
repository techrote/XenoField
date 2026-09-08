# Reference and provenance notes

## PlasmaTerm reference actually inspected

User-supplied repository path: `techrote/PlasmaTerm`, branch `web-v0.1a`, specifically `web/README.md`. The branch's current README identifies the browser presentation as **web-v0.2b**. The request called it **web-v0.1b**. These labels are not silently treated as equivalent: this implementation follows the controls documented at the supplied path, not an asserted reconstruction of an unverified v0.1b tag.

Inspected resources:

- https://github.com/techrote/PlasmaTerm/blob/web-v0.1a/web/README.md — returned content blob `5032af13f2ac3f4275625a39f9af3fd7883d673c`.
- https://github.com/techrote/PlasmaTerm/blob/web-v0.1a/plasma.py — returned content blob `2c0938c3daa3ef0e88501aa19f8879f2507a47b3`; the render equation and modulation/LUT contracts were inspected.
- https://github.com/techrote/PlasmaTerm/blob/web-v0.1a/LICENSE — GNU Affero General Public License v3.
- A historical README at commit `5655772bb2f4c81eb61abe44f0167eb14bc98c6c` was also inspected. It labels itself web-v0.101a, not v0.1b; it was not used to invent a missing version match.

### Adopted concepts

The four-wave mathematical field; Frequency Y/X, Speed, Hue/LUT shift and Radius; shared Keybed pointer/keyboard behavior; latching linked parameter steps; two-entry randomization Undo; modulation that never rewrites base parameters; signed wave rate and width/offset; a 256-colour hexadecimal LUT editor with atomic complete-palette paste/export; cyclic palette randomization scaled by a percentage; floating compact windows and layout-only reset.

### Deliberate adaptations

The planar field is evaluated through spherical coordinates to build a periodic environment. Samples become linear floating-point radiance, not ANSI terminal cells. Map resolution/FPS replace terminal point-size and fit controls. Native JavaScript runs in a Web Worker; there is no copied Python/Pyodide or xterm runtime. The modulation source is adapted to the renderer's bounded parameter model. Liquid/planet materials and GPU integration are new work.

The independently implemented JavaScript files do not contain the upstream Python or web UI source verbatim. The upstream repository's license applies to its own code; preserve that provenance if incorporating upstream implementation code in future work. This note is not a claim that a named historical UI version was reproduced pixel-for-pixel.

## Supplied ABYSSAL baseline

The supplied V3.1g/updated V3.1f archive was inspected in the conversation runtime. Its seeded spectral initialization and FFT compute stages are the retained foundation in `src/render/spectrum.js` and `src/render/fft-shaders.js`. Native WebGPU resource ownership, environment processing, UI, HDR ingestion, modulation and state model are implemented in this branch.

`ABYSSAL-UPSTREAM.md` preserves the prior project's upstream note as historical provenance only. Its references to Babylon, the legacy WebGL package and files from old V3 releases do not describe this new package's runtime; those old modules and artifacts are not distributed here.

## Platform references

WGSL: https://www.w3.org/TR/WGSL/

The implementation uses standard WebGPU device, texture, buffer, bind-group and command-encoder interfaces. No third-party GPU runtime or remote shader service is required.

## Included image

`assets/calibration-panorama.hdr` is a small mathematical RGBE test image generated for this package, not a photograph, scraped asset or pre-rendered substitute for the application.
