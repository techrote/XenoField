# XENOFIELD V4.4b

Native WebGPU visual synthesis: spectral surfaces, alien planets, imported meshes, cached volumes and controlled feedback.

V4.4b extends the V4.4a Kinetic Compositor with a dedicated, directly rendered procedural-cloud world volume. It preserves the existing FFT, XenoVolume, SceneAux, SkySynth/HDRI, mixer, Noixtur, projections, mesh conditioning, spatial LUT editor, parameter limits and preset system. 

## Run

On Windows, extract the ZIP and run **`0Play.cmd`**. Node.js 20 or newer is needed for the local server; normal use requires no `npm install`. The launcher opens the browser only after the server is listening.

Alternatively:

```sh
npm start
```

Open `http://127.0.0.1:8080/`, then click the render gate. Use a browser with WebGPU enabled. Initialization errors are shown rather than concealed behind a nonworking scene.

**`Xenofield-standalone.html`** contains the same source, styles, worker and D20 asset in one file. The served version is preferred for browser storage and predictable local-origin behaviour. Uncommon EXR variants may invoke the retained optional extended decoder; ordinary scanline EXR and RGBE HDR decoding are local.

## First experiment

Click **KINETIC 4.4b** in the workspace toolbar. Choose **VOXEL SPRAY**, **VOID HALO**, **DENSE NEBULA** or another demonstration, then **LOAD STACK**. All ten demonstrations are also in the main global-preset menu.

The six tabs are **DEPTH**, **TEMPORAL**, **XENOVOLUME**, **COMPOSITOR**, **AA / FILTER** and **PERFORMANCE**. The dock fits its content, can be moved and resized, and separates advanced controls into compact banks. Every new numeric value has direct entry, a slider and the existing `↔` range/safety editor.

**CLEAR HISTORY** invalidates temporal histories without changing the look. **FX OFF** disables the new artistic layers and temporal sampling, but deliberately leaves your independent MSAA/SSAA/filtering choices alone. To return to the lightest scene path, also set MSAA to 1× and SSAA to 1×.

New effects default off. Existing global presets explicitly reset the new modules to neutral defaults rather than inheriting a previous experiment. Submenu locks still apply; a locked module may intentionally prevent a demonstration from loading all its settings.

## Procedural Clouds

Click **CLOUDS** in the workspace toolbar. The panel reproduces the reference cloud controls in their original order and drives a dedicated world-space volume, not a preview. Use **MOVE / SCALE**, axis constraints and **EDIT IN VIEW** to place or resize the volume directly in the 3D scene.

For the supplied video look, load **VIDEO · CELL MEMBRANES**. It captures the extreme state (Density 4, Coverage 1, Scale 5.85, Altitude .58, Detail 0, Ray 16, Light 1, Shadow 20, Sun 20, Height 5, Cache 128, Update 1, Smooth .95) that produces the large hollow cellular sheets and perforated membranes. See [V4.4b Procedural Clouds](docs/V4.4b-PROCEDURAL-CLOUDS.md).

## What is new

| System | Controls and behaviour |
|---|---|
| SceneAux / depth | Single-sample ray depth, world normal and surface energy; min-depth pyramid; depth remapping, bands, quantization, contours, edges and LUT/colour operators. |
| XenoVolume | 16³–96³ caches, separate density/light clocks, cached lighting, generation interpolation, 4–32 primary samples, full through eighth-resolution rays, eight placement modes. |
| Coarse structure | Nearest/trilinear voxels, stochastic dropout, Bayer/blue-noise/hash masks, cell/slice/ray quantization, edge emission and inexpensive 2D microdetail. |
| Temporal | Separate conservative scene, conservative volume and artistic feedback histories. Camera reprojection, rejection and clamping; independent feedback opacity, persistence, decay, gain, hue, drift, zoom, rotation and warp. |
| Compositing | Masked volume interpretations, depth effects, guarded RGB distortion, positive bloom, multiplicative dark bloom and LUT shaping. |
| Quality | Native MSAA 1×/4×; SSAA 1×/2×/4×/8× **pixel area**; temporal targets through 32; four downsampling filters; native AF through 16 and a selected-path manual AF32 experiment. |
| Diagnostics | Eighteen debug choices including Final; pass activity/timestamps where available; actual render dimensions, cache cadence, history age and estimated texture allocation. |

The scene material mask vocabulary grows from 12 to 30 sources. New depth, normal, energy, volume and history signals can participate in the existing mask mix. The compositor uses the same source vocabulary. Current depth is available immediately; scene-material volume/history routing deliberately uses the preceding completed frame to avoid a cyclic render graph.

## Quality is not one preset

An 8× SSAA selection multiplies each internal axis by approximately √8, not by eight. `renderScale` remains independent. The complete pre-display result is downsampled with Box, Bilinear, Catmull–Rom or Lanczos2.

Normal texture budgeting is **768 MiB**, with dimension and pixel-count safeguards. The meter reports the bounded result, not merely the requested setting. This is conservative texture accounting, not a driver VRAM measurement or a guarantee against allocation failure.

**ABSURD AA is explicitly experimental:** MSAA4 + SSAA8 + Temporal32 + manual AF32, with a 4 GiB texture budget. Do not use it as a default. Native 8×/16× MSAA and native AF32 are not advertised.

## Presets and project data

The six new module banks join the existing fourteen panels. Each new bank contains Default plus the ten demonstration configurations. Global and project saves include the new values, user presets and locks. V4.3b state is migrated from its previous browser key; the ten palette arrays are preserved. Export a project before clearing browser storage or moving between browser origins.

The demonstrations are VOXEL SPRAY, ION VEIL, PHASE DUST, CELLULAR STORM, VOID HALO, TEMPORAL CRYSTAL, CHROMATIC SHELL, DENSE NEBULA, IMPOSSIBLE ATMOSPHERE and ABSURD AA. Their differences include cache placement, sampling, lighting, compositing and feedback—not just palette swaps.

## Validation and engineering notes

See **[V4.4b validation](docs/V4.4b-VALIDATION.md)** for the exact regression counts and proof boundary. The retained V4.4a validation documents the earlier software-rendered Kinetic baseline; this environment could only provide Dawn null-backend command validation for the V4.4b cloud additions, so no new hardware/browser frame-rate claim is made.

**[Architecture and ownership](docs/V4.4a-ARCHITECTURE.md)** explains the graph, resource transitions, approximations and mask timing. **[Acceptance matrix](docs/V4.4a-ACCEPTANCE.md)** maps the supplied plan to code and evidence. Historical release notes remain in `docs/`; the old main README is archived rather than used as current documentation.

```sh
npm test                  # Node tests and static contracts
npm run build:standalone  # regenerate the single-file version
```

Optional validation tools are documented in `docs/VALIDATION.md`. Native Dawn and browser automation binaries are not runtime dependencies and are not included in the release.
