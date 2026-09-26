<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Tier-2 mold features live in src/moldmaker/mold/moldFeatures.ts as optional `extras` passed through the worker; omitted extras must reproduce legacy output (why: keep existing molds byte-identical).
- Dev-only JSX source tags are stripped from src/moldmaker .tsx files via a vite plugin (why: React Three Fiber crashes on dashed data-tsd-source props).
- Layout: TopBar (src/moldmaker/components/layout) + ControlPanel filtered by a 'step' prop (0 Model,1 Split,2 Mold,3 Pro,4 Finish) with sticky Back/Next footer (why: guided flow without duplicating section code).
- Model-prep tools (emboss, split, wax tree, base, shrink) live in src/moldmaker/mold/modelTools.ts + utils/shopAdvice.ts, run on the main thread, and replace the master via App `replaceModel` with one-level undo (why: they change the model, not the mold, so the worker pipeline stays untouched).
