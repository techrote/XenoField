# XENOFIELD V4.2a validation

Current validation artifacts are under `docs/validation/`.

- `v4.2a-automated-tests.log` — Node tests + static contracts.
- `v4.2a-ui-component-checks.json` — bounded Chromium DOM/UI plus local HDR/EXR import checks.
- `v4.2a-http-smoke.json` — local server GET checks.
- `ui-v4.2a-desktop.png` — screenshot from the CPU-environment fallback used by the UI harness; **not** a WebGPU liquid render.

The test host has no usable WebGPU adapter, so no claim is made that these checks certify GPU image quality, frame rate or all GPU-specific runtime paths.
