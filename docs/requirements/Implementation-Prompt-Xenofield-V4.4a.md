Implement the accompanying **Implementation-Plan-Xenofield-V4.4a.md** as a complete renderer-engineering release.

Do not merely prototype disconnected shaders.

Do not restore the removed ABYSSAL underwater/world simulation.

The goal has changed.

Xenofield now renders:

- alien planetary materials;
- energy fields;
- synthetic liquids;
- impossible atmospheres;
- volumetric structures;
- abstract kinetic matter.

Visual effects are not required to obey physical water, atmospheric or optical behaviour.

The governing objective is:

> **Maximum visual complexity, flexibility and user control per millisecond of GPU work.**

Use physical techniques only when they are computationally advantageous.

---

# Existing Architecture Is the Foundation

Preserve:

- native WebGPU ownership;
- current spectral FFT/ocean compute;
- liquid mode;
- planet mode;
- field mode;
- imported mesh mode;
- SkySynth;
- HDR/HDRI environment processing;
- mixer;
- Noixtur;
- projection system;
- masks;
- LUTs;
- modular presets;
- compact UI;
- current persistence;
- GPU timestamp instrumentation;
- existing fail-open philosophy.

Do not rewrite working systems unnecessarily.

Current Xenofield already renders an HDR scene with a depth attachment and then performs a fullscreen display pass.

Exploit that structure.

---

# Primary Deliverable

Transform the render graph from approximately:

```text
SkySynth/HDRI
   +
Spectral FFT
   ↓
Sky + surface
   ↓
HDR display
```

into:

```text
SkySynth/HDRI
Spectral FFT
      ↓
SceneAux / Linear Depth
      ↓
HDR scene
      ↓
Depth Pyramid
      ↓
Coarse XenoVolume
      ↓
Low-resolution stochastic effects
      ↓
Temporal reconstruction / feedback
      ↓
Kinetic compositing
      ↓
AA / high-quality resolve
      ↓
HDR display
```

Keep the pipeline understandable.

Do not create a giant monolithic shader.

---

# Critical Principle: Cache, Undersample, Reconstruct

Whenever an expensive effect appears necessary, first ask whether it can instead be:

- generated at coarse resolution;
- cached;
- updated less frequently;
- sampled sparsely;
- dithered;
- temporally reconstructed;
- augmented with cheap screen-space detail.

Prefer:

```text
32³ cache + 8 stochastic samples + history
```

over:

```text
128³ cache + 64 deterministic samples every frame
```

when the former creates equal or more interesting images.

Visual kinetics may be noisy, discontinuous, quantized, unstable or nonphysical if the result is useful and controllable.

---

# Procedural-Cloud Reference

Study the supplied/reference `jeantimex/procedural-clouds` implementation.

Adopt the useful architecture:

- compute-generated 3D density cache;
- ping-pong cache generations;
- configurable cache update rate;
- temporal interpolation between generations;
- low-cost fullscreen raymarch;
- stochastic ray-start dithering;
- early transmittance termination.

Do not blindly clone its renderer.

Its default nested screen-space light marching is not appropriate as Xenofield's normal path.

Replace that cost with cached volumetric lighting.

If source code is substantially reused, retain required MIT attribution/license text.

---

# Implement SceneAuxGPU

Create a cheap reusable auxiliary surface stage.

At minimum provide:

```text
linear depth
normal/facing information
surface energy/control scalar
```

Make these available to compositor and mask routing.

Depth must remain single-sampled and usable when scene MSAA is enabled.

A cheap prepass is acceptable because Xenofield's geometry workload is small.

Avoid building a conventional deferred renderer.

---

# Make Depth an Artistic Signal

Implement depth-derived sources:

```text
depth
inverse depth
depth bands
quantized depth
depth sine/wave
depth edge
depth gradient
silhouette
normal facing
normal edge
```

Expose them as normal mask inputs.

Allow:

- threshold;
- gamma;
- inversion;
- band frequency;
- phase;
- animation;
- near/far remap;
- softness.

Add debug views.

---

# Implement a Small Linear-Depth Pyramid

Generate a mip/reduction pyramid.

Use it only where useful for:

- large depth structures;
- signed dark bloom;
- contour radius;
- volumetric clipping;
- cheap occlusion estimates;
- multi-scale depth effects.

