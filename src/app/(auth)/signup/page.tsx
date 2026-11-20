import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm, LocaleToggle } from "@/components/auth/forms";
import { getRequestLocale } from "@/lib/locale";
import { makeT } from "@/lib/i18n";

export default async function SignupPage() {
  const locale = await getRequestLocale();
  const t = makeT(locale);

  return (
    <AuthShell
      locale={locale}
      title={t("auth.signupTitle")}
      subtitle={t("auth.signupSubtitle")}
      footer={
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">{locale === "id" ? "Bahasa antarmuka" : "Interface language"}</span>
          <LocaleToggle />
        </div>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
