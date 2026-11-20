import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm, LocaleToggle } from "@/components/auth/forms";
import { getRequestLocale } from "@/lib/locale";
import { makeT } from "@/lib/i18n";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; invited?: string }>;
}) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const t = makeT(locale);

  return (
    <AuthShell
      locale={locale}
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">{locale === "id" ? "Bahasa antarmuka" : "Interface language"}</span>
          <LocaleToggle />
        </div>
      }
    >
      {params.reset && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {locale === "id" ? "Password diperbarui. Silakan masuk." : "Password updated. Please log in."}
        </div>
      )}
      {params.invited && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[13px] text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
          {locale === "id" ? "Masuk untuk menerima undangan tim Anda." : "Log in to accept your team invitation."}
        </div>
      )}
      <LoginForm next={params.next} />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {locale === "id" ? "Dengan masuk Anda menyetujui " : "By logging in you agree to the "}
        <Link href="/login" className="underline">
          {locale === "id" ? "Ketentuan Layanan" : "Terms of Service"}
        </Link>
      </p>
    </AuthShell>
  );
}
