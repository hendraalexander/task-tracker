import { prisma } from "@/lib/db";
import { countSeats, requireWorkspaceAdmin } from "@/lib/access";
import { normalizeLocale } from "@/lib/i18n";
import { MembersAdmin } from "@/components/settings/members-admin";
import { appUrl } from "@/lib/email";

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceAdmin(slug);

  const [members, invitations, audit, seats] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspace.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.invitation.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    countSeats(ctx.workspace.id),
  ]);

  return (
    <MembersAdmin
      workspaceSlug={slug}
      workspaceName={ctx.workspace.name}
      workspaceSlugValue={ctx.workspace.slug}
      workspaceLogoUrl={ctx.workspace.logoUrl}
      members={members
        .filter((m) => m.role !== "GUEST")
        .map((m) => ({
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.createdAt.toISOString(),
        }))}
      invitations={invitations.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
        link: appUrl(`/invite/${invite.token}`),
      }))}
      seats={seats}
      seatLimit={ctx.limits.maxMembers}
      audit={audit.map((item) => ({
        id: item.id,
        action: item.action,
        actorName: item.actor?.name ?? "System",
        target:
          (item.metadata as Record<string, string> | null)?.name ??
          (item.metadata as Record<string, string> | null)?.email ??
          "",
        createdAt: item.createdAt.toISOString(),
      }))}
      locale={normalizeLocale(ctx.user.locale)}
      currentUserId={ctx.user.id}
    />
  );
}
