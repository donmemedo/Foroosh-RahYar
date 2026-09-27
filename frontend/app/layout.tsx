import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider, type Lang } from "@/lib/i18n";
import { Shell } from "@/components/Shell";
import { Toaster } from "@/components/ui";

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

const themeScript = `try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang: Lang = (await cookies()).get("lang")?.value === "en" ? "en" : "fa";
  return (
    <html lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300..900&display=swap" rel="stylesheet" />
      </head>
      <body className="flex min-h-dvh flex-col">
        <I18nProvider initial={lang}>
          <Shell>{children}</Shell>
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
