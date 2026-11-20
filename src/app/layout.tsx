import { cookies } from "next/headers";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider, ThemeSync, ToastProvider } from "@/components/providers";
import { normalizeLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: {
    default: "A Tracker — Satu tempat untuk seluruh pekerjaan tim",
    template: "%s · A Tracker",
  },
  description:
    "A Tracker adalah project tracker untuk tim 5–50 orang: list, board, calendar, timeline, dan dashboard progres dalam satu tempat.",
  applicationName: "A Tracker",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1a" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get("at_locale")?.value);
  const themePref = jar.get("at_theme")?.value ?? "system";
  const motionPref = jar.get("at_motion")?.value ?? "on";
  const darkClass = themePref === "dark" ? "dark" : "";

  return (
    <html
      lang={locale}
      className={darkClass}
      data-theme-pref={themePref}
      data-motion={motionPref}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased [font-family:'Plus_Jakarta_Sans',ui-sans-serif,system-ui,sans-serif]">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Lewati ke konten
        </a>
        <LocaleProvider initial={locale}>
          <ThemeSync />
          <ToastProvider>{children}</ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
