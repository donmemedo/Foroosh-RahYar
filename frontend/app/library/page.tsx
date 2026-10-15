"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { date, num, useI18n } from "@/lib/i18n";
import { api, json, type Content, type Me } from "@/lib/api";
import { useMe } from "@/components/Auth";
import { CAT_GRAD, Icon, Sheet, toast } from "@/components/ui";

const CATS = ["deck", "catalog", "video", "case", "pricing", "playbook"] as const;
const MAX_UPLOAD = 10 * 1024 * 1024; // keep in step with backend/main.py
const ACCEPT = ".pdf,.pptx,.docx,.xlsx,.mp4,.png,.jpg,.jpeg,.webp"; // backend allow-list (also checked by magic bytes there)
const failed = (e: unknown) => (e as Error).message !== "401" && (e as Error).name !== "AbortError"; // 401 opens login instead

export default function Library() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Content[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<Content | null>(null);
  const [uploading, setUploading] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const me = useMe();

  const load = useCallback((signal?: AbortSignal) => {
    const p = new URLSearchParams({ q, category: cat, status });
    api<Content[]>(`/content?${p}`, { signal }).then(setItems).catch((e) => {
      if (!failed(e)) return; // a newer search replaced this one, or login is needed
      setItems([]);
      toast(t.lib.error, "err");
    });
  }, [q, cat, status, t]);

  // Debounced search; an older, slower response can never overwrite a newer one.
  useEffect(() => {
    const ac = new AbortController();
    const id = setTimeout(() => load(ac.signal), 180);
    return () => { clearTimeout(id); ac.abort(); };
  }, [load]);

  // Internal deep links (?c=id) open the item directly
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("c");
    if (id) api<Content>(`/content/${encodeURIComponent(id)}`).then(setOpen).catch(() => {});
  }, []);

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); search.current?.focus(); } };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, []);

  const title = (c: Content) => (lang === "fa" ? c.title_fa : c.title_en);
  const n = (v: number) => num(v, lang);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${active ? "bg-fg text-bg" : "bg-fg/5 text-muted hover:text-fg"}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t.lib.title}</h1>
          {items && <p className="mt-2 text-muted">{n(items.length)} {t.dash.kpis.content}</p>}
        </div>
        <button onClick={() => setUploading(true)} className="btn btn-primary"><Icon name="plus" className="size-4" strokeWidth={2.5} />{t.lib.upload}</button>
      </header>

      <div className="rise sticky top-14 z-30 -mx-4 mt-6 space-y-3 bg-bg/80 px-4 py-3 backdrop-blur-xl" style={{ animationDelay: "80ms" }}>
        <label className="relative block">
          <Icon name="search" className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.lib.search} type="search"
            className="field !rounded-2xl !py-3.5 !ps-12 !pe-16 text-base" />
          <kbd className="absolute end-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 text-xs text-muted md:block">⌘K</kbd>
        </label>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <button className={chip(!cat)} onClick={() => setCat("")}>{t.lib.all}</button>
          {CATS.map((c) => <button key={c} className={chip(cat === c)} onClick={() => setCat(cat === c ? "" : c)}>{t.lib.cats[c]}</button>)}
          <span className="mx-1 w-px shrink-0 bg-line" />
          {(["approved", "pending"] as const).map((s) => (
            <button key={s} className={chip(status === s)} onClick={() => setStatus(status === s ? "" : s)}>{t.lib[s]}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((c, i) => (
          <button key={c.id} onClick={() => api<Content>(`/content/${c.id}`).then(setOpen).catch(() => toast(t.lib.error, "err"))}
            className="rise card group overflow-hidden text-start transition duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98] active:duration-75"
            style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
            <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${CAT_GRAD[c.category]}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.35),transparent_60%)]" />
              <Icon name={c.category} className="size-14 text-white/95 drop-shadow-lg transition duration-500 group-hover:scale-110" strokeWidth={1.4} />
              <span className="glass absolute start-3 top-3 rounded-full !border-white/20 !bg-black/20 px-2.5 py-1 text-xs font-semibold text-white">
                {t.lib.version} {n(c.version)}
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold leading-snug">{title(c)}</h3>
                <Status s={c.status} />
              </div>
              <p className="mt-1 text-sm text-muted">{t.lib.cats[c.category]} · {date(c.updated_at, lang)}</p>
              <div className="mt-4 flex gap-4 text-sm text-muted tabular-nums">
                <span className="flex items-center gap-1.5"><Icon name="eye" className="size-4" />{n(c.views)}</span>
                <span className="flex items-center gap-1.5"><Icon name="share" className="size-4" />{n(c.shares)}</span>
              </div>
            </div>
          </button>
        )) ?? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-64" />)}
      </div>
      {items?.length === 0 && (
        <div className="py-24 text-center text-muted">
          <Icon name="search" className="mx-auto mb-4 size-10 opacity-40" />
          {t.lib.empty}
        </div>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} label={open ? title(open) : ""}>
        {open && <Detail c={open} me={me} onChange={(c) => { setOpen(c); load(); }} onDeleted={() => { setOpen(null); load(); }} />}
      </Sheet>
      <Sheet open={uploading} onClose={() => setUploading(false)} label={t.lib.upload}>
        <Upload onDone={() => { setUploading(false); load(); }} onCancel={() => setUploading(false)} />
      </Sheet>
    </div>
  );
}

