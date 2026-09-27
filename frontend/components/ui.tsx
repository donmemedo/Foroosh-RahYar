"use client";
import { useEffect, useRef, useState } from "react";

const paths: Record<string, string> = {
  sun: "M12 3v2m0 14v2M5.6 5.6 7 7m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3.5 9h17M3.5 15h17",
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z",
  chart: "M4 20h16M7 16v-5m5 5V7m5 9v-8",
  layers: "m12 4 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5",
  search: "m20 20-4.5-4.5M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7",
  share: "M12 15V3m0 0L8 7m4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  download: "M12 4v12m0 0-4-4m4 4 4-4M5 20h14",
  upload: "M12 16V4m0 0L8 8m4-4 4 4M5 20h14",
  eye: "M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  deck: "M4 5h16v11H4zM12 16v4m-4 0h8",
  catalog: "M5 4h10l4 4v12H5zM15 4v4h4",
  video: "M4 6h11v12H4zM15 10l5-3v10l-5-3",
  case: "M4 8h16v11H4zM9 8V5h6v3",
  pricing: "M20 12 12 20l-8-8V4h8l8 8ZM8 8h.01",
  playbook: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h11",
  bolt: "M13 3 4 14h7l-1 7 9-11h-7l1-7Z",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  arrow: "M5 12h14m-5-5 5 5-5 5",
};

export function Icon({ name, className = "size-5", strokeWidth = 1.8 }: { name: string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}

export const CAT_GRAD: Record<string, string> = {
  deck: "from-[#0071e3] to-[#5ac8fa]",
  catalog: "from-[#7c3aed] to-[#ec4899]",
  video: "from-[#ff375f] to-[#ff9f0a]",
  case: "from-[#30d158] to-[#0a84ff]",
  pricing: "from-[#ff9f0a] to-[#ffd60a]",
  playbook: "from-[#5e5ce6] to-[#64d2ff]",
};

/** Native <dialog> presented as an Apple sheet. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-label={label} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && children}
    </dialog>
  );
}

export const toast = (msg: string, tone: "ok" | "err" = "ok") => window.dispatchEvent(new CustomEvent("toast", { detail: { msg, tone } }));

export function Toaster() {
  const [t, setT] = useState<{ msg: string; tone: string; k: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setT({ ...(e as CustomEvent).detail, k: Math.random() });
      clearTimeout(timer);
      timer = setTimeout(() => setT(null), 2800);
    };
    window.addEventListener("toast", on);
    return () => window.removeEventListener("toast", on);
  }, []);
  if (!t) return null;
  return (
    <div key={t.k} role="status" className="toast glass fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-medium shadow-2xl md:bottom-8">
      <span className={`grid size-5 place-items-center rounded-full text-white ${t.tone === "ok" ? "bg-ok" : "bg-[#ff453a]"}`}>
        <Icon name={t.tone === "ok" ? "check" : "x"} className="size-3.5" strokeWidth={3} />
      </span>
      {t.msg}
    </div>
  );
}

/** Count-up number for that "alive" feel. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      setN(value * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(Number.isInteger(value) ? Math.round(n) : Math.round(n * 10) / 10)}</>;
}
