import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, Grid } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildMold, prepareModel, type MoldOptions } from "@/lib/mold";

type Result = ReturnType<typeof buildMold>;

function demoModel() {
  return prepareModel(new THREE.TorusKnotGeometry(14, 4.5, 120, 20));
}

async function loadFile(file: File): Promise<THREE.BufferGeometry> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".stl")) {
    const g = new STLLoader().parse(await file.arrayBuffer());
    g.rotateX(-Math.PI / 2); // STL is Z-up
    return g;
  }
  if (name.endsWith(".obj")) {
    const obj = new OBJLoader().parse(await file.text());
    const geos: THREE.BufferGeometry[] = [];
    obj.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        const m = c as THREE.Mesh;
        m.updateMatrixWorld();
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
        geos.push(g.index ? g.toNonIndexed() : g);
      }
    });
    return mergeGeometries(geos)!;
  }
  throw new Error("Use an .stl or .obj file");
}

function download(geo: THREE.BufferGeometry, name: string) {
  const mesh = new THREE.Mesh(geo.clone().rotateX(Math.PI / 2));
  const data = new STLExporter().parse(mesh, { binary: true }) as DataView;
  const url = URL.createObjectURL(new Blob([data.buffer as ArrayBuffer], { type: "model/stl" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Slider(p: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs uppercase tracking-widest text-muted-foreground">
        <span>{p.label}</span>
        <span className="font-mono text-primary">{p.value}{p.unit}</span>
      </div>
      <input type="range" className="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(+e.target.value)} />
    </label>
  );
}

export function MoldMaker() {
  const [model, setModel] = useState<THREE.BufferGeometry>(demoModel);
  const [fileName, setFileName] = useState("demo-knot");
  const [opts, setOpts] = useState<MoldOptions>({ wall: 8, splitRatio: 0.5, keys: true, keyRadius: 3, sprue: true, sprueRadius: 3 });
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explode, setExplode] = useState(20);
  const [showModel, setShowModel] = useState(false);

  const size = useMemo(() => {
    const s = new THREE.Vector3();
    model.boundingBox!.getSize(s);
    return s;
  }, [model]);

  useEffect(() => {
    setBusy(true);
    setError(null);
    const t = setTimeout(() => {
      try {
        setResult(buildMold(model, opts));
      } catch (e) {
        setError("Could not cut this model. Make sure it is a closed (watertight) mesh.");
        setResult(null);
      } finally {
        setBusy(false);
      }
    }, 30);
    return () => clearTimeout(t);
  }, [model, opts]);

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      const g = prepareModel(await loadFile(f));
      setModel(g);
      setFileName(f.name.replace(/\.\w+$/, ""));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const set = <K extends keyof MoldOptions>(k: K, v: MoldOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));
  const camDist = Math.max(size.x, size.y, size.z) * 2.6 + 40;

  return (
    <div className="grid h-screen grid-cols-1 bg-background text-foreground md:grid-cols-[340px_1fr]">
      <aside className="panel flex flex-col gap-6 overflow-y-auto p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Cast/Forge</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight">Two-part mold maker</h1>
          <p className="mt-2 text-sm text-muted-foreground">Drop a watertight STL or OBJ. We cut the cavity, split it, add alignment keys and a pour spout.</p>
        </header>

        <label className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
          <input type="file" accept=".stl,.obj" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <span className="font-mono text-sm">{fileName}</span>
          <span className="text-xs text-muted-foreground">
            {size.x.toFixed(1)} × {size.y.toFixed(1)} × {size.z.toFixed(1)} mm — click or drop to replace
          </span>
        </label>

        <section className="space-y-5">
          <Slider label="Wall thickness" value={opts.wall} min={3} max={30} step={1} unit=" mm" onChange={(v) => set("wall", v)} />
          <Slider label="Parting line" value={Math.round(opts.splitRatio * 100)} min={15} max={85} step={1} unit="%" onChange={(v) => set("splitRatio", v / 100)} />
          <label className="toggle"><input type="checkbox" checked={opts.keys} onChange={(e) => set("keys", e.target.checked)} /> Registration keys</label>
          {opts.keys && <Slider label="Key radius" value={opts.keyRadius} min={1} max={8} step={0.5} unit=" mm" onChange={(v) => set("keyRadius", v)} />}
          <label className="toggle"><input type="checkbox" checked={opts.sprue} onChange={(e) => set("sprue", e.target.checked)} /> Pour spout</label>
          {opts.sprue && <Slider label="Spout radius" value={opts.sprueRadius} min={1} max={10} step={0.5} unit=" mm" onChange={(v) => set("sprueRadius", v)} />}
        </section>

        <section className="space-y-5 border-t border-border pt-5">
          <Slider label="Explode view" value={explode} min={0} max={80} step={1} unit=" mm" onChange={setExplode} />
          <label className="toggle"><input type="checkbox" checked={showModel} onChange={(e) => setShowModel(e.target.checked)} /> Show original model</label>
        </section>

        <div className="mt-auto space-y-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="font-mono text-xs text-muted-foreground">{busy ? "Cutting mold…" : result ? `Block ${result.dims.W.toFixed(0)}×${result.dims.H.toFixed(0)}×${result.dims.D.toFixed(0)} mm` : ""}</p>
          <button className="btn-primary" disabled={!result || busy} onClick={() => result && download(result.top, `${fileName}-mold-top.stl`)}>Download top half</button>
          <button className="btn-outline" disabled={!result || busy} onClick={() => result && download(result.bottom, `${fileName}-mold-bottom.stl`)}>Download bottom half</button>
        </div>
      </aside>

      <main className="relative">
        <Canvas camera={{ position: [camDist * 0.7, camDist * 0.5, camDist * 0.7], fov: 45 }}>
          <color attach="background" args={["#1b1d20"]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[50, 80, 40]} intensity={1.6} />
          <Environment>
            <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
            <Lightformer intensity={1} color="#f0b070" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          </Environment>
          {result && (
            <>
              <mesh geometry={result.top} position={[0, explode, 0]}>
                <meshStandardMaterial color="#d98e3f" roughness={0.55} metalness={0.05} transparent opacity={showModel ? 0.35 : 1} side={THREE.DoubleSide} />
              </mesh>
              <mesh geometry={result.bottom} position={[0, -explode, 0]}>
                <meshStandardMaterial color="#8a9098" roughness={0.6} transparent opacity={showModel ? 0.35 : 1} side={THREE.DoubleSide} />
              </mesh>
            </>
          )}
          {showModel && (
            <mesh geometry={model}>
              <meshStandardMaterial color="#e8e2d4" roughness={0.3} />
            </mesh>
          )}
          <Grid position={[0, -(result?.dims.H ?? 40) / 2 - explode - 1, 0]} args={[400, 400]} cellColor="#2e3136" sectionColor="#4a4238" fadeDistance={camDist * 3} infiniteGrid />
          <OrbitControls makeDefault />
        </Canvas>
        <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-xs text-muted-foreground">drag to orbit · scroll to zoom</div>
      </main>
    </div>
  );
}