function Status({ s }: { s: Content["status"] }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s === "approved" ? "bg-ok/12 text-ok" : "bg-warn/15 text-warn"}`}>
      <span className={`size-1.5 rounded-full ${s === "approved" ? "bg-ok" : "animate-pulse bg-warn"}`} />
      {t.lib[s]}
    </span>
  );
}

function Detail({ c, me, onChange, onDeleted }: { c: Content; me: Me | null; onChange: (c: Content) => void; onDeleted: () => void }) {
  const { t, lang } = useI18n();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const n = (v: number) => num(v, lang);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch { toast(t.lib.error, "err"); } finally { setBusy(false); }
  };
  const refresh = async () => onChange(await api<Content>(`/content/${c.id}`));

  const admin = me?.role === "admin";
  const approved = c.status === "approved";

  // Customers get a revocable token link to this item only, never the internal library URL.
  const share = () => run(async () => {
    const { token } = await api<{ token: string }>(`/content/${c.id}/share`, { method: "POST" });
    const url = `${location.origin}/s/${token}`;
    if (navigator.share) await navigator.share({ title: lang === "fa" ? c.title_fa : c.title_en, url }).catch(() => {});
    else if (await navigator.clipboard?.writeText(url).then(() => true, () => false)) toast(t.lib.copied);
    else prompt(t.lib.copyHere, url); // plain-http intranets have no clipboard API
    await refresh();
  });

  return (
    <div className="max-h-[92dvh] overflow-y-auto">
      <div data-grab className={`relative flex h-44 touch-none items-center justify-center bg-gradient-to-br ${CAT_GRAD[c.category]}`}>
        <Icon name={c.category} className="size-20 text-white drop-shadow-xl" strokeWidth={1.3} />
        <form method="dialog" className="absolute end-3 top-3">
          <button className="glass grid size-9 place-items-center rounded-full !border-white/20 !bg-black/25 text-white" aria-label={t.lib.cancel}><Icon name="x" className="size-4" strokeWidth={2.5} /></button>
        </form>
      </div>
      <div className="space-y-6 p-6 pb-safe">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{lang === "fa" ? c.title_fa : c.title_en}</h2>
            <Status s={c.status} />
          </div>
          <p className="mt-1 text-sm text-muted">{lang === "fa" ? c.title_en : c.title_fa}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[[t.lib.version, n(c.version)], [t.lib.views, n(c.views)], [t.lib.shares, n(c.shares)]].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-fg/5 p-3"><p className="text-xl font-bold tabular-nums">{v}</p><p className="text-xs text-muted">{l}</p></div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {approved && <button disabled={busy} onClick={share} className="btn btn-primary flex-1"><Icon name="share" className="size-4" />{t.lib.share}</button>}
          {admin && !approved && (
            <button disabled={busy} className="btn btn-ghost flex-1 !text-ok"
              onClick={() => run(async () => { await api(`/content/${c.id}/approve`, { method: "POST" }); await refresh(); toast(t.lib.approvedToast); })}>
              <Icon name="check" className="size-4" strokeWidth={2.5} />{t.lib.approve}
            </button>
          )}
          {c.file && (approved || admin) && <a href={`/api/content/${c.id}/file`} className="btn btn-ghost flex-1"><Icon name="download" className="size-4" />{t.lib.download}</a>}
        </div>

        <form className="flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          run(async () => { await api(`/content/${c.id}/versions`, json("POST", { note })); setNote(""); await refresh(); toast(t.lib.versionToast); });
        }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} required maxLength={200} placeholder={`${t.lib.newVersion} — ${t.lib.notePh}`} className="field" />
          <button disabled={busy || !note.trim()} className="btn btn-ghost">{t.lib.add}</button>
        </form>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-muted">{t.lib.history}</h3>
          <ol className="relative space-y-4 border-s-2 border-line ps-5">
            {c.versions?.map((v, i) => (
              <li key={v.version} className="relative">
                <span className={`absolute -start-[27px] top-1 size-3 rounded-full ring-4 ring-[var(--card-solid)] ${i ? "bg-muted/40" : "bg-accent"}`} />
                <p className="text-sm font-medium">{t.lib.version} {n(v.version)} · <span className="font-normal">{v.note}</span></p>
                <p className="text-xs text-muted">{date(v.created_at, lang, { year: "numeric", month: "long", day: "numeric" })}</p>
              </li>
            ))}
          </ol>
        </section>

        {admin && approved && (
          <button disabled={busy} className="btn btn-ghost w-full"
            onClick={() => run(async () => { await api(`/content/${c.id}/shares`, { method: "DELETE" }); toast(t.lib.revoked); })}>
            <Icon name="link" className="size-4" />{t.lib.revoke}
          </button>
        )}
        {admin && (
          <button disabled={busy} className="btn btn-danger w-full"
            onClick={() => confirm(t.lib.delAsk) && run(async () => { await api(`/content/${c.id}`, { method: "DELETE" }); toast(t.lib.deleted); onDeleted(); })}>
            <Icon name="trash" className="size-4" />{t.lib.del}
          </button>
        )}
      </div>
    </div>
  );
}

function Upload({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (file && file.size > MAX_UPLOAD) return toast(t.lib.tooBig, "err"); // fail fast, before 10 MB crosses the network
    if (file) f.set("file", file); else f.delete("file");
    setBusy(true);
    try {
      await api("/content", { method: "POST", body: f });
      toast(t.lib.uploaded);
      onDone();
    } catch (x) {
      const code = (x as Error).message;
      if (code !== "401") toast(code === "415" ? t.lib.badType : code === "413" ? t.lib.tooBig : t.lib.error, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-6 pt-8 pb-safe">
      <h2 data-grab className="touch-none text-2xl font-bold tracking-tight">{t.lib.upload}</h2>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0] ?? null); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-8 text-center transition ${drag ? "border-accent bg-accent/5" : "border-line"}`}>
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white"><Icon name="upload" /></span>
        <span className="text-sm font-medium">{file ? file.name : t.lib.drop}</span>
        <span className="text-xs text-muted">{t.lib.fileHint}</span>
        <input name="file" type="file" accept={ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <input name="title_fa" required maxLength={120} placeholder={t.lib.titleFa} className="field" dir="rtl" />
      <input name="title_en" required maxLength={120} placeholder={t.lib.titleEn} className="field" dir="ltr" />
      <select name="category" required className="field" defaultValue="deck" aria-label={t.lib.category}>
        {CATS.map((c) => <option key={c} value={c}>{t.lib.cats[c]}</option>)}
      </select>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">{t.lib.cancel}</button>
        <button disabled={busy} className="btn btn-primary flex-1">{t.lib.save}</button>
      </div>
    </form>
  );
}
