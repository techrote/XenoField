# XENOFIELD V4.4a — KINETIC COMPOSITOR
## Implementation Plan

## 0. Objective

Evolve Xenofield from a predominantly direct:

`environment → spectral surface → HDR display`

renderer into a controllable visual-synthesis pipeline optimized for:

**maximum visible complexity per millisecond of GPU work.**

Physical correctness is explicitly not a governing constraint.

The system should support alien liquids, planetary surfaces, fields, energy structures, synthetic atmospheres, volumetric spray, void effects, luminous matter and deliberately impossible visual kinetics.

Prioritize:

1. control;
2. visual complexity;
3. compositional flexibility;
4. GPU efficiency;
5. temporal stability when desired;
6. graceful deliberate instability when desired;
7. physical realism only when it happens to be useful.

Do not restore the old ABYSSAL underwater/world renderer.

Retain the current native WebGPU Xenofield architecture, spectral FFT, SkySynth/HDRI environment system, projection system, masks, LUTs, presets and current UI model.

---

# 1. New Frame Architecture

Converge on:

```text
ENVIRONMENT / COMPUTE
    SkySynth / HDRI
    spectral FFT
    low-frequency procedural resources

SCENE PREPASS
    linear depth
    normal / facing
    surface field mask
    optional motion

SCENE HDR
    sky
    liquid / planet / imported mesh
    optional native MSAA resolve

DEPTH PYRAMID
    linear-depth reductions
    edge / silhouette proxies

XENOVOLUME UPDATE
    coarse 3D density
    cached lighting
    structural channels
    occupancy / mip data
    ping-pong interpolation

LOW-RES KINETIC PASSES
    sparse XenoVolume raymarch
    depth effects
    vector distortion
    optional screen-space field generation

TEMPORAL RESOLVE
    reprojection
    stochastic reconstruction
    history clamp/rejection
    optional deliberate feedback

COMPOSITOR
    volume
    signed bloom
    depth contours
    refraction
    chromatic shear
    trails
    masks / LUTs / blend modes

SPATIAL AA / RESOLVE
    SSAA downsample if enabled

HDR DISPLAY
    exposure
    contrast
    output shaping
    final sharpen
```

All added effects must be individually optional.

Disabled effects must not continue consuming their normal GPU workload.

---

# 2. SceneAux — Lightweight Reusable Surface Data

The current renderer already generates scene depth. Promote depth and a small set of reusable signals to first-class compositing inputs.

Implement `SceneAuxGPU`.

Preferred outputs:

```text
LinearDepth
SurfaceAux
optional Velocity
```

### LinearDepth

Single-sampled linear camera/view distance.

It must remain available even when scene MSAA is enabled.

Recommended implementation:

- add a cheap single-sample geometry prepass;
- no full material shading;
- write linear depth;
- sky = clear/far value.

The scene currently contains at most one principal liquid/planet/mesh object, so the additional geometry submission is acceptable.

### SurfaceAux

Pack useful artistic data rather than a conventional G-buffer.

Candidate channels:

```text
R/G = octahedral normal or projected normal
B   = existing energy / crest / pattern intensity
A   = surface mask / geometry ID / user field
```

Alternative higher-quality format may expose normal XYZ + scalar field.

Do not create a large deferred renderer.

### Velocity

Optional.

Start with camera-reprojection support.

Add explicit object/spectral motion vectors only if profiling and visual tests show them to materially improve temporal quality.

Do not delay the main system waiting for perfect physical motion vectors.

---

# 3. Depth as a Control Source

Depth is not merely for occlusion.

Add reusable derived sources:

```text
linear-depth
inverse-depth
depth-band
depth-sine
depth-quantized
depth-edge
depth-gradient
silhouette-distance
normal-facing
normal-edge
surface-energy
```

Make these available to the existing Xenofield mask/router system.

Any effect that currently accepts a mask should be able to accept these sources where sensible.

Add controls for:

