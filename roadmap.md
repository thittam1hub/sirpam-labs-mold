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
- [x] Faster mold generation for big STLs (numeric spatial hash: 36s→17s on 1.2M tris)
- [x] Mold from user's real STL → STL pair (detailed Bala Murugan, front/back split)

## Round 4 (Sep 26)
- [x] Auto-repair broken STLs (weld, drop bad/overlapping, fix winding, close holes, rebuild-as-solid fallback)
- [x] Detail reducer for big files (50k–400k)
- [x] Scale to target mm + 90° rotate
- [x] Mold report (before/after pictures, pieces, cost, casting, pour tips; Save as PDF)

## Round 5 (Sep 26)
- [x] Auto-repair + retry inside Generate Mold
- [x] Gallery: price paid, mold size, price per cm³ comparison
- [x] Reduce detail keeps fine detail (repair first, then solid-engine simplify)

## Round 6 (Sep 27) — competitor gaps (Meshcast, MoldForge, Moldboxer)
- [x] Drag the split plane in the 3D view
- [x] Clamp wings, air vents, stand-fins
- [x] Curved split line (follows the model)
- [x] New mold types: plaster slip-cast, press mold, relief tray

## Round 7 (Sep 27)
- [x] Polish pass: all pages load with no errors; tour text fixed; styled photo button
- [x] Research picks awaiting user choice (casting volume label, mold feet, base filler, 3–4 part molds, printer overhang draft)

## Round 8 (done)
- [x] Casting volume engraved + in file names
- [x] Mold feet
- [x] Gap filler under the model
- [x] 3 and 4 part molds
- [x] Support-free print check (overhang angle)
- [x] Watermark text

## Round 9 (done)
- [x] Logo in top bar + site icon
- [x] Shop: price per size + send-project form
- [x] Auto-repair progress bar
- [x] Gallery: STL name/size, best settings, rating
