import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getRequestLocale } from "@/lib/locale";
import { makeT } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/auth-shell";
import { WorkspaceForm } from "@/components/onboarding/forms";
import { Card, Badge } from "@/components/ui/primitives";
import { logoutAction } from "@/actions/auth";

export default async function WelcomePage() {
  const user = await requireUser();
  const locale = await getRequestLocale();
  const t = makeT(locale);

  const [memberships, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      include: { workspace: { select: { id: true, name: true, slug: true, plan: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: {
        email: user.email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { workspace: { select: { name: true } }, invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <AuthShell locale={locale} title={t("welcome.title")} subtitle={t("welcome.subtitle")}>
      <div className="space-y-4">
        {memberships.length > 0 && (
          <Card className="p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("welcome.yourWorkspaces")}
            </p>
            <div className="space-y-1.5">
              {memberships.map((m) => (
                <Link
                  key={m.id}
                  href={`/w/${m.workspace.slug}/home`}
                  className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-[13px] transition hover:bg-surface-muted"
                >
                  <span className="grid h-5 w-5 place-items-center rounded bg-primary-soft text-[10px] font-bold text-primary">
                    {m.workspace.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.workspace.name}</span>
                  <Badge tone="neutral">{m.workspace.plan}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {invitations.length > 0 && (
          <Card className="p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("welcome.invitations")}
            </p>
            <div className="space-y-1.5">
              {invitations.map((invite) => (
                <Link
                  key={invite.id}
                  href={`/invite/${invite.token}`}
                  className="block rounded-lg border border-border px-2.5 py-2 transition hover:bg-surface-muted"
                >
                  <p className="text-[13px] font-medium">{invite.workspace.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {invite.invitedBy.name} · {invite.role}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("welcome.create")}
          </p>
          <WorkspaceForm />
        </Card>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-[11px] text-muted-foreground">{user.email}</span>
          <form action={logoutAction}>
            <button type="submit" className="cursor-pointer text-[12px] font-medium text-muted-foreground hover:text-foreground">
              {t("nav.logout")}
            </button>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}
