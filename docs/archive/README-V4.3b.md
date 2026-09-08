# ABYSSAL · XENOFIELD 4.3b

## V4.3b LUT spatial editor

The LUT window is now a 16×16 spatial editor over the existing 256-entry palette. It adds rectangular and modifier-assisted multi-area selection, shape-preserving copy/cut/paste, undo/redo, row/column/invert selection, transforms, direct hex editing, dual-colour picking, fill, directional/radial gradients, and pixel/round/square/diamond/irregular painting brushes. Clipboard regions preserve width, height and selection mask so they can be pasted into equivalent areas of the same or another LUT slot.

The renderer, mesh/projection system and supplied D20 from V4.3a-r1 are retained. Existing V4.3a browser state migrates into the V4.3b storage key without changing the ten palette arrays.

## Previous V4.3a-r1 renderer / standalone hotfix

This hotfix repairs the first V4.3a mesh/projection release without changing the projection feature set or supplied D20 asset.

- Fixed two invalid WGSL immutable assignments in the projected-mesh shader (`triplanar w` and `foamMask`).
- The standalone now launches its already-bundled environment worker as a **classic Blob worker**, avoiding `file://` module-worker cross-origin rejection in Chrome/Firefox.
- The SkySynth preview canvas is not bound to WebGPU until shader/pipeline validation has succeeded, so a renderer-init failure no longer leaves the CPU fallback preview black.
- Mesh/projection shader compilation is isolated from the core sky/liquid renderer. A future mesh-only shader error can disable mesh/planet rendering without collapsing liquid/field rendering into the CPU environment fallback.
- Added static regression checks for WGSL `let` reassignment and standalone worker mode.

## V4.2e preset / modular-lock / pinned-workspace pass

V4.2e is focused on preserving the strongest visual direction and making global preset experimentation non-destructive.

- **ION ORCHARD is preserved unchanged** as the primary visual reference.
- **8 FIELD SCAN is preserved unchanged** as the abstract-field reference.
- **PHASE DIFFERENCE** receives only a restrained surface/output tune.
- The remaining global worlds are substantially rebuilt as high-contrast Ion-Orchard derivatives: dark reflective bodies, stronger ridge/normal structure, lower bloom/exposure, coloured emissive seams and less white washout.
- LUT banks now expose all ten shipped palettes to the modular global-preset system.

### Modular global-preset locks

Parameter submenus have independent **OFF / LOCK** controls. A locked submenu ignores global preset loads while remaining fully editable by the user and by explicit panel-preset loads.

The three visual windows — **SkySynth**, **Surface**, and **LUT** — also have a three-state panel-global override:

- **G:NONE** — honour the individual submenu locks.
- **G:LOCK** — protect every submenu belonging to that visual panel during global loads.
- **G:UNLOCK** — temporarily override all its submenu locks and allow the global stack through.

Changing the panel-global state never changes the saved submenu lock states. Lock state is persistent in exported/project/browser state.

### Pinned workspace changes

- SkySynth preview is now outside the scroll region and remains visible at the top of the SkySynth window. Preset/source/synthesis controls scroll beneath it.
- The performance profiler is pinned to the top of the Surface → Output tab.
- Range tracks use a light-grey indicator area with a hollow white circular handle.

The V4.2d frame-pacing, 30720×17280 EXR, 2.6 GiB file cap and sparse GPU timestamp profiler work remains intact.


Alien-liquid, liquid-planet and abstract energy-field renderer with a shared HDR environment.

V4.2a is a **UI/preset/HDRI reliability refactor**. The renderer remains the V4.1b visual core, but authoring is reorganised into smaller functional panels with independent preset banks. Global worlds are now stacks of panel-preset names rather than giant flat parameter snapshots.

## Run

On Windows run **`0Play.cmd`** or **`start-v4.cmd`**. Node.js 20+ is required; no npm install is required for normal runtime.

```sh
npm start
```

Open `http://127.0.0.1:8080/`.

`Xenofield-standalone.html` embeds the local app modules, worker and styles. The served build is still preferred for browser storage and worker behaviour.

## Cleaner panel model

The interface is split into fourteen independently presettable functional panels:

- **SkySynth** — plasma environment generation, reconstruction and environment transport.
- **Modulator** — transient modulation.
- **SkyMixer** — SkySynth/HDRI compositing.
- **SkyNoixture** — procedural texture overlays.
- **Mask** — live mask source mixing, shaping and routing.
- **Liquid** — liquid wave dynamics.
- **Reflection** — body/reflection/pseudo-Fresnel controls.
- **Pattern** — relief, energy seams and foam.
- **Atmosphere** — draw distance, cloud layer and fog.
- **Lighting** — ambient, emissive and spot-light controls.
- **Geometry** — mesh source, conditioning, retessellation and spike handling.
- **Projection** — mapping family, transforms, A/B blending and per-layer routing.
- **Output** — scene mode, HDR display, mesh/render quality and sharpening/glow.
- **LUT** — active palette, complete 256-colour snapshot and spatial palette editor.