- near;
- far;
- curve/gamma;
- inversion;
- quantization steps;
- band width;
- band phase;
- band drift;
- edge radius;
- edge contrast;
- soft/hard threshold.

Depth must be debug-viewable.

---

# 4. Depth Pyramid / Mini-HZB

Build a small linear-depth mip pyramid.

This is not primarily for world-object culling.

Use it as a cheap multi-scale image-analysis structure for:

- large silhouette extraction;
- depth-aware blur;
- contour width selection;
- volumetric early clipping;
- coarse occlusion;
- depth-dependent distortion;
- negative bloom masks;
- adaptive effect radius.

Use max/min reduction variants only where required.

Do not implement a large ABYSSAL-style visibility system around it.

---

# 5. Temporal Reconstruction Core

Implement one shared `TemporalFieldGPU` rather than bespoke histories for every effect.

It should support:

```text
current effect texture
previous effect texture
current linear depth
previous linear depth
previous/current camera transform
optional velocity
```

Core controls:

- history weight;
- depth rejection;
- neighbourhood clamp;
- disocclusion threshold;
- luminance rejection;
- responsiveness;
- camera-cut reset;
- resize reset;
- scene-mode reset.

Support two operating philosophies.

## Stable

Conservative history.

Reject mismatched depth and large change.

Use for:

- antialiasing;
- volumetric reconstruction;
- clean screen-space effects.

## Kinetic

Deliberately permissive/artistic history.

Expose:

- persistence;
- decay;
- colour rotation;
- brightness decay/gain;
- spatial warp;
- feedback scale;
- feedback rotation;
- directional smear;
- difference feedback;
- max/min feedback;
- additive feedback.

This turns the temporal buffer into a visual instrument instead of only an antialiasing mechanism.

---

# 6. Temporal / Stochastic Sampling

Implement deterministic per-frame jitter sequences.

Support:

- interleaved gradient noise;
- blue-noise texture;
- 2×2 checker phases;
- 4×4 phases;
- Halton-style subpixel jitter;
- user-selectable fixed/randomized phase.

Use these for:

- sparse volume marching;
- depth effects;
- supersampling;
- reflection/refraction jitter;
- threshold dithering.

Allow controlled temporal phase speed.

Do not evaluate all samples in every frame if history can reconstruct them.

---

# 7. XenoVolumeGPU

Create a general-purpose coarse 3D artistic field.

This is derived conceptually from the procedural-clouds cached-volume architecture but is not constrained to clouds.

## Density storage

Start with quality-scaled dimensions:

```text
16³
24³
32³
48³
64³
96³ experimental
```

Default should probably be 32³ or 48³.

Probe compact formats.

Preferred compact cache:

```text
RGBA8Unorm
```

when storage/filtering capabilities permit.

Fallback:

```text
RGBA16Float
```

Suggested channels:

```text
R = density
G = cached illumination / transmittance
B = structural / edge / phase field
A = emission / secondary density / user field
```

Do not allocate RGBA16F merely to store a single scalar as the reference implementation currently does.

---

# 8. XenoVolume Generation

Reuse the useful concept from procedural-clouds:

```text
expensive procedural evaluation
        ↓
coarse GPU 3D cache
        ↓
cheap repeated sampling
```

Density generation may combine:

- Perlin;
- billow;
- ridged noise;
- Voronoi;
- cellular distance;
- SkyNoixture;
- existing Xenofield pattern fields;
- projection coordinates;
- spectral state proxies;
- imported masks;
- depth;
- deterministic hash fields.

Because this is an artistic renderer, permit mathematically aggressive operations:

- quantization;
- folding;
- absolute difference;
- XOR-like threshold combinations;
- stepped domains;
- coordinate reflection;
- polar distortion;
- cell snapping;
- phase offsets;
- discontinuous warps.

Expose generator blend modes.

---

# 9. Multi-Rate Volume Updates

Separate:

