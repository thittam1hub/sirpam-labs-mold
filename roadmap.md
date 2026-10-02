# Roadmap

## In progress
- [ ] Google Drive per-user connect — client linked (auc_01m3rnt5mnf2fr28xqh35pphsm); user must add gateway callback URL to their Google OAuth client: https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
- [ ] In-app issue report form — code done; DB replayed (feedback_reports table live); needs browser re-verify of admin view

## Blocked / waiting
- [ ] Google Drive end-to-end connect test — waits on user adding the callback URL in Google Cloud Console
- [ ] NOTE: this project is a REMIX of the main project — do NOT publish from here without confirming with user

## Done this round
- [x] Doctor view + workshop sheet standardized — deterministic problem markers, TDS-first material guidance, 25 °C references, qualitative temperature cautions, focused tests and browser verification
- [x] Reddit pain-point research (sub_dertspg4) — top issues: trapped air bubbles, misaligned seams, leaking molds, demolding tears (undercuts), key misalignment, mold deformation, layer-line transfer, cure inhibition, over-mixed silicone waste, clamping pressure

## Proposed next features (from research; existing-engine overlaps noted)
- [ ] Air-trap preview + auto vents at "dead air" pockets for the chosen orientation (extends existing auto vents + heatmap overlay) — big engineering
- [ ] Undercut / tear-risk highlighter before generating (extends draft-analysis overlay) — big engineering
- [ ] Material compatibility advisor: warn when print resin inhibits silicone cure (quick win)
- [ ] Structural ribs for large silicone molds (stand-fins exist; ribs are new) — quick win
- [ ] Flash/seam trim guide in the mold report — quick win
- [ ] Clamp-wing pressure lands (clamp wings exist; add seating flats) — quick win

## Reddit pain-point plan — Phase 1 (done, awaiting user review)
- [x] Material compatibility advisor (rules table + card in Mold step and Finish report)
- [x] Seam/flash trim guide in mold report (split-line length + per-material trimming advice)
- [x] Structural ribs for wide silicone box walls (optional extra, >120 mm walls)
- Verified: tsgo clean, 48 tests pass, build OK, browser smoke (caution card + finish report) clean
## Phase 2 (done)
- [x] Air-trap preview with one-click vent placement
- [x] Demolding risk score (undercut + draft, 0–100)
## Phase 3 (done)
- [x] Leak check (parting-plane contact validation)
- [x] Cure-time & pour planner card

## Final upstream-code scan (done)
- [x] No code or references from the original project remain

## New (08:00–08:30)
- [x] Remix backend rebuilt: all 22 original migrations replayed + storage buckets (mold-photos, avatars, project-files) recreated — typecheck clean, 55 tests pass
- [x] feedback_reports + app_user_connections tables created
- [x] Feedback form verified in browser (submit works, no console errors)
- [x] Google Drive client linked to project; server fns + DriveCard + OAuth return page written
- [ ] Drive: user adds gateway callback URL in Google Cloud Console, then end-to-end connect test

## Mold engine v3 plan (approved 2026-09-30)
- [x] Step 0: 3d-print-modeling skill installed
- [x] C10 cost per piece, C11 mold life, C12 print settings card (Finish step, 4 tests)
- [x] B6 runner system — already existed (extras.runner)
- [x] A1 faster builds (result cache + engine warm-up; 2nd thread deferred)
- [x] A2 auto draft angle (Model Tools > Add draft, undoable)
- [ ] A4 repair summary + build block
- [x] C9 clamp-wing pressure lands (optional "Clamp seats", test added)
- [ ] B5 core pins / inserts
- [ ] A3 smart split surface
- [ ] B7 pour funnel + clamp jig
- [ ] B8 candle & soap presets
- [x] B5 core pin (through-hole) — rigid molds, optional, tested
- [x] A3 split advisor also tries the widest-outline split on each axis
- [x] B7 printable pour funnel + clamp sleeve (optional extras, v3Features.ts)
- [x] B8 pillar candle (wax + 3 mm wick pin) and soap bar samples
- [ ] A1 second background thread — deferred: cache + warm-up already give instant repeats; splitting one Manifold build across threads adds risk for little gain
