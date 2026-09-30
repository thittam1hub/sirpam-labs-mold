// Type stub for the OpenCascade WebAssembly loader (no official typings).
declare module 'opencascade.js/dist/opencascade.wasm.js' {
  const createModule: (opts?: { wasmBinary?: ArrayBuffer | Uint8Array }) => Promise<unknown>;
  export default createModule;
}
