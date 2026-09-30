# Roadmap — credit system
- [x] Phase 1: charge-on-success holds, server checks, credit types + expiry, single price list, legal pages
- [x] Phase 2: low-balance warnings, history filters + CSV, usage summary, promo codes
- [x] Phase 2: referral credits
- [x] Production-readiness: purchase records, receipts, admin refund path, expiry warnings, promo rate limit, packs in database
- [x] Phase 3: Paddle (international) + Razorpay (India) checkout, verified crediting, refunds remove unused credits
- [x] Phase 4: admin page (user lookup, adjust credits, promo codes, usage stats, purchase refunds)
- [x] Phase 5: server-only balance changes, duplicate-proof references, live checks run

# Roadmap — hug and silicone molds
- [x] Silicone form-fit locks placed in the real wall (no floating pins)
- [x] Parting flange for rigid and silicone hug molds
- [x] Silicone hug molds: pour hole and vents at the model's high points
- [x] Hug mother mold + skin registration rim (skin molds)
- [x] Silicone parting-board keys piece
- [x] Printer-type lock/fit-gap presets and thin-wall warning
- [x] Bolt holes through the parting flange

# Roadmap — production launch checklist
- [x] 11 Test data cleanup (TESTONCE removed; only your account is admin; no test purchases)
- [x] 13 Friendly error + missing-page screens (site-wide, all pages covered)
- [x] 9 AI generation + handoff tested (works; new models now framed to fit the view)
- [x] 10 Reviewed 20 database warnings — all intentional and safe
- [x] 14 Dark mode checked on Studio + AI page (desktop and phone)
- [x] 15 Phone tour moved under the top bar, compact
- [x] 16 Credit tests (10 passing: price prompt, expiry, CSV, hold/release, no self-granting)
- [x] 17 Browser check: Chrome + Safari build molds; no-3D browsers get a clear message
- [x] 18 Large-file limits: 200 MB, 2M triangles, empty/shapeless files explained
- [x] 19 Rate limits: AI maker 20/hour per person; contact 3/hour per email, 60/hour total
- [x] 20 Backups: daily automatic, ~14 days kept (photos in storage not included)
- [ ] 23 Share images — needs the published web address (do at publish)
- [x] 24 Visitor stats: built-in hosting stats, no cookies, no banner needed
- [ ] 25 Page speed — measure on the published site
- [x] 22 Guide pages: /guides + silicone molds, 3D printed molds, STL to mold
- [ ] 21 publish + Search Console; crash tracking after publish
- [x] 1–3 payments, webhook, inviter purchase bonus (10 credits)
- [ ] 7 branded email — needs your own domain
- [ ] Going live with payments — verification in the Payments tab + publish
- [ ] 4, 5, 6, 8 — your actions (lawyer, grievance officer, domain, print test)

- [x] Razorpay webhook setup

# Roadmap — overall app improvement checklist (Sep 29)
- [x] 7 Sample template gallery: mushroom, chess pawn, vase, heart — one click each in the Studio
- [x] 35 Analytics events: mold_generated, file_exported, quote_requested, whatsapp_contact_clicked
- [x] 36 Privacy page discloses Google Analytics + Microsoft Clarity (inputs masked)
- [x] 29 Share images (og:image) for home and pricing — points at mold.sirpam3dlabs.in/og-image.png; verify at publish
- [x] 9 checked: batch ZIP of both halves does not exist (only 3MF container) — future item
- [x] 8 checked: project save/restore already exists (device storage + shareable .sirpam.json file)
- [ ] 6 Guided onboarding hints — deferred (tour was removed by request; ask before re-adding)
- [ ] 10 Split the two largest Studio files into smaller modules
- [ ] 18 UI/flow tests for sign-up, quote request, gallery
- [ ] 22 Crash tracking in production — after publish
- [ ] 42 Turn on Google Sheets notification rules (Tools → Notification rules) — your action

# Roadmap — clean-room engine rewrite (remove PolyForm NC code)
- [x] 1 Golden reference set: 4 samples x 6 modes recorded (mold/golden.test.ts + golden.json)
- [x] Original usage-sharing popup + sender removed (5 files)
- [x] 2 New engine core: constants, manifoldBridge, planeGeometry, moldBox, channelPlacement, draftAnalysis, capOpenBoundaries, validateMesh, moldOffset, splitLine, suggestParting, generateMold, siliconeMold
- [x] 3 Worker + files: workerProtocol, moldWorker, useMoldGenerator, exporters, minizip, fileLoader, STEP export
- [ ] 4 Screens: App, ControlPanel (split up), ModelViewer, PartingPlane, HeatmapOverlay, SplitLineOverlay, theme, types
- [ ] 5 Helpers: printerFit, printerPresets, costEstimate, projectStorage, sampleModel
- [ ] 6 Re-point our own features, drop @ts-nocheck
- [ ] 7 Licenses/About pages + AGENTS.md note
- [ ] 8 Final scan: no original file or phrase left
