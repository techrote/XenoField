# XENOFIELD V4.4a — validation report

## Result and scope

Implemented in the supplied V4.3b workspace. The release includes the modular renderer, six control banks, ten demonstration stacks, the standalone build, source, tests and evidence.

The final native integration run completed **219 cases with no uncaptured WebGPU errors or per-case validation errors**. All new owners initialized successfully. This is real Dawn pipeline/command/resource validation and software Vulkan rendering; the browser presentation canvas is replaced with a native offscreen texture. It is **not a hardware performance benchmark or an end-to-end browser WebGPU certification**.

| Validation layer | Final result | Evidence |
|---|---:|---|
| Node unit/regression tests | **288 passed**, zero failed/skipped | `validation/v4.4a/automated-tests.log` |
| Static source/schema/resource contracts | **2,466 passed** | Same log, final line |
| Native WebGPU integration cases | **219 passed**, zero recorded GPU errors | `validation/v4.4a/native-webgpu.json` and `.log` |
| Browser DOM/component/worker checks | **59 passed**, one local-file launch check explicitly skipped | `validation/v4.4a/ui-component-checks.json` |
| Local HTTP delivery checks | **11 passed** | `validation/v4.4a/http-smoke.json` |
| Demonstration frame readbacks | **10 distinct finite outputs** | Ten `demo-*.png` files and native JSON statistics |

Static contracts are not shader compilation tests. UI tests are not GPU rendering tests. Native cases are a bounded feature matrix and targeted interactions, not the Cartesian product of every parameter combination.

## Executed environment

The native run began **2026-09-06 23:31:21 UTC** and completed **23:37:53 UTC**. It used the official Dawn Node binding v0.6.0, Vulkan backend, with adapter **Google SwiftShader**, architecture `swiftshader`, description `SwiftShader driver 5.0.0`.

Node.js was **22.16.0**. Component checks used Python **3.13.5**, Playwright and Chromium **144.0.7559.96**. The native device was not given an enlarged sampled-texture limit: the new ray path fits the core default **16 sampled textures per shader stage**. The external native addon and browser binaries are not packaged or required to run the application.

The app's timestamp-query paths executed where supported. Raw JSON includes software timing samples for diagnostics, but no target-hardware frame-rate, millisecond budget or speedup claim is derived from them. Stale timing samples may remain in low-level instrumentation; the new performance dock separately marks pass activity so disabled work is displayed as idle rather than counted as current execution.

## Native test coverage

The suite builds the actual renderer and submits its real command buffers. Only presentation is offscreen. It exercises liquid, field, planet and mesh modes, a newly imported OBJ, the embedded D20 asset, local EXR decoding/upload, SkySynth, HDRI, mixer and Noixtur participation.

| Area | Executed selections / interactions |
|---|---|
| Volume cache | 16³, 24³, 32³, 48³, 64³, 96³; RGBA8 path and forced RGBA16Float fallback |
| Sparse sampling | 4, 6, 8, 12, 16, 24, 32 rays; full, half, third, quarter, sixth, eighth resolution |
| Lighting | Gradient, cached short march, mip shadow, unlit and explicitly experimental live march |
| Placement | World box, camera slab, surface shell, planet shell, mesh-local box, mesh-normal shell, screen extrusion and finite-range tiled field |
| Generation | All ten generator choices, six shape choices and five generator blends; a spectral volume in field mode demands live FFT, while a non-spectral field stops it |
| Dither / interpretation | All five dither choices and nine volume blend interpretations |
| Projection / routing | All twenty shared surface/cache projection choices and all eighteen added scene/cache mask sources |
| Temporal | Off / 2 / 4 / 8 / 16 / 32 targets; seven feedback blends; independent histories; extreme feedback; camera cut, scene/geometry changes and active-history resize |
| Compositing | Eleven depth operators; eight distortion sources; independent positive/dark bloom; colour and mask routing; all eighteen debug choices including Final |
| Spatial quality | Native MSAA4; SSAA2/8 and hybrid interactions; four reconstruction filters; eight texture-filter choices including native AF16 and manual AF32 |
| Cadence / resources | Very slow density/light clocks, per-frame density, edits bypassing cadence, retained 3D cache identities, cache/target quality transitions and all-off bypass |
| Failure paths | Volume/pyramid/temporal owner unavailability, isolated shader failure followed by valid rendering, MSAA fallback and controlled device destruction followed by fresh initialization |

Pure unit tests also sweep 160 combinations of dimensions, device limits, memory bounds and supersampling settings, including every SSAA area factor. Selecting a high budget does not silently imply that its requested dimensions were allocated: the diagnostics report the bounded result.

### Pixel-level assertions, not just successful submission

**Depth pyramid:** 7,662 reduced texels matched a CPU reference reduction, including odd 193×121 source dimensions. This checks that edge rows and columns participate.

