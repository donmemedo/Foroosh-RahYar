export type Content = {
  id: string;
  title_en: string;
  title_fa: string;
  category: "deck" | "catalog" | "video" | "case" | "pricing" | "playbook";
  status: "approved" | "pending";
  version: number;
  size_mb: number;
  file: string | null;
  updated_at: string;
  views: number;
  shares: number;
  versions?: { version: number; note: string; created_at: string }[];
};

export type Analytics = {
  kpis: { content: number; views: number; shares: number; pending: number; share_rate: number };
  series: { date: string; views: number; shares: number }[];
  top: Content[];
  categories: { category: Content["category"]; views: number }[];
  recent: { type: "view" | "share"; ts: string; title_en: string; title_fa: string }[];
};

export type Plan = { id: "professional" | "premium" | "enterprise"; price: number; unit: "user" | "org"; popular?: boolean; features: string[] };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`${res.status}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

export const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