Do not restore ABYSSAL GPU world visibility/culling machinery.

---

# Implement TemporalFieldGPU

Create shared temporal/history infrastructure.

It must support:

### Conservative resolve

For:

- temporal AA;
- sparse-volume reconstruction;
- stable stochastic effects.

Use:

- camera reprojection;
- depth rejection;
- disocclusion rejection;
- neighbourhood clamp;
- luminance confidence;
- reset on resize/mode/camera discontinuity.

### Kinetic feedback

For intentional trails and impossible motion.

Expose:

- persistence;
- decay;
- gain;
- hue shift;
- feedback zoom;
- rotation;
- XY drift;
- spatial warp;
- additive/screen/difference/max/min feedback;
- optional depth rejection.

These modes must be independently usable.

Do not force the artifact-free TAA history to share destructive artistic feedback state.

---

# Implement XenoVolumeGPU

Create a generalized cached 3D artistic field.

Recommended cache dimensions:

```text
16³
24³
32³
48³
64³
96³ experimental
```

Default around:

```text
32³ or 48³
```

Probe compact filterable/writeable formats.

Prefer compact storage when possible.

Use available cache channels efficiently.

Suggested semantic layout:

```text
R density
G cached lighting/transmittance
B structural/edge/phase field
A emission/secondary field
```

Do not allocate a large floating-point RGBA cache while using only the red channel.

---

# Volume Generation Must Be Extremely Controllable

Combine existing Xenofield field sources with 3D procedural functions.

Support:

- Perlin;
- billow;
- ridge;
- Voronoi/cellular;
- spectral values;
- projection coordinates;
- masks;
- Noixtur;
- SkySynth-derived values;
- hash fields.

Add arbitrary shaping:

- threshold;
- smooth threshold;
- quantization;
- invert;
- power/curve;
- fold;
- abs;
- difference;
- cell snap;
- coordinate warp;
- coordinate repeat/mirror;
- phase offsets.

This is not a meteorological cloud model.

Treat the volume as a programmable visual field.

---

# Cache Lighting Instead of Re-Marching Per Pixel

Default volume lighting must not perform a nested secondary raymarch for every occupied primary-ray sample.

Implement one or more cached modes:

### Gradient
Density-gradient normal + directional light.

### Cached Short March
A second compute pass samples a few voxels toward the light direction.

### Mip Approximation
Use coarse density mips for large-scale attenuation.

Store the result in the cache.

Retain `Live Light March` only as an explicitly expensive experimental option.

---

# Sparse Raymarch

Render XenoVolume at independently selectable resolution:

```text
Full
Half
Third
Quarter
Sixth
Eighth
```

Default Quarter.

Support:

```text
4 / 6 / 8 / 12 / 16 / 24 / 32
```

primary samples.

Use:

- randomized ray entry;
- rotating stochastic phase;
- early empty rejection;
- early transmittance termination;
- scene-depth clipping;
- temporal reconstruction.

Do not hide the low sample count by simply increasing it whenever artifacts appear.

First improve the reconstruction/dither strategy.

---

# Coarse Dither / Voxel Effects

Implement the user's core requested concept as a first-class feature.

A very coarse volume must be able to become a high-complexity spray/particle/energy field through:

- thresholded density;
- stochastic voxel dropout;
- coarse Bayer masks;
- blue-noise masks;
- per-cell random values;
- temporal mask rotation;
- nearest/trilinear interpolation choice;
- voxel-edge highlights;
- cell emission;
- density posterization;
- ray-step quantization;
- slice quantization.

Provide presets demonstrating that a 24³ or 32³ field can appear substantially more complex than its actual spatial resolution.

---

# Inject Cheap Fine Detail After the Coarse Volume

Do not increase 3D resolution for every fine feature.

Allow coarse 3D field output to be multiplied/modulated by:

- existing 2D relief atlas;
- screen-space hash;
- blue noise;
- projected Noixtur;
- depth edges;
- normal edges;
- projected surface patterns.

This high/low-frequency separation is central to the performance strategy.

---

# Volume Placement

Support at minimum:

```text
World Box
Camera Slab
Surface Shell
Planet Shell
Mesh Local
Mesh Normal Shell
Screen Extrusion
Infinite/Tiled
```

Depth-clip all applicable modes.

Do not assume a horizontal ocean surface.

---

# Compositor

