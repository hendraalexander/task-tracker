import Link from "next/link";
import { CheckCircle, WarningCircle, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { AuthShell } from "@/components/auth/auth-shell";
import { getRequestLocale } from "@/lib/locale";
import { makeT } from "@/lib/i18n";
import { verifyEmailAction } from "@/actions/auth";
import { Button } from "@/components/ui/primitives";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;
  const locale = await getRequestLocale();
  const t = makeT(locale);

  const ok = status === "ok";

  return (
    <AuthShell
      locale={locale}
      title={t("auth.verifyTitle")}
      subtitle={ok ? t("auth.verified") : t("auth.verifyBody")}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted/60 p-4">
          <span className="mt-0.5">
            {ok ? (
              <CheckCircle size={22} weight="fill" className="text-emerald-500" />
            ) : status === "invalid" ? (
              <WarningCircle size={22} weight="fill" className="text-red-500" />
            ) : (
              <EnvelopeSimple size={22} className="text-primary" />
            )}
          </span>
          <div className="text-sm">
            <p className="font-medium">
              {ok
                ? locale === "id"
                  ? "Email terverifikasi"
                  : "Email verified"
                : status === "invalid"
                  ? t("auth.invalidToken")
                  : locale === "id"
                    ? "Klik tombol di bawah untuk memverifikasi email Anda."
                    : "Click the button below to verify your email."}
            </p>
            {!ok && status !== "invalid" && (
              <p className="mt-1 text-muted-foreground">
                {locale === "id" ? "Tautan juga dikirim ke email Anda." : "The link was also sent to your email."}
              </p>
            )}
          </div>
        </div>

        {!ok && status !== "invalid" && token && (
          <form action={verifyEmailAction}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit" size="lg" className="w-full">
              {locale === "id" ? "Verifikasi email sekarang" : "Verify email now"}
            </Button>
          </form>
        )}

        <div className="text-center text-sm">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
