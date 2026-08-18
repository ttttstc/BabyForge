# 3D viewer performance design

## Objective

All BabyForge 3D teaching pages must keep their written content immediately usable while the model loads. Cold loads should remove avoidable main-thread and WebGL work; cached visits should recover quickly; dragging, zooming, route changes, Safari, and WeChat embedded browsers must not leave a blank viewer.

## Baseline

- The anatomy library contains 16 GLB files totaling 64,807,596 bytes. Individual files range from about 2 MB to 6 MB and remain unchanged in this work.
- A render-time WebGL capability check creates a new probe context on every React render.
- Disease hotspots publish screen coordinates from every rendered frame, causing React state and layout work during camera interaction.
- Organ changes remount the entire R3F `Canvas`, recreating the WebGL renderer and GPU uploads even when `useGLTF` has cached the asset.
- Disease topics may mount several continuously rendered canvases. Off-screen models are not paused.
- Anatomy canvases use the default continuous frame loop and `preserveDrawingBuffer`; organ auto-rotation never stops by itself.
- Context loss, a stalled load, and a cached loader rejection do not share a complete recovery path.

## Scope

Change the shared WebGL probe, anatomy and newborn canvases, disease display units, organ viewer lifecycle, loading state, retry path, and focused browser tests. Keep routes, content hierarchy, hotspot meaning, source GLB files, and medical copy unchanged. Deployment is outside this task.

## Design

1. Cache one WebGL capability result and release the detached probe context.
2. Keep the organ page's `Canvas` stable while replacing only the model subtree.
3. Start disease models near the viewport, retain their canvas after first mount, and stop its frame loop while off-screen.
4. Use demand rendering whenever auto-rotation is off. Remove `preserveDrawingBuffer`; cap DPR and disable antialiasing in explicit low-performance mode, with automatic protection only for genuinely low-memory devices (reported `deviceMemory` ≤ 1 GB). Touch input and pixel density alone do not trigger a downgrade because the target phones are touch devices.
5. Publish hotspot screen positions after controls settle or the viewport changes, not once per frame.
6. Auto-rotate briefly as an interaction hint, then pause. Any user camera interaction pauses it immediately.
7. Measure mount-to-ready time with the browser Performance API.
8. On loader or WebGL context failure, clear the affected GLTF cache and retry once. A second failure keeps the written guide available and exposes a manual model reload.

## Acceptance scenarios

- Cold entry: page text and controls render without waiting for the anatomy chunk or GLB; loading state remains explicit until ready.
- Cached entry: returning to a previously opened organ reuses browser/session caches and does not recreate the page-level canvas solely because the organ changed.
- Interaction: repeated drag, wheel zoom, toolbar zoom, and reset keep the canvas visible and responsive without creating probe contexts per render.
- Multi-model disease: models not yet near the viewport do not load; an off-screen mounted model stops rendering.
- Recovery: simulated context loss or model failure triggers one automatic recovery, then a non-blocking fallback with a manual retry.
- Compatibility: current Safari and WeChat embedded browsers get the interactive model when WebGL works and the written fallback when it does not.

## Verification

Run focused Playwright coverage for organ switching, drag/zoom stability, stable canvas identity, off-screen behavior, and failure recovery. Then run unit tests, lint, production build, and diff review. Compare Performance API `babyforge:3d-ready:*` entries under the same browser/network conditions; no absolute cold-load threshold is promised while source asset sizes remain unchanged.

## Stop and rollback

Stop after code, tests, build, and measured results; do not deploy. Viewer changes are isolated to shared viewer/features files and can be rolled back without changing domain data or model assets.
