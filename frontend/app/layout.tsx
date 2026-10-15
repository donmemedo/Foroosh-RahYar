import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { I18nProvider, type Lang } from "@/lib/i18n";
import { Shell } from "@/components/Shell";
import { LoginSheet } from "@/components/Auth";
import { Toaster } from "@/components/ui";

// Self-hosted (SIL OFL, see fonts/OFL.txt): no request to Google, works where Google is blocked, preloaded.
const vazirmatn = localFont({ src: "./fonts/Vazirmatn-wght.woff2", weight: "100 900", display: "swap", variable: "--font-vazirmatn" });

export const metadata: Metadata = {
  title: "Tavanfroosh · توان‌فروش",
  description: "Sales enablement platform for Iranian sales teams — content library, approvals and analytics.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Static string, never interpolated with user data. Runs before paint to avoid a theme flash.
const themeScript = `try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang: Lang = (await cookies()).get("lang")?.value === "en" ? "en" : "fa";
  const nonce = (await headers()).get("x-nonce") ?? undefined; // set per request by proxy.ts (CSP)
  return (
    <html lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} className={vazirmatn.variable} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <I18nProvider initial={lang}>
          <Shell>{children}</Shell>
          <LoginSheet />
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
