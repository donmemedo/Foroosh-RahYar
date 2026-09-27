"use client";
import { createContext, useCallback, useContext, useState } from "react";

export type Lang = "fa" | "en";

// Persian copy follows the Persian UX-writing vocabulary (پیش‌خوان، جستجو، حذف، تایید، در حال بررسی، دریافت…)
const dict = {
  en: {
    brand: "Tavanfroosh",
    nav: { home: "Home", dashboard: "Dashboard", library: "Library" },
    theme: { light: "Light", dark: "Dark" },
    hero: {
      eyebrow: "Sales enablement, built for Iran",
      title1: "The right content.",
      title2: "At the moment of sale.",
      sub: "One secure home for decks, catalogs and videos. Marketing stays in control, sales always has the latest version, and managers see what actually closes deals.",
      cta: "Book a demo",
      cta2: "Open the dashboard",
    },
    stats: [
      ["2,000+", "target companies"],
      ["80,000", "potential sales users"],
      ["100%", "hosted inside Iran"],
      ["24/7", "Persian support"],
    ],
    pillars: {
      title: "Three superpowers. One platform.",
      items: [
        ["Available everywhere", "Web, tablet and phone — online or offline. Every rep carries the whole library in their pocket."],
        ["Alignment", "Marketing approves, sales is notified. No more outdated PDFs in messengers."],
        ["Reporting", "See which content is viewed, shared and tied to revenue — then double down."],
      ],
    },
    industries: { title: "Made for teams that sell in the field", list: ["Distribution", "FMCG", "Pharma", "Medical devices", "Construction", "Banking & insurance", "Technology"] },
    roi: {
      title: "Calculate your return",
      sub: "Estimate the time your team gets back every month.",
      reps: "Sales reps",
      hours: "Hours / week searching for content",
      cost: "Hourly cost per rep (Toman)",
      saved: "Hours saved / month",
      value: "Value recovered / month",
      roi: "Return on plan cost",
      note: "Assumes 60% of search time is recovered, on the Premium plan.",
    },
    pricing: {
      title: "Simple pricing. Serious value.",
      monthly: "Monthly",
      yearly: "Yearly",
      save: "−10%",
      perUser: "per user / month",
      perOrg: "from, per month",
      popular: "Most popular",
      choose: "Get started",
      plans: { professional: "Professional", premium: "Premium", enterprise: "Enterprise" },
      features: {
        library: "Versioned content library",
        mobile: "Web & mobile apps",
        search: "Instant search",
        analytics_basic: "Usage reports",
        workflow: "Approval workflow",
        analytics_full: "Content ROI analytics",
        crm: "Iranian CRM integration",
        everything: "Everything in Premium",
        private_cloud: "Private cloud / on-prem",
        sso: "SSO & role-based access",
        sla: "Dedicated SLA",
        onboarding: "Onboarding & training",
      },
    },
    compare: {
      title: "Why not just a CRM or a messenger?",
      cols: ["Tavanfroosh", "Local CRMs", "Messengers & Drive", "Global suites"],
      rows: ["Content version control", "Content ROI analytics", "Offline mobile access", "Hosted in Iran", "Persian support"],
    },
    demo: {
      title: "See it with your own content",
      sub: "A paid 5-day pilot with your real material. Most teams decide in a week.",
      name: "Full name",
      company: "Company",
      phone: "Mobile number",
      team: "Sales team size",
      submit: "Request a demo",
      ok: "Request received. We'll call you soon.",
    },
    footer: "A hypothetical localized concept based on the Showpad business model. Not an official Showpad product.",
    dash: {
      hello: ["Good morning", "Good afternoon", "Good evening"],
      sub: "Here's how your content performed in the last 30 days.",
      kpis: { content: "Content", views: "Views", shares: "Shares", share_rate: "Share rate", pending: "Pending approval" },
      trend: "Engagement",
      top: "Top content",
      cats: "By category",
      recent: "Recent activity",
      viewed: "viewed",
      shared: "shared",
    },
    lib: {
      title: "Content library",
      search: "Search content…",
      all: "All",
      approved: "Approved",
      pending: "Pending",
      upload: "Upload",
      empty: "Nothing here yet. Try another search.",
      version: "Version",
      views: "views",
      shares: "shares",
      share: "Share",
      approve: "Approve",
      newVersion: "New version",
      notePh: "What changed?",
      add: "Add",
      download: "Download",
      del: "Delete",
      delAsk: "Delete this content? This can't be undone.",
      history: "Version history",
      titleEn: "Title (English)",
      titleFa: "Title (Persian)",
      category: "Category",
      file: "File",
      drop: "Drop a file here or tap to choose",
      cancel: "Cancel",
      save: "Upload",
      copied: "Link copied and share recorded",
      approvedToast: "Approved — sales team notified",
      uploaded: "Uploaded — waiting for approval",
      deleted: "Deleted",
      versionToast: "New version sent for approval",
      error: "Something went wrong. Please try again.",
      cats: { deck: "Decks", catalog: "Catalogs", video: "Videos", case: "Case studies", pricing: "Pricing", playbook: "Playbooks" },
    },
  },
  fa: {
    brand: "توان‌فروش",
    nav: { home: "خانه", dashboard: "پیش‌خوان", library: "کتابخانه" },
    theme: { light: "روشن", dark: "تیره" },
    hero: {
      eyebrow: "توانمندسازی فروش، ساخته‌شده برای ایران",
      title1: "محتوای درست،",
      title2: "در لحظه فروش.",
      sub: "یک خانه امن برای ارائه‌ها، کاتالوگ‌ها و ویدیوها. مارکتینگ کنترل را در دست دارد، تیم فروش همیشه آخرین نسخه را دارد و مدیران می‌بینند چه چیزی واقعا فروش می‌سازد.",
      cta: "درخواست دمو",
      cta2: "ورود به پیش‌خوان",
    },
    stats: [
      ["+۲٬۰۰۰", "شرکت هدف"],
      ["۸۰٬۰۰۰", "کاربر فروش بالقوه"],
      ["٪۱۰۰", "میزبانی داخل ایران"],
      ["۲۴/۷", "پشتیبانی فارسی"],
    ],
    pillars: {
      title: "سه ابرقدرت. یک پلتفرم.",
      items: [
        ["همه‌جا در دسترس", "وب، تبلت و موبایل؛ آنلاین یا آفلاین. هر نماینده فروش کل کتابخانه را در جیبش دارد."],
        ["هم‌راستایی", "مارکتینگ تایید می‌کند، تیم فروش باخبر می‌شود. دیگر خبری از PDFهای قدیمی در پیام‌رسان‌ها نیست."],
        ["گزارش‌ها", "ببینید کدام محتوا دیده، اشتراک‌گذاری و به فروش تبدیل شده است؛ بعد روی همان سرمایه‌گذاری کنید."],
      ],
    },
    industries: { title: "برای تیم‌هایی که در میدان می‌فروشند", list: ["پخش", "FMCG", "دارو", "تجهیزات پزشکی", "مصالح ساختمانی", "بانک و بیمه", "فناوری"] },
    roi: {
      title: "بازگشت سرمایه‌تان را حساب کنید",
      sub: "ببینید تیمتان هر ماه چقدر زمان پس می‌گیرد.",
      reps: "تعداد نمایندگان فروش",
      hours: "ساعت جستجوی محتوا در هفته",
      cost: "هزینه هر ساعت نماینده (تومان)",
      saved: "ساعت صرفه‌جویی در ماه",
      value: "ارزش بازگشتی در ماه",
      roi: "بازگشت نسبت به هزینه",
      note: "با فرض بازگشت ٪۶۰ از زمان جستجو، روی طرح پریمیوم.",
    },
    pricing: {
      title: "قیمت ساده. ارزش جدی.",
      monthly: "ماهانه",
      yearly: "سالانه",
      save: "٪۱۰−",
      perUser: "هر کاربر / ماه",
      perOrg: "از، در ماه",
      popular: "محبوب‌ترین",
      choose: "شروع کنید",
      plans: { professional: "حرفه‌ای", premium: "پریمیوم", enterprise: "سازمانی" },
      features: {
        library: "کتابخانه محتوا با نسخه‌بندی",
        mobile: "اپ وب و موبایل",
        search: "جستجوی لحظه‌ای",
        analytics_basic: "گزارش استفاده",
        workflow: "فرایند تایید محتوا",
        analytics_full: "گزارش بازگشت سرمایه محتوا",
        crm: "اتصال به CRMهای ایرانی",
        everything: "همه امکانات پریمیوم",
        private_cloud: "ابر خصوصی / میزبانی در سازمان",
        sso: "ورود یکپارچه و سطح دسترسی",
        sla: "SLA اختصاصی",
        onboarding: "همراه‌سازی و آموزش",
      },
    },
    compare: {
      title: "چرا فقط CRM یا پیام‌رسان کافی نیست؟",
      cols: ["توان‌فروش", "CRMهای داخلی", "پیام‌رسان و درایو", "راهکارهای جهانی"],
      rows: ["کنترل نسخه محتوا", "گزارش بازگشت سرمایه محتوا", "دسترسی آفلاین در موبایل", "میزبانی داخل ایران", "پشتیبانی فارسی"],
    },
    demo: {
      title: "با محتوای خودتان ببینید",
      sub: "یک پایلوت ۵ روزه با محتوای واقعی شما. بیشتر تیم‌ها ظرف یک هفته تصمیم می‌گیرند.",
      name: "نام و نام خانوادگی",
      company: "نام شرکت",
      phone: "شماره موبایل",
      team: "تعداد نیروی فروش",
      submit: "ثبت درخواست دمو",
      ok: "درخواستتان ثبت شد. به‌زودی با شما تماس می‌گیریم.",
    },
    footer: "این یک طرح مفهومی و بومی‌شده بر پایه مدل کسب‌وکار Showpad است و محصول رسمی Showpad نیست.",
    dash: {
      hello: ["صبح بخیر", "عصر بخیر", "شب بخیر"],
      sub: "عملکرد محتوای شما در ۳۰ روز گذشته.",
      kpis: { content: "محتوا", views: "بازدید", shares: "اشتراک‌گذاری", share_rate: "نرخ اشتراک‌گذاری", pending: "در حال بررسی" },
      trend: "میزان تعامل",
      top: "پربازدیدترین‌ها",
      cats: "بر اساس دسته‌بندی",
      recent: "آخرین فعالیت‌ها",
      viewed: "بازدید شد",
      shared: "اشتراک‌گذاری شد",
    },
    lib: {
      title: "کتابخانه محتوا",
      search: "جستجو در محتوا…",
      all: "همه",
      approved: "تاییدشده",
      pending: "در حال بررسی",
      upload: "افزودن",
      empty: "چیزی پیدا نشد. عبارت دیگری را جستجو کنید.",
      version: "نسخه",
      views: "بازدید",
      shares: "اشتراک",
      share: "اشتراک‌گذاری",
      approve: "تایید",
      newVersion: "نسخه جدید",
      notePh: "چه چیزی تغییر کرده؟",
      add: "افزودن",
      download: "دریافت",
      del: "حذف",
      delAsk: "این محتوا حذف شود؟ این کار برگشت‌پذیر نیست.",
      history: "تاریخچه نسخه‌ها",
      titleEn: "عنوان (انگلیسی)",
      titleFa: "عنوان (فارسی)",
      category: "دسته‌بندی",
      file: "فایل",
      drop: "فایل را اینجا رها کنید یا برای انتخاب بزنید",
      cancel: "انصراف",
      save: "بارگذاری",
      copied: "پیوند کپی شد و اشتراک‌گذاری ثبت شد",
      approvedToast: "تایید شد؛ تیم فروش باخبر شد",
      uploaded: "بارگذاری شد؛ در انتظار تایید",
      deleted: "حذف شد",
      versionToast: "نسخه جدید برای تایید ارسال شد",
      error: "مشکلی پیش آمد. لطفا دوباره تلاش کنید.",
      cats: { deck: "ارائه‌ها", catalog: "کاتالوگ‌ها", video: "ویدیوها", case: "مطالعه موردی", pricing: "قیمت‌ها", playbook: "راهنمای فروش" },
    },
  },
};

export type Dict = (typeof dict)["en"];

const Ctx = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>(null!);

export function I18nProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setState] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => {
    document.cookie = `lang=${l};path=/;max-age=31536000;samesite=lax`;
    const apply = () => {
      document.documentElement.lang = l;
      document.documentElement.dir = l === "fa" ? "rtl" : "ltr";
      setState(l);
    };
    if (document.startViewTransition) document.startViewTransition(apply);
    else apply();
  }, []);
  return <Ctx.Provider value={{ lang, t: dict[lang] as Dict, setLang }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

export const num = (n: number, lang: Lang, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US", opts).format(n);

export const date = (iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", opts).format(new Date(iso));