**Depth clipping:** 753 occupied volume pixels passed the scene-depth clipping contract. This establishes the tested geometric bound, not a proof against every possible low-resolution edge artifact.

**Bloom normalization:** separable blur of a constant HDR input returned channel means/minima/maxima of exactly `[0.5, 0.25, 1, 1]` in the tested half-float output. The test checks normalization rather than a subjective glow radius.

**Absorption:** changing absorption in the controlled scene changed mean accumulated alpha from approximately **0.0769** to **0.9595**. The parameter participates in integration rather than only updating the UI.

**Selected environment contribution:** a red-only HDRI supplied to an unlit volume produced nonzero red and zero green/blue in the controlled result. SkySynth and HDRI selection therefore take distinct volume colour paths; this is not merely an HDRI background test.

**Finite output:** the captured effect and presentation readbacks contained no NaN or infinity. Extreme feedback is bounded before half-float storage. These assertions are limited to the executed cases.

## Rendered demonstrations

Open [the native preview gallery](validation/v4.4a/gallery.html) for the actual offscreen outputs, or inspect the ten PNGs beside the native report. They were visually reviewed and overly opaque initial settings were adjusted before the final run.

Nine demonstration images use **480×300** presentation; the deliberately expensive ABSURD AA example uses **160×100**. Source/environment and mesh budgets are bounded for software execution (source width 64, environment width 128, mesh resolution 64). Other demonstration controls are their shipped values. Normal demonstrations receive six test frames; ABSURD AA receives two. Long-lived feedback and a Temporal32 target are consequently not fully converged in these stills. Image differences establish visible output variation, not objective artistic quality or full-resolution performance.

The UI screenshot in the gallery is separate evidence from the browser component check, not a WebGPU-rendered browser screenshot.

## Browser/UI and launch boundary

The managed Chromium environment blocks navigation to the local HTTP app and `file://` pages. That policy was not bypassed. The file-launch check is explicitly recorded as skipped, not passed.

The 59 component checks execute the real embedded UI/worker from the rebuilt standalone HTML through an opaque in-memory page. They verify all 208 numeric controls (94 new), six new tabs, twenty module menus, ten new stacks, tooltips, fractional cache cadence, independent feedback persistence/opacity, locks, project snapshot round-trips, user presets, small-window layout and retained LUT operations. They also execute a worker frame and local EXR decode. No JavaScript page errors were recorded.

This opaque origin does not provide normal persistent browser asset storage. The expected HDRI notification asks the user to reload the asset next session; it is not a renderer failure. Project serialization round-trips were tested, but normal-origin reload persistence still needs a real served-browser pass.

The separate HTTP smoke test checks actual served bytes and content types, plus 404/405 responses. It does not establish that a browser presented a WebGPU frame. Windows launcher logic is retained and inspected; it was not executed on Windows here.

## Remaining hands-on checks

The important outstanding checks are an actual WebGPU browser launch/presentation on the target machine, normal-origin persistence after reload, interactive camera/control use over a long session, full-size extreme SSAA memory pressure and target-hardware GPU timings. Controlled `device.destroy()` and fresh initialization are covered; surprise physical device/driver loss is not reproduced. The suite does not certify every browser, adapter or driver.

Several intentional rendering approximations are described in `V4.4a-ARCHITECTURE.md`: camera-only conservative reprojection, visible-depth surface/mesh shells rather than a closed-mesh SDF, ray-integrated cache debug views rather than a 3D slice editor, finite traversal for the tiled field, and one-frame latency for volume/history masks in scene materials. Raw 3D projection inputs use documented proxies when no mesh UV/normal exists.

## Reproduce

The application itself has no npm installation step. From the extracted release:

```sh
npm test
npm run build:standalone
node tools/http-smoke.mjs
```

Optional native integration needs the external official Dawn Node binding and an available Vulkan adapter. For example, in a POSIX shell:

```sh
NATIVE_DAWN=/absolute/path/to/dawn.node \
GPU_TEST_MATRIX=1 GPU_TEST_OUT=./validation-local \
node tools/gpu-smoke.mjs
```

Set `VK_ICD_FILENAMES` only when selecting a particular installed Vulkan ICD. The executed software run used the Chromium SwiftShader ICD, not a discrete GPU. `GPU_DEMO_ONLY=1` runs the demonstration capture path; the full matrix uses `GPU_TEST_MATRIX=1`. Generated reports should use a separate local output directory so they do not overwrite the shipped evidence.

Optional component checks need Playwright and Chromium installed separately:

```sh
UI_TEST_OUT=./validation-ui CHROMIUM_PATH=/absolute/path/to/chromium \
python tools/ui-component-checks.py > validation-ui.json
```

`SHA256SUMS.txt` covers the packaged files except the manifest itself. Validation artifacts from older releases remain in their original locations as historical records; only `validation/v4.4a/` is evidence for this release.
