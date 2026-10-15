"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { date, num, useI18n } from "@/lib/i18n";
import { api, type Analytics } from "@/lib/api";
import { AreaChart, Bars } from "@/components/Charts";
import { CAT_GRAD, CountUp, Icon } from "@/components/ui";

export default function Dashboard() {
  const { t, lang } = useI18n();
  const [a, setA] = useState<Analytics | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api<Analytics>("/analytics").then(setA).catch((e) => e.message !== "401" && setErr(true)); }, []); // 401 opens login

  const hour = new Date().getHours();
  const hello = t.dash.hello[hour < 12 ? 0 : hour < 18 ? 1 : 2];
  const n = (v: number) => num(v, lang);
  const title = (x: { title_en: string; title_fa: string }) => (lang === "fa" ? x.title_fa : x.title_en);

  const kpis = a && [
    { k: "views", v: a.kpis.views, icon: "eye", g: CAT_GRAD.deck, f: n },
    { k: "shares", v: a.kpis.shares, icon: "share", g: CAT_GRAD.catalog, f: n },
    { k: "share_rate", v: a.kpis.share_rate, icon: "chart", g: CAT_GRAD.case, f: (x: number) => `${n(x)}٪` },
    { k: "content", v: a.kpis.content, icon: "layers", g: CAT_GRAD.playbook, f: n },
    { k: "pending", v: a.kpis.pending, icon: "check", g: CAT_GRAD.video, f: n },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <header className="rise">
        <p suppressHydrationWarning className="text-sm text-muted">{date(new Date().toISOString(), lang, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 suppressHydrationWarning className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">{hello}</h1>
        <p className="mt-2 text-muted">{t.dash.sub}</p>
      </header>

      {err && <p className="card mt-8 p-6 text-center text-muted">{t.lib.error}</p>}

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        {kpis ? kpis.map((k, i) => (
          <div key={k.k} className={`rise card p-5 ${i === 4 ? "col-span-2 md:col-span-1" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
            <span className={`grid size-9 place-items-center rounded-xl bg-gradient-to-br ${k.g} text-white`}><Icon name={k.icon} className="size-4.5" /></span>
            <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight"><CountUp value={k.v} format={k.f} /></p>
            <p className="mt-0.5 text-sm text-muted">{t.dash.kpis[k.k]}</p>
          </div>
        )) : Array.from({ length: 5 }, (_, i) => <div key={i} className={`skeleton h-36 ${i === 4 ? "col-span-2 md:col-span-1" : ""}`} />)}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rise card p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold">{t.dash.trend}</h2>
          {a ? <AreaChart data={a.series} fmtNum={n} fmtDate={(d) => date(d, lang, { weekday: "short", month: "short", day: "numeric" })} labels={[t.dash.kpis.views, t.dash.kpis.shares]} />
            : <div className="skeleton h-64" />}
        </section>

        <section className="rise card p-6">
          <h2 className="mb-5 font-semibold">{t.dash.cats}</h2>
          {a ? <Bars items={a.categories.map((c) => ({ label: t.lib.cats[c.category], value: c.views, display: n(c.views), grad: CAT_GRAD[c.category] }))} />
            : <div className="skeleton h-56" />}
        </section>

        <section className="rise card p-6 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t.dash.top}</h2>
            <Link href="/library" className="text-sm font-medium text-accent">{t.nav.library} <span className="rtl:hidden">→</span><span className="ltr:hidden">←</span></Link>
          </div>
          <ol className="divide-y divide-line">
            {a?.top.map((c, i) => (
              <li key={c.id} className="flex items-center gap-4 py-3">
                <span className="w-5 text-center text-sm font-semibold text-muted tabular-nums">{n(i + 1)}</span>
                <span className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${CAT_GRAD[c.category]} text-white`}><Icon name={c.category} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{title(c)}</p>
                  <p className="text-xs text-muted">{t.lib.cats[c.category]} · {t.lib.version} {n(c.version)}</p>
                </div>
                <div className="text-end text-sm tabular-nums">
                  <p className="font-semibold">{n(c.views)}</p>
                  <p className="text-xs text-muted">{n(c.shares)} {t.lib.shares}</p>
                </div>
              </li>
            )) ?? Array.from({ length: 5 }, (_, i) => <li key={i} className="skeleton my-2 h-12" />)}
          </ol>
        </section>

        <section className="rise card p-6">
          <h2 className="mb-3 font-semibold">{t.dash.recent}</h2>
          <ul className="space-y-4">
            {a?.recent.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${r.type === "share" ? "bg-accent-3/15 text-accent-3" : "bg-accent/12 text-accent"}`}>
                  <Icon name={r.type === "share" ? "share" : "eye"} className="size-4" />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="truncate"><span className="font-medium">{title(r)}</span> {r.type === "share" ? t.dash.shared : t.dash.viewed}</p>
                  <p className="text-xs text-muted">{date(r.ts, lang, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </li>
            )) ?? <li className="skeleton h-48" />}
          </ul>
        </section>
      </div>
    </div>
  );
}
