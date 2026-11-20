"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { accessibilityFilter } from "@/lib/search-access";

export type SearchResult = {
  id: string;
  type: "task" | "project" | "person";
  title: string;
  subtitle?: string;
  href: string;
  workspaceSlug: string;
};

export async function searchAll(rawTerm: string): Promise<SearchResult[]> {
  const user = await getSession();
  if (!user) return [];
  const term = rawTerm.trim();
  if (term.length < 1) return [];

  const access = await accessibilityFilter(user.id);
  const projectIds = access.flatMap((a) => a.projectIds);
  const slugByProject = new Map<string, string>();
  for (const a of access) for (const id of a.projectIds) slugByProject.set(id, a.slug);

  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null,
        projectId: { in: projectIds },
        project: { archivedAt: null },
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { comments: { some: { deletedAt: null, body: { contains: term, mode: "insensitive" } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.project.findMany({
      where: {
        id: { in: projectIds },
        deletedAt: null,
        archivedAt: null,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
  ]);

  const taskProjectIds = [...new Set(tasks.map((t) => t.projectId))];
  const referenced = await prisma.project.findMany({
    where: { id: { in: taskProjectIds } },
    select: { id: true, name: true },
  });
  const projectNames = new Map(referenced.map((p) => [p.id, p.name]));

  const results: SearchResult[] = [];

  for (const task of tasks) {
    const slug = slugByProject.get(task.projectId);
    if (!slug) continue;
    results.push({
      id: task.id,
      type: "task",
      title: task.title,
      subtitle: projectNames.get(task.projectId),
      href: `/w/${slug}/p/${task.projectId}/list?task=${task.id}`,
      workspaceSlug: slug,
    });
  }

  for (const project of projects) {
    const slug = slugByProject.get(project.id);
    if (!slug) continue;
    results.push({
      id: project.id,
      type: "project",
      title: project.name,
      subtitle: slug,
      href: `/w/${slug}/p/${project.id}/list`,
      workspaceSlug: slug,
    });
  }

  // People are only visible to internal roles; guests never see the directory.
  const internalIds = access.filter((a) => a.role !== "GUEST").map((a) => a.workspaceId);
  if (internalIds.length) {
    const people = await prisma.membership.findMany({
      where: {
        workspaceId: { in: internalIds },
        status: "ACTIVE",
        role: { not: "GUEST" },
        user: {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ],
        },
      },
      include: { user: { select: { id: true, name: true, email: true } }, workspace: { select: { slug: true } } },
      take: 5,
    });
    const seen = new Set<string>();
    for (const m of people) {
      if (seen.has(m.user.id)) continue;
      seen.add(m.user.id);
      results.push({
        id: m.user.id,
        type: "person",
        title: m.user.name,
        subtitle: m.user.email,
        href: `/w/${m.workspace.slug}/settings/members`,
        workspaceSlug: m.workspace.slug,
      });
    }
  }

  return results;
}
