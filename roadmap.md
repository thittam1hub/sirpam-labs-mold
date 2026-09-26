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
- [x] Tier 2: seal type (pins/tongue & groove), pry slots, casting material presets, per-side silicone thickness, gate advisor, multi-cavity tray, radial splits, auto-orient on export — browser-verified

- [x] Hollow core molds (printable core for vases/cups)
- [x] Runner system for multi-cavity trays
- [x] Guided first-time tutorial

## Done
- [x] Rebrand to Sirpam 3D Labs Mold (Soft Neumorphic Lab: light shell, raised/inset shadows, ember #E8632B, Space Grotesk + DM Sans, brand wordmark, title/meta) — verified in browser, no errors
- [x] UI restructure: top toolbar + 5-step guided panel

## Research roadmap (Sep 26, second round)
- [x] Phase A: shrink & fit compensation, leak-proof print guide, surface finish advisor, mold life estimate, wall-thickness view
- [x] Phase B: logo/text emboss, casting presets (chocolate/candle/soap/concrete/resin), wax tree builder, big-prop bed splitter, dental/medical model base
- [x] Phase C: fill preview, print-farm plate planner, AI text/photo to model (Lovable AI via server function) — browser-verified

## Requests (Sep 26, round 3)
- [x] Shop page: researched mold/print services, pricing, how to send .sirpam
- [x] Gallery: upload photos + notes of printed molds (online account, sign-in)
- [x] Suggest Best Split: coarse-to-fine (faster on big STLs, 2% precision)
- [ ] Faster mold generation for big STLs (needs a real large STL to measure)
- [ ] Mold from user's real STL → STL pair (waiting for the file)

## Round 4 (Sep 26)
- [x] Auto-repair broken STLs (weld, drop bad/overlapping, fix winding, close holes, rebuild-as-solid fallback)
- [x] Detail reducer for big files (50k–400k)
- [x] Scale to target mm + 90° rotate
- [x] Mold report (before/after pictures, pieces, cost, casting, pour tips; Save as PDF)