Each panel has a compact **PRESET → LOAD / SAVE / DELETE** row. Built-in names are read-only; user presets persist in browser/project state.

The Surface window is seven titlebar tabs — **Motion / Mesh / Material / Surface / Atmos / Light / Output** — instead of one large scrolling control wall. SkyMixer, SkyNoixture, Mask and Modulator remain focused SkySynth sidepanels.

## Global preset stacks

A global preset contains only the names of the fourteen functional panel presets it loads. This keeps combinations understandable and makes it possible to swap one subsystem without destroying the rest of the look.

Saving a global while a panel is `Custom` automatically captures that panel into a named user panel preset, then stores the resulting list of panel-preset names.

Twelve built-in global demonstrations are supplied:

1. **0 BALANCED OCEAN** — cryogenic Ion derivative with darker troughs and stronger lattice detail.
2. **ION ORCHARD** — preserved exactly as the primary high-contrast reference.
3. **VENT PARTICULATE** — petroleum/turbulent-ridge Ion derivative.
4. **3 HERO OCEAN** — higher-detail Ion filament showcase.
5. **4 BIOLUME PLATE** — dark magnetar/bioluminescent Ion derivative.
6. **5 WEATHER ENGINE** — copper storm derivative with structured weather rather than white haze.
7. **6 ECONOMY INTERACTIVE** — lower-cost Ion derivative retaining useful contrast.
8. **7 PLANETARY ORBIT** — cryogenic Ion-derived liquid planet.
9. **8 FIELD SCAN** — preserved exactly as the abstract-field reference.
10. **HDRI SYNTH FUSION** — Ion-derived HDRI mixer stack that still reads strongly before an HDRI is loaded.
11. **10 SOFT LIGHT MIX** — opaline Ion derivative prepared for soft-light HDRI compositing.
12. **PHASE DIFFERENCE** — existing contrast experiment with a modest filament/output tune.


The panel banks themselves contain **102 curated subsystem presets** across the fourteen panels, so the global worlds are starting points rather than fixed monolithic looks.

## HDRI / EXR reliability changes

HDRI imports no longer wait behind the continuously running SkySynth worker queue. File decode and publication take their own direct path; a failed import keeps the last valid environment intact.

Supported environment inputs:

- Radiance `.hdr` / `.rgbe` — local decoder.
- OpenEXR `.exr` — common scanline **NONE, RLE, ZIPS and ZIP** files decode locally in the standalone build.
- PIZ/PXR24 EXR — optional extended `hdrify` fallback when network access is available.
- PNG / JPEG / WebP equirectangular panoramas — browser image decoder, converted to linear RGB.

A local uncompressed EXR fixture is included and exercised by both Node and browser-component validation.

The SkySynth source card explicitly reports `SKYSYNTH ACTIVE`, `HDRI ACTIVE`, or mixer/HDRI-waiting state.

## Advanced parameters

Every numerical effect still provides direct numeric input, a slider and an **↔** advanced editor containing:

- effect information / tooltip text,
- slider-window min/max,
- editable active Hard Safety Caps inside immutable engineering bounds,
- user-recorded Functional Extremums which are reference metadata only.

## Persistence

Browser/project state stores:

- renderer settings,
- slider ranges and active safety caps,
- Functional Extremums,
- UI preferences,
- all ten LUTs,
- user panel presets,
- current panel preset selections,
- user global stacks and the active global name.

Panorama pixels are stored separately in IndexedDB when available; project JSON stores the asset name rather than embedding large images.

## Validation scope

The packaged V4.3b source is tested with Node unit/structural tests plus a bounded Chromium DOM/component pass. The browser pass exercises the LUT selection/clipboard/undo/gradient/brush workflow, local EXR import, modular locks and embedded standalone worker.

The validation host does not expose a usable WebGPU adapter, so browser UI/HDRI tests do **not** certify final liquid image quality or GPU performance.


## Supplied D20 showcase asset

`Weather Engine` now uses the exact supplied `D20(2).stl`, packaged as `assets/D20-showcase.stl` (23,720 source triangles). The standalone build embeds the same STL bytes so the preset works without a separate asset file. The D20 conditioning preset preserves its engraved/bevel geometry and hard edges by default; retessellation remains available as an explicit geometry option.
