import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { makeT } from "@/lib/i18n";
import { BrandLogo } from "@/components/brand/logo";

export function AuthShell({
  locale,
  title,
  subtitle,
  children,
  footer,
}: {
  locale: "id" | "en";
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = makeT(locale);
  const bullets =
    locale === "id"
      ? ["List, Board, Calendar, Timeline", "Dashboard progres real-time", "Guest untuk klien, tanpa ribet"]
      : ["List, Board, Calendar, Timeline", "Real-time progress dashboard", "Guest access for clients"];

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#0b1b3a] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 15%, rgba(37,99,235,.55) 0%, transparent 100%), radial-gradient(50% 45% at 85% 80%, rgba(5,150,105,.28) 0%, transparent 100%)",
          }}
        />
        <div className="relative">
          <BrandLogo href="/" tone="dark" size={28} textClassName="text-base" />
        </div>

        <div className="relative max-w-lg">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-200/80">
            {locale === "id" ? "Project tracker untuk tim" : "Project tracker for teams"}
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-[-0.03em] text-balance">
            {locale === "id"
              ? "Satu tempat tepercaya untuk seluruh pekerjaan tim."
              : "One trusted place for all your team's work."}
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-blue-100/80">
            {locale === "id"
              ? "Rencanakan, kerjakan, dan pantau progres tanpa spreadsheet dan tanpa mengejar update di chat."
              : "Plan, execute, and track progress without spreadsheets or chasing updates in chat."}
          </p>

          <ul className="mt-7 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-sm text-blue-50/90">
                <CheckCircle size={17} weight="fill" className="text-emerald-400" />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-blue-100/60">
              <span>Redesign Website Klien</span>
              <span>72%</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: t("status.TODO"), count: 4, tone: "bg-slate-400/70" },
                { label: t("status.IN_PROGRESS"), count: 3, tone: "bg-blue-400" },
                { label: t("status.DONE"), count: 6, tone: "bg-emerald-400" },
              ].map((col) => (
                <div key={col.label} className="rounded-xl bg-white/[0.06] p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-blue-100/70">
                    <span className={`h-1.5 w-1.5 rounded-full ${col.tone}`} />
                    {col.label}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {Array.from({ length: col.count }).map((_, i) => (
                      <div key={i} className="h-5 rounded-md bg-white/10" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-blue-200/60">
          <span>© 2026 A Tracker</span>
          <span aria-hidden>·</span>
          <span>{locale === "id" ? "Dibuat untuk tim 5–50 orang" : "Built for teams of 5–50"}</span>
        </div>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <BrandLogo href="/" size={26} textClassName="text-base" />
          </div>
          <h2 className="text-2xl font-bold tracking-[-0.02em]">{title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </div>
    </main>
  );
}
