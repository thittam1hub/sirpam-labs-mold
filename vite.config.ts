// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // The dev-only source tagger adds a dashed "data-tsd-source" prop to every
    // JSX element; React Three Fiber treats dashed props as nested paths on
    // three.js objects and crashes. Strip it from the 3D app's files.
    plugins: [
      {
        name: "strip-tsd-source-r3f",
        enforce: "pre",
        transform(code: string, id: string) {
          if (!/\/src\/moldmaker\/.*\.tsx(\?|$)/.test(id) || !code.includes("data-tsd-source")) return;
          return { code: code.replace(/ data-tsd-source="[^"]*"/g, ""), map: null };
        },
      },
    ],
    // manifold-3d ships WASM and must not be pre-bundled by dep optimizer.
    // Pre-bundle the 3D libs up front so Vite never re-optimizes mid-session,
    // which loads two React copies ("Cannot read properties of null (reading 'useState')").
    optimizeDeps: {
      exclude: ["manifold-3d"],
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "three/examples/jsm/loaders/FontLoader.js",
        "three/examples/jsm/loaders/OBJLoader.js",
        "three/examples/jsm/loaders/STLLoader.js",
        "three/examples/jsm/loaders/SVGLoader.js",
        "three/examples/jsm/utils/BufferGeometryUtils.js",
      ],
    },
  },
});
