---
name: edge-ai-runtime
description: Use when adding on-device (browser) AI to a web app — Chrome built-in Prompt API (Gemini Nano), Transformers.js v3 / ONNX Runtime Web on WebGPU or WASM, model caching, worker isolation, and cloud fallback. Triggers: "local AI", "edge AI", "offline AI", "WebGPU model", "run model in browser", "cut AI cost".
---

# Edge AI Runtime (browser)

## Tiering (always implement as a fallback chain)
1. **Chrome built-in AI** — feature-detect `self.LanguageModel` (newer) or `window.ai?.languageModel` (older). Check `availability()` / `capabilities()`; only use when `"available"`/`"readily"`. Zero download, zero cost.
2. **Transformers.js v3** (`@huggingface/transformers`) in a dedicated Web Worker. Prefer `device: "webgpu"` when `navigator.gpu?.requestAdapter()` resolves, else `"wasm"`. Use quantized weights (`dtype: "q4"` / `"q4f16"`).
3. **Cloud fallback** via the existing server function. Charge credits only on this tier.

## Rules
- Never load a model on page load. Load on explicit user action, show download size and progress (`progress_callback`).
- Run inference only in a Web Worker; never block the main thread or a WebGL render loop.
- Models are cached by the browser Cache API automatically; expose a "remove downloaded AI model" button.
- Validate every local output with the same schema (e.g. zod) as the cloud path; on parse failure, retry once, then fall back to cloud.
- Skip local tier on mobile with `navigator.deviceMemory < 4` or no WebGPU for models > 100 MB.
- SSR safety: dynamically `import()` the runtime after hydration only; never import at module scope in a route.
- Keep the whole feature behind a user-visible toggle ("Use on-device AI (free, private)").

## Good default models (verify license before shipping)
| Task | Model | Approx size |
|---|---|---|
| Short JSON generation | onnx-community/Qwen2.5-0.5B-Instruct (q4) | ~350 MB |
| Tiny chat / classification | HuggingFaceTB/SmolLM2-360M-Instruct | ~250 MB |
| Background removal for photo tracing | Xenova/modnet | ~25 MB |
| Search / similarity | Xenova/all-MiniLM-L6-v2 | ~23 MB |

## Measure
Log tier used, load time, tokens/s and fallback rate. Compare before/after with real users; keep cloud as the quality reference.