```text
display FPS
volume density FPS
volume light FPS
temporal reconstruction FPS
```

Example operating regime:

```text
Display          60 Hz
Volume density   10–30 Hz
Volume lighting   5–20 Hz
Temporal resolve 60 Hz
```

Ping-pong between volume generations.

Interpolate cache generations to prevent unwanted popping.

Also provide a deliberate stepped/no-interpolation mode.

This is an aesthetic option, not merely a fallback.

---

# 10. Cached Volumetric Lighting

Do not make the default renderer run a secondary light march at every occupied primary-ray step.

Instead:

1. generate density;
2. run a cheap second compute pass;
3. estimate lighting/transmittance at each voxel;
4. store it in the volume.

Candidate methods:

### Fast Gradient

Estimate local gradient / density normal.

Use directional light dot gradient plus ambient.

### Short Cached March

For each voxel, sample 3–6 points toward the active light.

This is cheap at 24³–64³ and occurs only on volume updates.

### Mip Shadow

Build density mips and sample progressively coarser levels along the light direction.

Use few samples but capture large-scale structure.

### Live March

Retain nested screen-space light marching as an Experimental mode only.

Controls:

- light method;
- cache light steps;
- attenuation;
- forward/back scattering;
- rim;
- phase bias;
- ambient;
- environment tint;
- emission response.

Physical correctness is unnecessary.

---

# 11. XenoVolume Raymarch

Render the volume into a separate low-resolution HDR target.

Resolution choices:

```text
1×
1/2
1/3
1/4
1/6
1/8
```

Recommended default:

`1/4`.

Primary-ray steps:

```text
4
6
8
12
16
24
32
```

Use:

- ray-entry jitter;
- early zero-density rejection;
- early transmittance exit;
- scene-depth clipping;
- coarse box/sphere/shell intersection;
- distance-scaled steps;
- temporal reconstruction.

Do not equate volume resolution with display resolution.

---

# 12. Coarse-Voxel / Dither Aesthetic

Make undersampling controllable rather than hiding it.

Add:

- voxel quantization;
- slice quantization;
- cell threshold;
- stochastic cell dropout;
- coarse Bayer mask;
- blue-noise mask;
- voxel jitter;
- ray-step jitter;
- cell-edge emphasis;
- nearest/trilinear voxel interpolation;
- density posterization;
- density inversion;
- phase stepping.

This should allow one 24³ volume to look like:

- aerosol;
- granular spray;
- plasma;
- particle clouds;
- crystal dust;
- energy lattice;
- void fragmentation;
- luminous cellular matter.

---

# 13. Cheap Microdetail Injection

Avoid increasing 3D cache resolution merely to obtain fine structure.

Combine coarse 3D density with inexpensive high-frequency information at composition time.

Sources:

- existing relief atlas;
- SkyNoixture;
- projected 2D noise;
- blue noise;
- depth gradients;
- screen-coordinate hash;
- spectral pattern values.

Example:

```text
coarse 3D body
×
cheap projected 2D microstructure
+
thresholded emissive flecks
```

Expose microdetail strength separately.

---

# 14. XenoVolume Spatial Modes

Volume placement must be user-selectable.

Implement:

```text
World Box
Camera Slab
Surface Shell
Planet Shell
Mesh Local Box
Mesh Normal Shell
Screen Extrusion
Infinite Tiled Field
```

The same renderer should therefore produce both atmospheric volumes and tightly surface-coupled spray/energy.

For surface/mesh shells, use SceneAux/depth rather than rebuilding physically accurate ocean aerosol placement.

---

# 15. Volume Output Channels

Do not restrict the volume to conventional alpha-over smoke.

Output at least:

```text
radiance
transmittance
scalar density
vector distortion or derivable gradient
```

Use the result as input to compositing.

Supported interpretations:

- additive emission;
- alpha veil;
- multiplication;
- screen;
- difference;
- dark absorption;
- refractive displacement;
- chromatic displacement;
- LUT index modulation;
- bloom source;
- mask source.

