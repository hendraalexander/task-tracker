import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "@/components/auth/forms";
import { getRequestLocale } from "@/lib/locale";
import { makeT } from "@/lib/i18n";

export default async function ForgotPasswordPage() {
  const locale = await getRequestLocale();
  const t = makeT(locale);
  return (
    <AuthShell locale={locale} title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")}>
      <ForgotForm />
    </AuthShell>
  );
}
