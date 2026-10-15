"use client";
import { useEffect, useState } from "react";
import { api, json, type Me } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Sheet } from "./ui";

let me: Promise<Me> | null = null; // one /api/me per page load, shared by every caller

/** Who is logged in. null while loading; { user: null } when logged out. The server enforces roles; this only hides controls. */
export function useMe() {
  const [state, setState] = useState<Me | null>(null);
  useEffect(() => {
    (me ??= api<Me>("/me").catch(() => ({ user: null, role: null }))).then(setState);
  }, []);
  return state;
}

export async function logout() {
  await api("/logout", { method: "POST" }).catch(() => {});
  location.assign("/");
}

/** Opens whenever any API call answers 401 (see lib/api.ts). */
export function LoginSheet() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    addEventListener("auth", show);
    return () => removeEventListener("auth", show);
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/login", json("POST", { username: f.get("username"), password: f.get("password") }));
      location.reload(); // every page refetches with the new session
    } catch (x) {
      setError((x as Error).message === "429" ? t.auth.tooMany : t.auth.bad);
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={() => setOpen(false)} label={t.auth.title}>
      <form onSubmit={submit} className="space-y-4 p-6 pt-8 pb-safe" data-grab>
        <h2 className="text-2xl font-bold tracking-tight">{t.auth.title}</h2>
        <input name="username" required maxLength={40} autoComplete="username" autoCapitalize="none" spellCheck={false}
          placeholder={t.auth.user} aria-label={t.auth.user} className="field" dir="ltr" />
        <input name="password" type="password" required maxLength={200} autoComplete="current-password"
          placeholder={t.auth.pass} aria-label={t.auth.pass} className="field" dir="ltr"
          aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} />
        {error && <p id="login-error" role="alert" className="text-sm font-medium text-[#ff453a]">{error}</p>}
        <button disabled={busy} className="btn btn-primary w-full !py-3.5">{t.auth.submit}</button>
      </form>
    </Sheet>
  );
}
