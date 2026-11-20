import Link from "next/link";
import { WarningCircle, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getRequestLocale } from "@/lib/locale";
import { makeT } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInviteButton } from "@/components/onboarding/accept-invite";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getRequestLocale();
  const t = makeT(locale);
  const user = await getSession();

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { workspace: true, invitedBy: { select: { name: true, email: true } } },
  });

  let problem: string | null = null;
  if (!invitation || invitation.revokedAt || invitation.acceptedAt) {
    problem = locale === "id" ? "Undangan tidak valid atau sudah dipakai." : "This invitation is invalid or already used.";
  } else if (invitation.expiresAt < new Date()) {
    problem = locale === "id" ? "Undangan sudah kedaluwarsa. Minta Admin mengirim ulang." : "This invitation has expired. Ask an Admin to resend it.";
  } else if (user && user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    problem =
      locale === "id"
        ? `Undangan dikirim ke ${invitation.email}. Anda masuk sebagai ${user.email}.`
        : `This invitation was sent to ${invitation.email}. You are signed in as ${user.email}.`;
  }

  const title = locale === "id" ? "Undangan tim" : "Team invitation";

  if (!invitation) {
    return (
      <AuthShell locale={locale} title={title} subtitle={problem ?? ""}>
        <Problem message={problem ?? ""} />
        <Link href="/login" className="mt-4 block text-center text-sm font-medium text-primary hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      locale={locale}
      title={title}
      subtitle={`${invitation.invitedBy.name} · ${invitation.workspace.name}`}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
          <p className="text-sm">
            <strong>{invitation.invitedBy.name}</strong>{" "}
            {locale === "id" ? "mengundang Anda bergabung dengan" : "invited you to join"}{" "}
            <strong>{invitation.workspace.name}</strong>
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <EnvelopeSimple size={13} /> {invitation.email}
            <span aria-hidden>·</span>
            <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {t(`role.${invitation.role}` as never)}
            </span>
          </p>
        </div>

        {problem ? (
          <>
            <Problem message={problem} />
            <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
              {t("auth.backToLogin")}
            </Link>
          </>
        ) : user ? (
          <AcceptInviteButton token={token} label={locale === "id" ? "Terima undangan" : "Accept invitation"} />
        ) : (
          <>
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              {locale === "id" ? "Masuk untuk menerima" : "Log in to accept"}
            </Link>
            <Link
              href={`/signup`}
              className="block text-center text-sm text-muted-foreground hover:text-foreground"
            >
              {locale === "id" ? "Buat akun baru" : "Create a new account"}
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
      <WarningCircle size={16} className="mt-0.5 shrink-0" />
      {message}
    </div>
  );
}
