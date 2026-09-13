# Mold Maker import roadmap

- [x] Clone and inspect repo (Electron + Vite React renderer, no backend/auth/db)
- [x] Copy renderer source into project (components, mold engine, hooks, services)
- [x] Install deps: three, @react-three/fiber, @react-three/drei, manifold-3d, opencascade.js
- [x] Adapt Electron/telemetry/CSP specifics for web
- [x] Mount app at / route with head() metadata; copy public assets
- [x] Verify build + preview works (sample model → mold halves generated, no errors)
