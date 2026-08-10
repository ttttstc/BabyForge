# Keep 3D viewers stable and demand-driven

BabyForge will keep page content independent from 3D readiness, preserve a stable organ-page WebGL canvas across model changes, lazy-start disease models near the viewport, pause off-screen or idle rendering, and recover model/context failures through one automatic retry plus a manual fallback. This trades some retained session memory for fewer WebGL context creations, GPU uploads, and interaction-time React updates; source GLB files remain unchanged because this task prioritizes runtime stability without adding or replacing model variants.
