# Mold Maker import roadmap

- [x] Clone and inspect repo (Electron + Vite React renderer, no backend/auth/db)
- [x] Copy renderer source into project (components, mold engine, hooks, services)
- [x] Install deps: three, @react-three/fiber, @react-three/drei, manifold-3d, opencascade.js
- [x] Adapt Electron/telemetry/CSP specifics for web
- [x] Mount app at / route with head() metadata; copy public assets
- [x] Verify build + preview works (sample model → mold halves generated, no errors)

## New requests (Sep 26)
- [x] List current mold features + research competitor features (Meshcast, SpliceSTL, Mold Studio)
- [x] Tier 1: split-line preview (live parting-line overlay)
- [x] Tier 1: auto-suggest best parting setup (split advisor)
- [x] Tier 1: material & cost estimator
- [x] Tier 1: save/load projects (IndexedDB + .sirpam.json export/import)
- [ ] Tier 2 backlog: seal type choice, pry pockets, material presets, side-specific silicone thickness, gate advisor, multi-cavity tray, radial splits, auto-orient for printing

## Done
- [x] Rebrand to Sirpam 3D Labs Mold (Soft Neumorphic Lab: light shell, raised/inset shadows, ember #E8632B, Space Grotesk + DM Sans, brand wordmark, title/meta) — verified in browser, no errors