Implement a lightweight `KineticCompositorGPU`.

The compositor should receive:

- scene HDR;
- SceneAux;
- linear depth / depth pyramid;
- XenoVolume result;
- temporal histories;
- mask-router result.

Support independent modules for:

- volume;
- depth shaping;
- refraction/distortion;
- temporal feedback;
- signed bloom;
- LUT/colour;
- AA resolve.

Each optional module must stop doing meaningful GPU work when disabled.

---

# Signed Compositing

Treat effects as multiple signal types.

Allow volume/field results to behave as:

```text
positive radiance
negative radiance/absorption
opacity
mask
distortion
LUT modulation
bloom source
```

Implement both positive bloom and Dark Bloom / negative bloom.

Dark Bloom should use a reduced-resolution dark mask + blur + multiplicative composition.

It must not simply be a vignette.

---

# Screen-Space Distortion

Implement a depth-aware scene-colour displacement layer.

Possible vector sources:

- surface normal;
- depth gradient;
- XenoVolume gradient;
- procedural field;
- mask;
- temporal difference.

Expose:

- strength;
- scale;
- threshold;
- depth response;
- chromatic split;
- separate RGB offsets;
- phase;
- direction;
- animated drift.

Do not constrain this to realistic refraction.

---

# Mask Routing Is Critical

Extend the existing mask system with:

```text
depth
inverse-depth
depth-edge
depth-band
normal-facing
normal-edge
surface-energy
volume-density
volume-light
volume-edge
volume-emission
history
history-difference
feedback
```

Existing mixer/noixture/foam/cloud/etc. layers should be able to consume these where architecturally sensible.

Do not build isolated mask systems per new effect.

---

# Traditional AA and Filtering

Implement the highest-quality legal options, but name them accurately.

## MSAA

Native WebGPU:

```text
1×
4×
```

Do not claim native 8×/16× MSAA.

Use a multisampled HDR scene and resolve target when enabled.

Keep compositing depth separately available.

## SSAA

Implement area factors:

```text
1×
2×
4×
8×
```

The render-size multiplier per axis should be approximately:

```text
sqrt(area factor)
```

so 8× means approximately 2.828× width and height, not 8× each axis.

Downsample through selectable high-quality reconstruction.

Raise/rework the existing small fixed render-target cap so Extreme modes can operate where device dimensions and configured memory safeguards permit.

Do not silently allocate absurd resources.

## Temporal Supersampling

Implement:

```text
Off
2
4
8
16
32
```

subpixel history samples.

Use deterministic jitter.

This should also improve stochastic volumetric effects.

## Hybrid AA

Allow:

- MSAA4 + Temporal;
- SSAA + Temporal;
- MSAA4 + moderate SSAA + Temporal.

Do not force all extreme options simultaneously.

Provide an explicitly marked experimental extreme preset.

---

# Trilinear / Anisotropic Filtering

Centralize sampler quality.

Support:

```text
Nearest
Bilinear
Trilinear
AF2
AF4
AF8
AF16
```

For anisotropic sampling use linear mag/min/mipmap filtering as required.

Use AF where texture footprints are genuinely anisotropic:

- projected surface maps;
- detail textures;
- oblique surface sampling.

Do not waste it on accesses where explicit LOD or non-spatial lookups make it ineffective.

---

# AF32

Core WebGPU does not guarantee native AF32.

If implemented, expose:

```text
AF32 Manual / Experimental
```

Use shader taps along the major texture-footprint axis only on selected 2D surface/projection texture paths.

It is acceptable for this mode to be expensive.

Do not mislabel it as native driver anisotropy.

---

# UI / Control Requirements

The user prioritizes control.

Create compact panels for:

```text
DEPTH
TEMPORAL
XENOVOLUME
COMPOSITOR
AA / FILTERING
PERFORMANCE
```

Preserve Xenofield's compact workspace philosophy.

Do not waste screen area.

Every significant numeric parameter must use the existing validated parameter/range system.

All new controls must persist in project/global presets.

Add meaningful tooltips.

---

# Suggested XenoVolume Controls

At minimum expose:

```text
Enabled
Spatial mode
Volume resolution
Render resolution
Density update rate
Light update rate
Primary steps
Light mode
Light steps
Density
Coverage
Threshold
Scale
Detail
Warp
Cell quantization
Voxel interpolation
Dither type
Dither amount
Dither phase speed
Emission
Absorption
Phase/rim
Colour
Light colour
Environment contribution
Depth clip
Depth softness
Surface shell offset
Shell thickness
Temporal weight
Blend mode
Mask source
```

