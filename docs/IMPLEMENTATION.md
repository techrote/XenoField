> Historical V4.0 report. For the current render graph, see [V4.4a architecture](V4.4a-ARCHITECTURE.md).

# XENOFIELD 4.0 — implementation report

## Product change

The new objective is an alien liquid planet and abstract energy-field renderer. The implementation is a native WebGPU surface-only fork. It retains the supplied project's spectral initialization/FFT foundation, but removes the Babylon scene orchestration and the old underwater systems from the executable module graph.

No seabed, rocks, coral, kelp, fish, particles, caustic receiver, underwater volume, deep silhouette, multiple-scatter cache, shadow map or old post-process registry is instantiated. The new draw path is sky plus liquid, followed by one HDR display pass. Planet mode draws a globe instead of the plane. Field mode performs no liquid draw or FFT dispatch.

The V3 branch is not overwritten; this package has a separate source tree and storage namespace.

## Modules

| Module | Responsibility |
|---|---|
| `src/core/parameters.js` | Typed numeric schema, hard caps, working ranges, validation, defaults |
| `src/core/store.js` | Atomic settings/palette/project state; persistence and user presets |
| `src/core/lut.js` | 256-colour palette validation, text format, cyclic generation, linear conversion |
| `src/core/presets.js` | 16 complete world definitions and performance-control preservation |
| `src/environment/pattern.js` | Four-wave field, spherical adaptation, transient modulation, smoothing, mip generation, half-float packing |
| `src/environment/hdr.js` | Bounded Radiance RGBE reader |
| `src/environment/processor.js` | Shared worker/fallback processing implementation |
| `src/environment/worker.js` | Transferable-frame worker entry point |
| `src/environment/bridge.js` | Single-flight requests, revision rejection, panorama imports |
| `src/environment/assets.js` | Last-panorama IndexedDB storage |
| `src/render/spectrum.js` | Seeded CPU initialization of the inherited spectral model |
| `src/render/fft-shaders.js` | Native WGSL compute kernels adapted from the supplied ABYSSAL source |
| `src/render/ocean.js` | Four shared compute pipelines, fixed cascade buffers, dispatch order |
| `src/render/shaders.js` | Shared environment sampling, sky, liquid/planet shading, pseudo-Fresnel and display |
| `src/render/renderer.js` | Device, resources, passes, camera, queue and lifecycle limits |
| `src/ui/ui.js` | Generated numeric controls, floating workspace, Keybed, Modulation and LUT editing |
| `src/main.js` | Application integration and explicit preview/restart behavior |

## Shared environment

The same RGBA16F panorama and yaw transform are bound to sky and liquid shading. The environment can be generated plasma or a decoded imported image. There is no independent fixed-blue reflected sky function.

The generator's default is 96 × 48 at 24 Hz. The display runs independently, capped at 60 FPS by default. The worker applies the pattern in a fixed coordinate domain, samples the active 256-entry LUT in linear light, applies a radiance gain above unity, optionally spatially/temporally smooths, and builds the complete half-float mip chain.

Resolution changes do not alter the coordinate-domain size. A sphere-based coordinate mapping closes the longitude seam and makes the mathematical samples coincide at the poles. This is not identical to PlasmaTerm's rectangular ANSI output.

Sky upsampling modes are bilinear, smooth-coordinate bilinear and cubic B-spline reconstruction using four bilinear texture samples. The reflection path uses one environment sample with explicit mip LOD, even when the sky uses cubic reconstruction. Reflection roughness and environment blur therefore have an inexpensive sampling path.

## Pseudo-Fresnel

Given `n·v`, compute `q = 1 − clamp(n·v)`, `q²`, and `q⁵ = q² × q² × q`. A user-controlled blend of those two curves interpolates between face and edge reflection coefficients. Reflection gain scales the sampled environment radiance separately.

There is no power/exponential/trigonometric call in this angular filter. This is an artistic pseudo-Fresnel response, not a wavelength-dependent dielectric model. Environment direction-to-panorama conversion uses angular operations elsewhere in the shader, so the whole material should not be described as transcendental-free.

Body tint, energy emission and filament tint are independent controls. Fog ultimately seals to the same environment in the view direction, rather than introducing an unrelated blue/white cutoff colour. Both final scene outputs have a finite half-float headroom clamp to prevent imported HDR radiance multiplied by extreme gains from overflowing RGBA16F.

## Spectral liquid and geometry

The inherited three-band spectral configuration uses 128² / 128² / 64² simulation grids. Evolution, bit reversal, FFT stage and finalization share four compute pipelines across all stages/cascades. The visible mesh samples the states bilinearly. Increasing geometry density does not increase spectral simulation resolution or rebuild its pipelines.

The surface grid defaults to 384 × 384 vertices and concentrates density near the camera. It accepts 64–640 per side within the hard cap. Planet geometry is a closed sphere with displacement adapted from the same fields. Planet shaping is artistic: no claim is made of geophysical fluid dynamics or a spherical spectral solver.

The relief atlas is generated once at 128 × 128, with periodic Perlin/billow/ridge channels and mip levels. The former expensive repeated per-fragment octave stacks are not retained. Sky, reflection, relief, emission and foam remain independently controllable.

## UI adaptation

The UI draws on the linked PlasmaTerm workspace and interaction contract: compact draggable windows, traffic-light controls, dock restoration, Keybed pairs and latches, transient modulation, and the editable 256-colour LUT.

The implementation uses DOM controls and a native image generator. It does not include or emulate ANSI/xterm rendering, Pyodide, the native configuration generator, TCP control, or Windows-terminal escape-sequence handling. The title-bar map width and display FPS controls replace terminal point-size/display concerns with the relevant image-renderer concerns.

Every numeric row is generated from the same schema as validation. Number entry, slider changes, presets, project import and modulation all remain inside hard caps. User min/max changes affect only the working window and never rewrite the current value. Every numeric row has a neighbouring range-edit button; nonnumeric choices and hex colours are not given meaningless limits dialogs.

The versioned JSON snapshot includes values, working ranges and all ten LUTs. Panorama bytes are managed separately, and the UI reports when an external image must be reloaded.

## Lifecycle safeguards

- One outstanding worker request; obsolete revisions are ignored.
- One GPU frame submitted at a time; latest-only pending environment update under GPU backpressure.
- Same-dimension maps upload into the existing texture instead of allocating one per animation frame.
- Texture and mesh replacement retirement is fenced to submitted GPU work.
- Mesh rebuild and canvas resize are debounced; image and geometry budgets are bounded.
- Device loss retains application state and requires an explicit renderer restart.
- Repeated uncaptured GPU errors stop rendering rather than triggering uncontrolled resource reconstruction.
- Blur, visibility changes and editable-field focus release held Keybed/camera input.

These are implemented safeguards. They do not establish that the earlier user's driver/device crashes have been reproduced or eliminated.

## Acceptance evidence

See `VALIDATION.md` and the included logs. Actual liquid and planet GPU frames have not been certified. The source and component tests do not claim visual polish or frame-rate gains on the user's hardware.