---

# 16. Screen-Space Kinetic Compositor

Create `KineticCompositorGPU`.

It consumes:

```text
scene HDR
depth
SceneAux
XenoVolume
temporal history
environment
masks
```

Keep it modular, but do not recreate the giant ABYSSAL graphics registry.

Recommended layers:

1. depth shaping;
2. volume;
3. vector distortion/refraction;
4. temporal feedback;
5. signed bloom;
6. colour/LUT shaping;
7. output AA/resolve.

Each layer:

- Off / On;
- optional resolution scale;
- mask source;
- blend mode;
- strength;
- profiler timing.

---

# 17. Screen-Space Refraction / Field Distortion

Add a cheap displacement pass.

Distortion vectors may come from:

- SurfaceAux normal;
- depth gradient;
- XenoVolume gradient;
- procedural field;
- previous-frame difference;
- SkyNoixture;
- projection map.

Controls:

- strength;
- radius;
- scale;
- chromatic separation;
- R/G/B offsets;
- depth scaling;
- threshold;
- direction bias;
- temporal persistence.

Allow physically impossible behaviour.

Examples:

- reverse refraction;
- depth-inverted refraction;
- discontinuous lensing;
- phase shear;
- radial tearing;
- chromatic field splitting.

---

# 18. Signed Bloom

Implement both positive and negative bloom.

## Positive

Standard luminous spread.

Sources:

- HDR threshold;
- emission;
- XenoVolume;
- crest field;
- depth edge;
- masks.

## Negative / Dark Bloom

Create a dark mask, blur it at reduced resolution, then multiplicatively composite it.

Use it for:

- void halos;
- deep silhouette absorption;
- dark corona;
- energy-field occlusion;
- inverted glow.

Controls must be independent:

```text
positive amount/radius/threshold
negative amount/radius/threshold
```

Also expose a selective mask for each.

---

# 19. Depth-Kinetic Effects

Add a compact set of inexpensive depth-driven image operators:

- depth LUT;
- colour by depth;
- depth posterization;
- moving depth bands;
- contour lines;
- depth edge glow;
- depth edge darkening;
- depth-dependent desaturation;
- depth-dependent hue rotation;
- distance chromatic split;
- depth inversion mask;
- depth fog using arbitrary blend modes;
- depth-driven pixel displacement.

All should accept the general mask router.

---

# 20. History Feedback Effects

Expose previous-frame HDR as an optional compositor source.

Modes:

```text
Mix
Add
Screen
Multiply
Difference
Lighten
Darken
Max
Min
Feedback warp
```

Controls:

- decay;
- gain;
- hue drift;
- zoom;
- rotation;
- XY drift;
- depth rejection;
- mask;
- luma threshold.

This must be independent from the conservative TAA/history path so users can deliberately create long-lived trails without breaking functional temporal AA.

---

# 21. Anti-Aliasing Architecture

Do not advertise unsupported native modes.

## Native MSAA

WebGPU core:

```text
Off
4×
```

Implement proper multisampled HDR colour/depth targets plus resolve.

Because depth compositing needs a stable single-sampled depth source, retain SceneAux/linear depth separately.

## SSAA

Add pixel-area supersampling:

```text
1×
2×
4×
8×
```

Interpret these as total pixel/sample area factors, not per-axis multipliers.

Approximate linear dimension multipliers:

```text
1× → 1.000
2× → 1.414
4× → 2.000
8× → 2.828
```

Render the complete pre-display image at that resolution and downsample.

Downsample options:

- Box;
- Bilinear;
- Catmull-Rom;
- Lanczos2 if sufficiently efficient.

Separate SSAA from the existing generic renderScale.

Extreme modes may exceed the current 3.7-megapixel cap; replace that fixed cap with a configurable bounded high-quality budget.

Never exceed `device.limits.maxTextureDimension2D`.

## Temporal Supersampling

