import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "@/components/auth/forms";
import { getRequestLocale } from "@/lib/locale";
import { makeT } from "@/lib/i18n";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const locale = await getRequestLocale();
  const t = makeT(locale);

  return (
    <AuthShell locale={locale} title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")}>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <div className="space-y-4">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            {locale === "id" ? "Tautan reset tidak ditemukan." : "Reset link is missing."}
          </p>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            {locale === "id" ? "Minta tautan baru" : "Request a new link"}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
