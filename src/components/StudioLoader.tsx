import { useEffect, useState } from "react";

const stages = [
  "Warming up the 3D engine",
  "Loading geometry kernel",
  "Preparing mold tools",
  "Almost ready",
];

export function StudioLoader({ heading }: { heading?: string } = {}) {
  const [progress, setProgress] = useState(6);
  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((p) => (p >= 94 ? p : p + Math.max(0.6, (95 - p) * 0.06)));
    }, 120);
    return () => window.clearInterval(id);
  }, []);
  const stage = stages[Math.min(stages.length - 1, Math.floor(progress / 25))];
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground"
    >
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted, 0 0% 90%))" className="stroke-muted" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            className="stroke-primary transition-[stroke-dashoffset] duration-150"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress / 100)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-lg border-2 border-primary/40 bg-primary/10 [animation-duration:2.4s]" />
        </div>
        <span className="absolute inset-x-0 -bottom-7 text-center text-sm font-semibold tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="mt-4 text-center">
        {heading && <h1 className="mb-1 font-display text-xl font-semibold">{heading}</h1>}
        <p className="font-medium">{stage}…</p>
        <p className="text-sm text-muted-foreground">The mold engine runs in your browser — your model stays on your computer.</p>
      </div>
    </div>
  );
}
