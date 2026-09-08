> Historical notice copied from the supplied ABYSSAL baseline. References to its files, Babylon runtime and legacy WebGL artifact are historical; those are not included in XENOFIELD 4.0. See REFERENCE-NOTES.md for the active implementation.

# Upstream and reference provenance

## Legacy source

ABYSSAL V2.x was derived from:

- `emollick/abyssal-living-deep`
- upstream license: MIT

The frozen compatibility artifact is preserved under `legacy-webgl/`.

## V3 research references

V3 code in this package was freshly implemented after studying these projects:

- `siliconjungle/inkwell-webgpu-water` — MIT
- `dgreenheck/webgpu-galaxy` — MIT
- `vercel-labs/vgpu` — MIT
- `BarthPaleologue/volumetric-atmospheric-scattering` — Apache License 2.0
- `BabylonJS/Babylon.js` — Apache License 2.0

No third-party shader source was copied verbatim into the custom V3 WGSL modules.

See `docs/REFERENCE-AUDIT.md` for the adopted concepts and deliberate non-adoptions.


## Volumetric cache reference

- https://github.com/jeantimex/procedural-clouds — MIT licensed. V3.016 retains a fresh water-specific ping-pong 3D cache for underwater turbidity and uses a second cache only for surface-mist internal detail; authoritative surface aerosol support now comes from the OceanGPU-driven 2.5D spray field.


## V3.1a integration work

The renderer registry, runtime adapters, resource transactions, optional-layer modules, material hooks, and test/capture tooling in this release were added to the supplied V3.017 baseline. Babylon remains a CDN-loaded dependency; it is not vendored. See `docs/V3.1a-API-NOTES.md` for API contracts consulted, and the implementation report for the limits of verification. Existing upstream and legacy notices above are retained as historical provenance.
