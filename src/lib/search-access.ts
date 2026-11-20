import "server-only";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/access";

export type AccessibleWorkspace = {
  workspaceId: string;
  projectIds: string[];
  slug: string;
  role: string;
};

/** Workspace/project ids the user can read. Mirrors requireProject rules. */
export async function accessibilityFilter(userId: string): Promise<AccessibleWorkspace[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    select: { workspaceId: true, role: true, workspace: { select: { slug: true } } },
  });

  const result: AccessibleWorkspace[] = [];
  for (const m of memberships) {
    const slug = m.workspace.slug;
    if (m.role === "GUEST") {
      const pms = await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } });
      result.push({ workspaceId: m.workspaceId, projectIds: pms.map((p) => p.projectId), slug, role: m.role });
      continue;
    }
    if (isAdmin(m.role)) {
      const projects = await prisma.project.findMany({
        where: { workspaceId: m.workspaceId, deletedAt: null },
        select: { id: true },
      });
      result.push({ workspaceId: m.workspaceId, projectIds: projects.map((p) => p.id), slug, role: m.role });
      continue;
    }
    const [publicProjects, pms] = await Promise.all([
      prisma.project.findMany({
        where: { workspaceId: m.workspaceId, privacy: "PUBLIC", deletedAt: null },
        select: { id: true },
      }),
      prisma.projectMember.findMany({
        where: { userId, project: { workspaceId: m.workspaceId, deletedAt: null } },
        select: { projectId: true },
      }),
    ]);
    const ids = new Set([...publicProjects.map((p) => p.id), ...pms.map((p) => p.projectId)]);
    result.push({ workspaceId: m.workspaceId, projectIds: [...ids], slug, role: m.role });
  }
  return result;
}
