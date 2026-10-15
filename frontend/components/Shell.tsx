"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { logout, useMe } from "./Auth";
import { Icon } from "./ui";

function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"), []);

  const toggle = (e: React.MouseEvent) => {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = next;
      setTheme(next);
      try { localStorage.setItem("theme", next); } catch {}
    };
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    const { clientX: x, clientY: y } = e;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add("vt-theme");
    const vt = document.startViewTransition(apply);
    vt.ready.then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)", pseudoElement: "::view-transition-new(root)" },
      ),
    );
    vt.finished.finally(() => root.classList.remove("vt-theme"));
  };

  return (
    <button onClick={toggle} className="btn btn-ghost size-10 !p-0" aria-label={theme === "dark" ? t.theme.light : t.theme.dark}>
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button onClick={() => setLang(lang === "fa" ? "en" : "fa")} className="btn btn-ghost h-10 !px-3 text-sm" aria-label="Language">
      <Icon name="globe" className="size-4" />
      {lang === "fa" ? "EN" : "فا"}
    </button>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const path = usePathname();
  const me = useMe();
  const external = path.startsWith("/s/"); // share-link recipients never see internal navigation
  const links = [
    { href: "/", label: t.nav.home, icon: "home" },
    { href: "/dashboard", label: t.nav.dashboard, icon: "chart" },
    { href: "/library", label: t.nav.library, icon: "layers" },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
        <nav className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-accent via-accent-2 to-accent-3 text-white shadow-lg">
              <Icon name="bolt" className="size-4.5" strokeWidth={2.2} />
            </span>
            <span className="text-[17px]">{t.brand}</span>
          </Link>
          <div className={`mx-auto hidden items-center gap-1 ${external ? "" : "md:flex"}`}>
            {links.map((l) => (
              <Link key={l.href} href={l.href}
                className={`rounded-full px-4 py-1.5 text-sm transition ${active(l.href) ? "bg-fg text-bg font-semibold" : "text-muted hover:text-fg"}`}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className={`ms-auto flex items-center gap-1.5 ${external ? "" : "md:ms-0"}`}>
            <LangToggle />
            <ThemeToggle />
            {me?.user && !external && (
              <button onClick={logout} className="btn btn-ghost size-10 !p-0" aria-label={t.auth.logout} title={`${t.auth.logout} (${me.user})`}>
                <Icon name="logout" className="size-[18px] rtl:-scale-x-100" />
              </button>
            )}
          </div>
        </nav>
      </header>

      <main className={`flex-1 md:pb-0 ${external ? "" : "pb-24"}`}>{children}</main>

      {/* iOS-style tab bar on phones */}
      {!external && <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-x-0 border-b-0 pt-1.5 md:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`flex flex-col items-center gap-0.5 text-[11px] font-medium transition ${active(l.href) ? "text-accent" : "text-muted"}`}>
            <Icon name={l.icon} className="size-6" strokeWidth={active(l.href) ? 2.2 : 1.7} />
            {l.label}
          </Link>
        ))}
      </nav>}
    </>
  );
}