Add:

```text
Off
2
4
8
16
32 samples
```

Use subpixel camera jitter + TemporalFieldGPU accumulation.

This is expected to be particularly valuable for:

- procedural shading;
- volume dithering;
- fine projected patterns;
- reflection shimmer;
- screen-space effects.

## Hybrid

Allow legal combinations:

```text
MSAA4 + Temporal8
SSAA4 + Temporal8
MSAA4 + SSAA2/4 + Temporal
```

Do not automatically enable pathological combinations.

Provide an explicit `ABSURD`/experimental preset if desired.

---

# 22. Texture Filtering

Create centralized sampler presets.

Modes:

```text
Nearest
Bilinear
Trilinear
Trilinear + AF2
AF4
AF8
AF16
```

For anisotropic modes:

```text
magFilter: linear
minFilter: linear
mipmapFilter: linear
```

Apply anisotropy only to texture paths where it can materially improve an oblique texture footprint.

Do not indiscriminately apply it to every lookup.

Especially evaluate:

- relief/detail atlas;
- projected texture coordinates;
- imported surface maps;
- procedural projection sources.

Environment sampling currently using explicit LOD should retain intentional explicit LOD behaviour.

---

# 23. Experimental Manual AF32

Native WebGPU AF32 cannot be assumed.

If an AF32 option is implemented, label it clearly:

`AF32 — manual experimental`

Implement as an optional shader sampling footprint for selected 2D surface textures.

Do not call it native AF.

It may use:

- major-axis derivative;
- multiple taps distributed along the footprint;
- explicit mip selection;
- weighted accumulation.

Only execute those taps when AF32 is selected.

Never use this expensive path for every environment/volume lookup.

---

# 24. Existing Mask System Integration

Extend Xenofield's mask vocabulary rather than building isolated controls.

New candidate mask sources:

```text
scene-depth
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
history-luma
history-difference
feedback
screen-velocity
```

Allow the existing mask mixing modes to combine them with:

- SkySynth;
- HDRI;
- Noixtur;
- Perlin;
- billow;
- ridge;
- radial;
- projection masks.

This is one of the most important control deliverables.

---

# 25. Preset Families

Add modular presets that demonstrate the system rather than hiding it.

Examples:

### Voxel Spray
24³–32³ volume, coarse stochastic cells, strong temporal accumulation.

### Ion Veil
Smooth low-res volume, depth clipping, emission and refraction.

### Phase Dust
Thresholded sparse density, chromatic field displacement.

### Cellular Storm
Voronoi volume + signed bloom + temporal feedback.

### Void Halo
Negative volume contribution + dark bloom + depth silhouette.

### Temporal Crystal
Low ray count + strong jitter + long kinetic feedback.

### Chromatic Shell
Planet/surface shell, RGB-separated distortion.

### Dense Nebula
48³/64³, cached lighting, 1/4-resolution volume, strong temporal reconstruction.

### Impossible Atmosphere
Depth bands + volume + feedback + LUT cycling.

---

# 26. Performance Philosophy

Do not optimize by deleting visual options.

Optimize by moving expensive work:

```text
per-pixel
→ low resolution
→ cached
→ multi-rate
→ temporal
→ sparse
```

Order of preferred optimization:

1. cached procedural data;
2. reduced screen resolution;
3. lower update frequency;
4. sparse sampling;
5. stochastic reconstruction;
6. early rejection;
7. compact texture formats;
8. cheap screen-space detail;
9. reduce visual complexity only last.

---

# 27. Quality Controls

Do not force art direction through Low/High/Ultra.

Expose independent budgets:

```text
Volume resolution
Volume update rate
Volume render scale
Volume ray steps
Cached-light quality
Depth pyramid depth
Temporal history quality
SSAA
MSAA
Temporal AA
Texture AF
Bloom resolution
Feedback resolution
```

Global quality presets should merely populate these settings.

The user must remain able to override every one.

---

# 28. Profiling

