# Roadmap

## In progress
- (none — awaiting user's pick from pain-point feature ideas)

## Blocked / waiting
- (none)

## Done this round
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

## New (07:11)
- [ ] Google Drive per-user connect (App User Connector) — client setup card pending user
- [ ] In-app issue report form (no WhatsApp) — save to DB + notify
- [ ] NOTE: this project is a REMIX of the main project — do NOT publish from here without confirming with user
