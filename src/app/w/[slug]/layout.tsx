import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { isAdmin, requireWorkspace } from "@/lib/access";
import { AppShell } from "@/components/layout/app-shell";
import { makeT } from "@/lib/i18n";
import { normalizeLocale } from "@/lib/i18n";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const admin = isAdmin(ctx.membership.role);
  const guest = ctx.membership.role === "GUEST";

  const [memberships, allProjects, projectMemberships, unread] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: ctx.user.id, status: "ACTIVE" },
      include: { workspace: { select: { id: true, name: true, slug: true, plan: true, logoUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({
      where: { workspaceId: ctx.workspace.id, deletedAt: null },
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true, privacy: true, archivedAt: true, updatedAt: true },
    }),
    prisma.projectMember.findMany({
      where: { userId: ctx.user.id, project: { workspaceId: ctx.workspace.id } },
      select: { projectId: true },
    }),
    prisma.notification.count({
      where: { userId: ctx.user.id, workspaceId: ctx.workspace.id, readAt: null },
    }),
  ]);

  const myProjects = new Set(projectMemberships.map((p) => p.projectId));
  const visible = allProjects.filter((p) => {
    if (guest) return myProjects.has(p.id);
    if (p.privacy === "PRIVATE") return admin || myProjects.has(p.id);
    return true;
  });

  const active = visible
    .filter((p) => !p.archivedAt)
    .map((p) => ({ id: p.id, name: p.name, color: p.color }));
  const archived = visible.filter((p) => p.archivedAt).map((p) => ({ id: p.id, name: p.name, color: p.color }));

  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    plan: m.workspace.plan,
    logoUrl: m.workspace.logoUrl,
  }));

  const t = makeT(normalizeLocale(ctx.user.locale));

  return (
    <AppShell
      workspace={{
        id: ctx.workspace.id,
        name: ctx.workspace.name,
        slug: ctx.workspace.slug,
        plan: ctx.workspace.plan,
        logoUrl: ctx.workspace.logoUrl,
      }}
      workspaces={workspaces}
      projects={active}
      archived={archived}
      user={{ name: ctx.user.name, email: ctx.user.email, avatarUrl: ctx.user.avatarUrl }}
      role={t(`role.${ctx.membership.role}`)}
      unread={unread}
      canManage={admin}
    >
      {children}
    </AppShell>
  );
}
