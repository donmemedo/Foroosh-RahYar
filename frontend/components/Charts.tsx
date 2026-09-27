"use client";
import { useState } from "react";

type Pt = { date: string; views: number; shares: number };

/** Two-series smooth area chart with hover scrubber. Pure SVG. */
export function AreaChart({ data, fmtNum, fmtDate, labels }: { data: Pt[]; fmtNum: (n: number) => string; fmtDate: (d: string) => string; labels: [string, string] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, P = 8;
  const max = Math.max(1, ...data.map((d) => d.views)) * 1.1;
  const x = (i: number) => P + (i / Math.max(1, data.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - (v / max) * (H - P * 2);
  const line = (k: "views" | "shares") =>
    data.map((d, i) => {
      if (!i) return `M${x(0)},${y(d[k])}`;
      const cx = (x(i - 1) + x(i)) / 2;
      return `C${cx},${y(data[i - 1][k])} ${cx},${y(d[k])} ${x(i)},${y(d[k])}`;
    }).join("");
  const area = (k: "views" | "shares") => `${line(k)}L${x(data.length - 1)},${H}L${x(0)},${H}Z`;
  const h = hover ?? data.length - 1;

  return (
    <div dir="ltr" className="relative">
      <div className="mb-3 flex items-end gap-6">
        {(["views", "shares"] as const).map((k, i) => (
          <div key={k}>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`size-2 rounded-full ${i ? "bg-accent-3" : "bg-accent"}`} />
              {labels[i]}
            </div>
            <div className="text-2xl font-semibold tabular-nums tracking-tight">{data[h] ? fmtNum(data[h][k]) : "—"}</div>
          </div>
        ))}
        <div className="ms-auto text-xs text-muted">{data[h] && fmtDate(data[h].date)}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full touch-none overflow-visible" preserveAspectRatio="none"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)));
        }}
        onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".35" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient>
          <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent-3)" stopOpacity=".3" /><stop offset="1" stopColor="var(--accent-3)" stopOpacity="0" /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--line)" vectorEffect="non-scaling-stroke" />)}
        <path d={area("views")} fill="url(#gv)" />
        <path d={area("shares")} fill="url(#gs)" />
        <path d={line("views")} fill="none" stroke="var(--accent)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" className="draw" pathLength={1} style={{ ["--len" as string]: 1 }} />
        <path d={line("shares")} fill="none" stroke="var(--accent-3)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" className="draw" pathLength={1} style={{ ["--len" as string]: 1 }} />
        {data[h] && (
          <>
            <line x1={x(h)} x2={x(h)} y1={0} y2={H} stroke="var(--muted)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" opacity={0.5} />
            <circle cx={x(h)} cy={y(data[h].views)} r={4} fill="var(--card-solid)" stroke="var(--accent)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            <circle cx={x(h)} cy={y(data[h].shares)} r={4} fill="var(--card-solid)" stroke="var(--accent-3)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
    </div>
  );
}

/** Horizontal bars; value relative to the largest. */
export function Bars({ items }: { items: { label: string; value: number; display: string; grad: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3.5">
      {items.map((it, i) => (
        <li key={it.label}>
          <div className="mb-1.5 flex justify-between gap-3 text-sm">
            <span className="truncate">{it.label}</span>
            <span className="tabular-nums text-muted">{it.display}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fg/5">
            <div className={`h-full origin-[inline-start] rounded-full bg-gradient-to-r ${it.grad} rise`}
              style={{ width: `${(it.value / max) * 100}%`, animationDelay: `${i * 80}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