Add explicit GPU timings where timestamp queries are available:

```text
SceneAux
Spectral FFT
Scene HDR
Depth Pyramid
Volume Density
Volume Lighting
Volume Raymarch
Temporal Resolve
Depth Composite
Distortion
Feedback
Signed Bloom
AA Resolve
Display
Total
```

Also report:

```text
render dimensions
SSAA pixel factor
MSAA sample count
volume dimensions
volume render dimensions
volume update interval
ray steps
history dimensions
HDR bytes estimate
volume bytes estimate
```

Never report estimated millisecond claims as measured results.

---

# 29. Debug Views

Provide direct views for:

```text
Final
Linear Depth
Depth Pyramid level
SurfaceAux
Surface Normal
Surface Energy
Volume Density
Volume Cached Light
Volume Structural Channel
Raw Volume Raymarch
Temporal History
History Rejection
Feedback
Positive Bloom Mask
Negative Bloom Mask
Distortion Vector
Mask Router Output
```

Debug views are part of the control system, not optional developer polish.

---

# 30. Failure Behaviour

All new systems must fail open.

If volume shaders fail:

- disable XenoVolume;
- retain scene renderer.

If temporal shaders fail:

- use current-frame effects only.

If depth pyramid fails:

- use full-resolution depth.

If MSAA setup fails:

- fall back to 1×.

If a compact volume format is unsupported:

- use the validated fallback.

Never let one experimental pipeline poison later command buffers.

---

# 31. Validation

Validate:

- liquid mode;
- planet mode;
- field mode;
- imported mesh mode;
- SkySynth;
- HDRI;
- mixer;
- all projection modes;
- depth compositing;
- temporal reset;
- camera movement;
- resize;
- device loss;
- MSAA4;
- every SSAA factor;
- temporal AA;
- AF sampler modes;
- XenoVolume resolutions;
- every volume spatial mode;
- cache interpolation;
- volume update-rate extremes;
- history feedback.

Specifically test:

- no stale temporal history after mode changes;
- no volume leaks through foreground depth;
- no NaNs from extreme user parameters;
- no unbounded GPU allocation;
- no volume resource recreation every frame;
- no accidental nested light march in default modes;
- disabled passes genuinely stop consuming normal workload.

---

# 32. Acceptance Criteria

V4.4a is complete when:

1. Scene depth is a reusable first-class compositing input.
2. Depth can drive masks, bands, edges, colour and distortion.
3. A lightweight SurfaceAux buffer exists.
4. Low-resolution effects can be temporally reconstructed.
5. Stable and intentionally kinetic temporal modes are distinct.
6. A coarse cached XenoVolume can create convincing high-complexity 3D effects.
7. XenoVolume works acceptably at 24³–48³.
8. Sparse stochastic raymarching produces useful output with low step counts.
9. Volume lighting is cached by default rather than nested per-pixel.
10. Volume rendering can be clipped by scene depth.
11. Volume placement supports world, surface, planet and mesh-relative modes.
12. Coarse voxel structure can be exposed intentionally.
13. Cheap 2D microdetail can augment coarse 3D fields.
14. Signed positive/dark bloom exists.
15. Screen-space distortion/refraction is maskable and depth-aware.
16. Temporal feedback is a controllable visual layer.
17. New depth/volume/history sources integrate with the existing mask system.
18. Native 4× MSAA works where supported.
19. SSAA up to 8× pixel-area is available subject to device/resource limits.
20. Temporal supersampling up to 32 history samples is available.
21. Trilinear filtering and AF up to native 16× are available.
22. Any AF32 implementation is explicitly manual/experimental.
23. Every new major pass has a debug surface and profiler identity.
24. Optional effects fail open.
25. Xenofield remains recognizably the compact native WebGPU renderer rather than reverting to the old ABYSSAL world renderer.
26. The release demonstrates substantially more visual variation and controllability without requiring full-resolution physically based volumetrics.