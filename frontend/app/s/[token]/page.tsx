"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { date, num, useI18n } from "@/lib/i18n";
import { api, type Shared } from "@/lib/api";
import { CAT_GRAD, Icon } from "@/components/ui";

/** What a customer sees when a rep shares an item: that item only, no login, no internal navigation. */
export default function SharedItem() {
  const { token } = useParams<{ token: string }>();
  const { t, lang } = useI18n();
  const [item, setItem] = useState<Shared | null | false>(null); // null loading, false gone
  const path = `/s/${encodeURIComponent(token)}`;

  useEffect(() => { api<Shared>(path).then(setItem).catch(() => setItem(false)); }, [path]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10 md:py-16">
      {item === null && <div className="skeleton h-96" />}
      {item === false && (
        <div className="card rise p-10 text-center text-muted">
          <Icon name="link" className="mx-auto mb-4 size-10 opacity-40" />
          {t.shared.gone}
        </div>
      )}
      {item && (
        <article className="card rise overflow-hidden">
          <div className={`relative flex h-48 items-center justify-center bg-gradient-to-br ${CAT_GRAD[item.category]}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.35),transparent_60%)]" />
            <Icon name={item.category} className="size-20 text-white drop-shadow-xl" strokeWidth={1.3} />
          </div>
          <div className="space-y-6 p-6 md:p-8">
            <div>
              <p className="text-sm font-medium text-muted">{t.shared.eyebrow}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">{lang === "fa" ? item.title_fa : item.title_en}</h1>
              <p className="mt-2 text-sm text-muted">
                {t.lib.cats[item.category]} · {t.lib.version} {num(item.version, lang)} · {t.shared.updated} {date(item.updated_at, lang, { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            {item.has_file && (
              <a href={`/api${path}/file`} className="btn btn-primary w-full !py-3.5 text-base">
                <Icon name="download" className="size-4" />{t.lib.download}
              </a>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