Keep advanced controls collapsible.

---

# Suggested Temporal Controls

Expose:

```text
Stable/Kinetic mode
History strength
Depth rejection
Luma rejection
Neighbour clamp
Jitter pattern
Jitter scale
Feedback amount
Feedback decay
Feedback hue
Feedback zoom
Feedback rotation
Feedback X/Y
Feedback warp
Feedback blend
```

---

# Suggested AA Controls

Expose independently:

```text
Native MSAA       Off / 4×
SSAA area         1 / 2 / 4 / 8
Temporal samples  1 / 2 / 4 / 8 / 16 / 32
Downsample filter
Texture filter
AF                1 / 2 / 4 / 8 / 16 / Manual32
```

Report actual internal render dimensions.

---

# Performance Rules

Do not optimize blindly.

Instrument first.

Every significant pass gets a timing identity where supported.

Prefer reducing:

1. update frequency;
2. screen resolution;
3. ray count;
4. cache resolution;

before deleting visual features.

A user with spare GPU capacity must be able to raise individual budgets beyond normal defaults.

Avoid hardcoding one notion of an appropriate GPU.

---

# Required Profiling

Expose:

```text
FFT
SceneAux
Scene
Depth Pyramid
Volume Density
Volume Light
Volume Raymarch
Temporal
Depth FX
Distortion
Feedback
Positive Bloom
Dark Bloom
AA Resolve
Display
Total
```

Also expose:

- actual render width/height;
- effective SSAA pixel factor;
- native MSAA;
- temporal sample target;
- volume dimensions;
- volume update cadence;
- ray samples;
- volume framebuffer dimensions;
- approximate allocated texture bytes where calculable.

---

# Validation

Run the existing test suite.

Extend static/WGSL tests for all new bindings, texture formats and pass ownership.

Exercise on a real WebGPU browser if available.

Do not claim hardware performance that was not measured.

Test pathological settings:

- 8× SSAA;
- MSAA4;
- SSAA + MSAA;
- Temporal32;
- AF16;
- manual AF32;
- 16³ through maximum volume cache;
- 4 through 32 ray samples;
- 1-frame and very slow volume cache updates;
- extreme feedback;
- extreme depth thresholds;
- resize while histories are active;
- switching scene mode with histories active;
- device loss/restart.

No stale resource may survive a resize or incompatible quality transition.

---

# Required Presets

Ship useful demonstration presets for at least:

```text
VOXEL SPRAY
ION VEIL
PHASE DUST
CELLULAR STORM
VOID HALO
TEMPORAL CRYSTAL
CHROMATIC SHELL
DENSE NEBULA
IMPOSSIBLE ATMOSPHERE
ABSURD AA
```

Each should demonstrate a genuinely distinct render strategy rather than only changing colours.

---

# Engineering Constraints

Do not:

- restore the old ABYSSAL seabed/ecology renderer;
- rebuild Babylon infrastructure;
- introduce Babylon as a dependency;
- perform CPU FFT readback;
- run large procedural octave stacks per screen pixel;
- run nested light marches by default;
- tie visual quality to physical accuracy;
- make every volume full-resolution;
- allocate new 3D textures every frame;
- retain GPU workload for disabled effects;
- hide WebGPU validation failures;
- claim 16× native MSAA;
- claim 32× native AF;
- turn the new system into one giant shader.

---

# Definition of Done

The release is done only when the user can start from the same spectral surface and, through controls alone, produce radically different visual structures such as:

- dense granular spray;
- soft atmospheric plasma;
- cellular glowing volume;
- dark void matter;
- refractive energy shell;
- noisy particle-like haze;
- crystalline temporal trails;
- depth-stratified colour fields;
- impossible planet atmospheres;

without introducing a full physical simulation for each appearance.

The result should make Xenofield feel less like a particular liquid shader and more like a compact **GPU visual-synthesis laboratory**.

The key test is:

> **Does each additional millisecond of GPU budget buy disproportionate visual richness and controllability?**

If an expensive technique fails that test, replace it with caching, undersampling, temporal reconstruction, compositing or deliberate approximation.