"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { num, useI18n } from "@/lib/i18n";
import { api, json, type Plan } from "@/lib/api";
import { CountUp, Icon, toast } from "@/components/ui";

const FALLBACK_PLANS: Plan[] = [
  { id: "professional", price: 900_000, unit: "user", features: ["library", "mobile", "search", "analytics_basic"] },
  { id: "premium", price: 1_200_000, unit: "user", popular: true, features: ["library", "mobile", "search", "workflow", "analytics_full", "crm"] },
  { id: "enterprise", price: 60_000_000, unit: "org", features: ["everything", "private_cloud", "sso", "sla", "onboarding"] },
];

function Hero() {
  const { t, lang } = useI18n();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const bars = [38, 62, 45, 80, 58, 92, 70];
  return (
    <section className="relative overflow-hidden">
      <div className="aurora" aria-hidden><span /><span /><span /></div>
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 md:grid-cols-[1.1fr_1fr] md:pt-24">
        <div>
          <p className="rise glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted">
            <Icon name="sparkle" className="size-3.5 text-accent-2" /> {t.hero.eyebrow}
          </p>
          <h1 className="rise mt-6 text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl" style={{ animationDelay: "80ms" }}>
            {t.hero.title1}
            <br />
            <span className="text-gradient">{t.hero.title2}</span>
          </h1>
          <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-muted" style={{ animationDelay: "160ms" }}>{t.hero.sub}</p>
          <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
            <a href="#demo" className="btn btn-primary !px-6 !py-3.5 text-base">{t.hero.cta} <Icon name="arrow" className="size-4 rtl:rotate-180" /></a>
            <Link href="/dashboard" className="btn btn-ghost !px-6 !py-3.5 text-base">{t.hero.cta2}</Link>
          </div>
        </div>

        {/* Floating device with a live mini-dashboard */}
        <div className="rise [perspective:1200px]" style={{ animationDelay: "200ms" }}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -12, y: ((e.clientX - r.left) / r.width - 0.5) * 14 });
          }}
          onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
          <div className="float">
            <div className="glass rounded-[2.2rem] p-3 shadow-2xl transition-transform duration-300 ease-out"
              style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
              <div className="rounded-[1.7rem] bg-solid p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted">{t.dash.kpis.views}</p>
                    <p className="text-3xl font-bold tabular-nums tracking-tight"><CountUp value={12480} format={(n) => num(n, lang)} /></p>
                  </div>
                  <span className="rounded-full bg-ok/15 px-2.5 py-1 text-xs font-semibold text-ok">↑ {num(24, lang)}٪</span>
                </div>
                <div className="mt-5 flex h-28 items-end gap-2" dir="ltr">
                  {bars.map((b, i) => (
                    <div key={i} className="rise flex-1 rounded-t-lg bg-gradient-to-t from-accent to-accent-2" style={{ height: `${b}%`, animationDelay: `${400 + i * 70}ms` }} />
                  ))}
                </div>
                <div className="mt-5 space-y-2.5">
                  {[["deck", "from-[#0071e3] to-[#5ac8fa]", t.lib.cats.deck], ["catalog", "from-[#7c3aed] to-[#ec4899]", t.lib.cats.catalog], ["video", "from-[#ff375f] to-[#ff9f0a]", t.lib.cats.video]].map(([ic, g, label], i) => (
                    <div key={ic} className="flex items-center gap-3 rounded-2xl bg-fg/[0.04] p-2.5">
                      <span className={`grid size-9 place-items-center rounded-xl bg-gradient-to-br ${g} text-white`}><Icon name={ic} className="size-4.5" /></span>
                      <span className="flex-1 text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted tabular-nums">v{num(3 - i, lang)}</span>
                      <span className="size-2 rounded-full bg-ok" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-4">
          {t.stats.map(([v, l]) => (
            <div key={l} className="bg-bg-2/80 p-6 text-center backdrop-blur">
              <div className="text-3xl font-bold tracking-tight">{v}</div>
              <div className="mt-1 text-sm text-muted">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  const { t } = useI18n();
  const icons = ["bolt", "check", "chart"];
  const grads = ["from-[#0071e3] to-[#5ac8fa]", "from-[#7c3aed] to-[#ec4899]", "from-[#ff375f] to-[#ff9f0a]"];
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <h2 className="reveal text-center text-4xl font-bold tracking-tight md:text-5xl">{t.pillars.title}</h2>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {t.pillars.items.map(([title, body], i) => (
          <article key={title} className="reveal card group relative overflow-hidden p-8 transition duration-500 hover:-translate-y-1.5">
            <div className={`absolute -end-16 -top-16 size-48 rounded-full bg-gradient-to-br ${grads[i]} opacity-10 blur-2xl transition duration-700 group-hover:scale-150 group-hover:opacity-25`} />
            <span className={`grid size-14 place-items-center rounded-2xl bg-gradient-to-br ${grads[i]} text-white shadow-lg`}>
              <Icon name={icons[i]} className="size-7" strokeWidth={2} />
            </span>
            <h3 className="mt-6 text-xl font-semibold">{title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{body}</p>
          </article>
        ))}
      </div>
      <div className="reveal mt-16 text-center">
        <p className="text-sm font-medium text-muted">{t.industries.title}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {t.industries.list.map((x) => <span key={x} className="glass rounded-full px-4 py-2 text-sm">{x}</span>)}
        </div>
      </div>
    </section>
  );
}

function Slider({ label, value, set, min, max, step, show }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; show: string }) {
  return (
    <label className="block">
      <div className="mb-3 flex justify-between text-sm"><span className="text-muted">{label}</span><span className="font-semibold tabular-nums">{show}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)}
        style={{ ["--p" as string]: `${((value - min) / (max - min)) * 100}%` }} />
    </label>
  );
}

function Roi() {
  const { t, lang } = useI18n();
  const [reps, setReps] = useState(60);
  const [hours, setHours] = useState(4);
  const [cost, setCost] = useState(250_000);
  const saved = reps * hours * 0.6 * 4.33;
  const value = saved * cost;
  const roi = value / (reps * 1_200_000);
  const toman = (n: number) => num(Math.round(n), lang, { notation: n >= 1e9 ? "compact" : "standard", maximumFractionDigits: 1 });
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="reveal card grid overflow-hidden md:grid-cols-2">
        <div className="space-y-8 p-8 md:p-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t.roi.title}</h2>
            <p className="mt-2 text-muted">{t.roi.sub}</p>
          </div>
          <Slider label={t.roi.reps} value={reps} set={setReps} min={10} max={500} step={10} show={num(reps, lang)} />
          <Slider label={t.roi.hours} value={hours} set={setHours} min={1} max={12} step={1} show={num(hours, lang)} />
          <Slider label={t.roi.cost} value={cost} set={setCost} min={100_000} max={1_000_000} step={50_000} show={num(cost, lang)} />
        </div>
        <div className="relative flex flex-col justify-center gap-8 overflow-hidden bg-gradient-to-br from-accent via-accent-2 to-accent-3 p-8 text-white md:p-10">
          <div className="absolute -end-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
          <div><p className="text-sm opacity-80">{t.roi.saved}</p><p className="text-5xl font-extrabold tabular-nums tracking-tight">{num(Math.round(saved), lang)}</p></div>
          <div><p className="text-sm opacity-80">{t.roi.value}</p><p className="text-4xl font-bold tabular-nums tracking-tight">{toman(value)} <span className="text-lg font-medium opacity-80">{lang === "fa" ? "تومان" : "Toman"}</span></p></div>
          <div><p className="text-sm opacity-80">{t.roi.roi}</p><p className="text-4xl font-bold tabular-nums">{num(roi, lang, { maximumFractionDigits: 1 })}×</p></div>
          <p className="text-xs opacity-70">{t.roi.note}</p>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const { t, lang } = useI18n();
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [yearly, setYearly] = useState(false);
  useEffect(() => { api<Plan[]>("/plans").then(setPlans).catch(() => {}); }, []);
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-24">
      <h2 className="reveal text-center text-4xl font-bold tracking-tight md:text-5xl">{t.pricing.title}</h2>
      <div className="reveal mx-auto mt-8 flex w-fit rounded-full bg-fg/5 p-1" role="radiogroup">
        {[false, true].map((y) => (
          <button key={String(y)} role="radio" aria-checked={yearly === y} onClick={() => setYearly(y)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${yearly === y ? "bg-solid shadow" : "text-muted"}`}>
            {y ? t.pricing.yearly : t.pricing.monthly}{y && <span className="ms-1.5 text-ok">{t.pricing.save}</span>}
          </button>
        ))}
      </div>
      <div className="mt-12 grid items-stretch gap-5 md:grid-cols-3">
        {plans.map((p) => {
          const price = p.price * (yearly ? 0.9 : 1);
          return (
            <div key={p.id} className={`reveal relative rounded-[1.75rem] p-px ${p.popular ? "bg-gradient-to-br from-accent via-accent-2 to-accent-3 shadow-2xl md:-translate-y-3" : "bg-line"}`}>
              <div className="flex h-full flex-col rounded-[calc(1.75rem-1px)] bg-solid p-8">
                {p.popular && <span className="mb-4 w-fit rounded-full bg-gradient-to-r from-accent to-accent-2 px-3 py-1 text-xs font-semibold text-white">{t.pricing.popular}</span>}
                <h3 className="text-lg font-semibold">{t.pricing.plans[p.id]}</h3>
                <p className="mt-4 text-4xl font-bold tabular-nums tracking-tight">
                  {num(price, lang, { notation: price >= 1e7 ? "compact" : "standard" })}
                  <span className="ms-1 text-base font-medium text-muted">{lang === "fa" ? "تومان" : "Toman"}</span>
                </p>
                <p className="mt-1 text-sm text-muted">{p.unit === "user" ? t.pricing.perUser : t.pricing.perOrg}</p>
                <ul className="mt-8 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent/12 text-accent"><Icon name="check" className="size-3" strokeWidth={3} /></span>
                      {t.pricing.features[f as keyof typeof t.pricing.features]}
                    </li>
                  ))}
                </ul>
                <a href="#demo" className={`btn mt-8 w-full ${p.popular ? "btn-primary" : "btn-ghost"}`}>{t.pricing.choose}</a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Compare() {
  const { t } = useI18n();
  // rows × [us, local CRM, messengers, global]; 2 = yes, 1 = partial, 0 = no
  const m = [[2, 1, 0, 2], [2, 0, 0, 1], [2, 1, 1, 2], [2, 2, 1, 0], [2, 2, 2, 0]];
  const mark = (v: number) => v === 2
    ? <span className="mx-auto grid size-6 place-items-center rounded-full bg-ok/15 text-ok"><Icon name="check" className="size-3.5" strokeWidth={3} /></span>
    : v === 1 ? <span className="mx-auto block h-1 w-3 rounded bg-warn" /> : <span className="mx-auto block size-1.5 rounded-full bg-muted/40" />;
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="reveal text-center text-3xl font-bold tracking-tight md:text-4xl">{t.compare.title}</h2>
      <div className="reveal card no-scrollbar mt-10 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="p-5 text-start font-medium text-muted" />
              {t.compare.cols.map((c, i) => <th key={c} className={`p-5 font-semibold ${i ? "text-muted" : "text-gradient"}`}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {t.compare.rows.map((r, i) => (
              <tr key={r} className="border-b border-line last:border-0">
                <td className="p-5 font-medium">{r}</td>
                {m[i].map((v, j) => <td key={j} className={`p-5 text-center ${j ? "" : "bg-accent/[0.04]"}`}>{mark(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Demo() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    try {
      await api("/demo", json("POST", { name: f.get("name"), company: f.get("company"), phone: f.get("phone"), team_size: Number(f.get("team")) }));
      toast(t.demo.ok);
      form.reset();
    } catch {
      toast(t.lib.error, "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section id="demo" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-24">
      <div className="reveal card relative overflow-hidden p-8 md:p-14">
        <div className="aurora !opacity-20" aria-hidden><span /><span /><span /></div>
        <div className="relative grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-4xl font-bold tracking-tight">{t.demo.title}</h2>
            <p className="mt-4 text-lg text-muted">{t.demo.sub}</p>
            <div className="mt-8 flex items-center gap-3 text-sm text-muted"><Icon name="shield" className="size-5 text-ok" />{t.stats[2][1]} · {t.stats[3][1]}</div>
          </div>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <input name="name" required minLength={2} placeholder={t.demo.name} className="field sm:col-span-2" autoComplete="name" />
            <input name="company" required minLength={2} placeholder={t.demo.company} className="field sm:col-span-2" autoComplete="organization" />
            <input name="phone" required type="tel" inputMode="tel" pattern="[0-9+\-\s۰-۹]{8,20}" placeholder={t.demo.phone} className="field" dir="ltr" autoComplete="tel" />
            <input name="team" required type="number" min={1} placeholder={t.demo.team} className="field" />
            <button disabled={busy} className="btn btn-primary mt-2 !py-3.5 sm:col-span-2">{t.demo.submit}</button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t, lang } = useI18n();
  return (
    <>
      <Hero />
      <Pillars />
      <Roi />
      <Pricing />
      <Compare />
      <Demo />
      <footer className="border-t border-line py-10 text-center text-xs text-muted">
        <p>© {num(lang === "fa" ? 1405 : 2026, lang, { useGrouping: false })} {t.brand}</p>
        <p className="mx-auto mt-2 max-w-md px-4">{t.footer}</p>
      </footer>
    </>
  );
}
