"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5m5 5H3",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
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

/** Apple-style rubber band: the further past the edge, the less the sheet follows. */
const rubberband = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

/** Momentum projection (WWDC "Designing Fluid Interfaces"): where a flick would come to rest. */
const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);

/**
 * Native <dialog> presented as an Apple sheet. It springs up from the bottom, follows the finger 1:1
 * from the grabber or any [data-grab] area, flicks closed using projected momentum, leaves the way it
 * came, and can be grabbed again mid-animation (springs always start from the live on-screen value).
 */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const s = useRef({ y: 0, v: 0, raf: 0, dragged: false });
  const close = useRef(onClose);
  close.current = onClose;
  const [shown, setShown] = useState(open); // keeps children mounted during the exit animation

  const place = (d: HTMLDialogElement, y: number) => {
    d.style.transform = `translate3d(0, ${y}px, 0)`;
    d.style.setProperty("--sheet-shown", String(Math.max(0, Math.min(1, 1 - y / (d.offsetHeight || 1)))));
  };

  // Spring with Apple's sheet response (0.3 s). damping 1 = no overshoot; 0.8 only after a flick.
  const springTo = (target: number, damping: number, done?: () => void) => {
    const d = ref.current!, st = s.current;
    cancelAnimationFrame(st.raf);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      st.y = target; st.v = 0; place(d, target); done?.();
      return;
    }
    const k = (2 * Math.PI / 0.3) ** 2, c = 2 * damping * Math.sqrt(k);
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      st.v += (-k * (st.y - target) - c * st.v) * dt; // semi-implicit Euler, stable at this dt
      st.y += st.v * dt;
      if (Math.abs(st.v) < 4 && Math.abs(st.y - target) < 0.5) {
        st.y = target; st.v = 0; place(d, target); done?.();
        return;
      }
      place(d, st.y);
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  };

  useLayoutEffect(() => {
    const d = ref.current!;
    if (open) {
      setShown(true);
      if (!d.open) {
        d.showModal();
        s.current.y = d.offsetHeight; // enter from below, painted off-screen before the first frame
        place(d, s.current.y);
      }
      springTo(0, 1);
    } else if (d.open) {
      springTo(d.offsetHeight, 1, () => { d.close(); setShown(false); }); // exit along the entry path
    }
    // springTo/place only touch refs; re-running on their identity would restart the animation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => cancelAnimationFrame(s.current.raf), []);

  const grab = (e: React.PointerEvent<HTMLDialogElement>) => {
    const target = e.target as HTMLElement;
    if (!open || !target.closest("[data-grab], .sheet-grip") || target.closest("button, a, input, select, textarea")) return;
    const d = ref.current!, st = s.current;
    cancelAnimationFrame(st.raf); // interrupt: continue from where the sheet is right now
    d.setPointerCapture(e.pointerId);
    const offset = e.clientY - st.y; // respect where it was grabbed
    const history: [number, number][] = [[e.timeStamp, e.clientY]];
    st.dragged = false;
    const move = (ev: PointerEvent) => {
      const y = ev.clientY - offset;
      st.y = y < 0 ? rubberband(y, d.offsetHeight) : y;
      st.dragged ||= Math.abs(y) > 3;
      place(d, st.y);
      history.push([ev.timeStamp, ev.clientY]);
      if (history.length > 5) history.shift();
    };
    const up = (ev: PointerEvent) => {
      d.removeEventListener("pointermove", move);
      d.removeEventListener("pointerup", up);
      d.removeEventListener("pointercancel", up);
      const [t0, y0] = history[0];
      st.v = ev.timeStamp > t0 ? ((ev.clientY - y0) / (ev.timeStamp - t0)) * 1000 : 0; // px/s handed to the spring
      if (st.y + project(st.v) > d.offsetHeight / 2) springTo(d.offsetHeight, 1, () => close.current());
      else springTo(0, Math.abs(st.v) > 300 ? 0.8 : 1);
    };
    d.addEventListener("pointermove", move);
    d.addEventListener("pointerup", up);
    d.addEventListener("pointercancel", up);
  };

  return (
    <dialog ref={ref} className="sheet" aria-label={label} onPointerDown={grab}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClose={() => open && onClose()}
      onSubmit={(e) => {
        if ((e.target as HTMLFormElement).method === "dialog") { e.preventDefault(); onClose(); } // animate instead of a hard close
      }}
      onClick={(e) => {
        if (s.current.dragged) { s.current.dragged = false; return; } // the click that ends a drag is not a backdrop tap
        const r = ref.current!.getBoundingClientRect();
        if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) onClose();
      }}>
      <span className="sheet-grip" aria-hidden><span /></span>
      {(open || shown) && children}
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
