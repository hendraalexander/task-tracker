"use server";

import { prisma } from "@/lib/db";
import { canWrite, requireTask } from "@/lib/access";
import { serializeTask, taskInclude } from "@/lib/views";
import type { TaskDetail, TaskNode } from "@/lib/task-types";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function getTaskDetail(taskId: string): Promise<TaskDetail | null> {
  let ctx;
  try {
    ctx = await requireTask(taskId);
  } catch {
    return null;
  }

  const [task, parentRecord, memberships, projectGuests, tags, fields, milestones, candidates] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      include: {
        ...taskInclude,
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        },
        attachments: { orderBy: { createdAt: "desc" }, include: { uploader: { select: { name: true } } } },
        blockedBy: { include: { blockedByTask: { select: { id: true, title: true, status: true } } } },
        blocks: { include: { task: { select: { id: true, title: true, status: true } } } },
        activity: {
          orderBy: { createdAt: "desc" },
          take: 25,
          include: { actor: { select: { name: true } } },
        },
      },
    }),
    prisma.task.findUnique({
      where: { id: ctx.task.parentTaskId ?? "__none__" },
      select: { id: true, title: true, parentTaskId: true },
    }),
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspace.id, status: "ACTIVE", role: { not: "GUEST" } },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.projectMember.findMany({
      where: {
        projectId: ctx.project.id,
        user: { memberships: { some: { workspaceId: ctx.workspace.id, role: "GUEST", status: "ACTIVE" } } },
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    prisma.tag.findMany({ where: { workspaceId: ctx.workspace.id }, orderBy: { name: "asc" } }),
    prisma.customField.findMany({ where: { projectId: ctx.project.id }, orderBy: { position: "asc" } }),
    prisma.milestone.findMany({ where: { projectId: ctx.project.id }, orderBy: { date: "asc" } }),
    prisma.task.findMany({
      where: { projectId: ctx.project.id, deletedAt: null, id: { not: taskId } },
      select: { id: true, title: true, parentTaskId: true, position: true },
      orderBy: { position: "asc" },
      take: 500,
    }),
  ]);

  if (!task) return null;

  // Walk ancestors (for breadcrumb + dependency guard).
  const ancestorIds = new Set<string>();
  const ancestors: { id: string; title: string }[] = [];
  let cursor = parentRecord;
  let guard = 0;
  while (cursor && guard < 50) {
    ancestorIds.add(cursor.id);
    ancestors.push({ id: cursor.id, title: cursor.title });
    cursor = cursor.parentTaskId
      ? await prisma.task.findUnique({
          where: { id: cursor.parentTaskId },
          select: { id: true, title: true, parentTaskId: true },
        })
      : null;
    guard += 1;
  }

  // Fetch the whole descendant tree level by level (unlimited nesting).
  const descendants: NonNullable<Awaited<ReturnType<typeof prisma.task.findMany<{ include: typeof taskInclude }>>>> = [];
  let frontier = [taskId];
  let depth = 0;
  while (frontier.length && depth < 30) {
    const level = await prisma.task.findMany({
      where: { parentTaskId: { in: frontier }, deletedAt: null },
      include: taskInclude,
      orderBy: { position: "asc" },
    });
    descendants.push(...level);
    frontier = level.map((item) => item.id);
    depth += 1;
  }

  const nodes = new Map<string, TaskNode>();
  for (const item of descendants) {
    nodes.set(item.id, { ...serializeTask(item), children: [] });
  }
  const subtasks: TaskNode[] = [];
  for (const item of descendants) {
    const node = nodes.get(item.id);
    if (!node) continue;
    if (item.parentTaskId === taskId) subtasks.push(node);
    else if (item.parentTaskId) nodes.get(item.parentTaskId)?.children.push(node);
  }

  const descendantIds = new Set(descendants.map((item) => item.id));
  const blockedCandidateIds = new Set([...descendantIds, ...ancestorIds]);

  const isAdmin = ctx.membership.role === "OWNER" || ctx.membership.role === "ADMIN";
  const canEdit = !ctx.readOnly && !ctx.isGuest && canWrite(ctx.membership.role) && !ctx.project.archivedAt;

  return {
    task: serializeTask(task),
    parent: parentRecord ? { id: parentRecord.id, title: parentRecord.title } : null,
    subtasks,
    blockedBy: task.blockedBy.map((d) => d.blockedByTask),
    blocking: task.blocks.map((d) => d.task),
    comments: task.comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorId: c.author.id,
      authorName: c.author.name,
      authorAvatar: c.author.avatarUrl,
      createdAt: c.createdAt.toISOString(),
      editedAt: iso(c.editedAt),
      canModify: c.author.id === ctx.user.id && !ctx.readOnly,
      canDelete: (c.author.id === ctx.user.id || isAdmin) && !ctx.readOnly,
    })),
    activity: task.activity.map((a) => ({
      id: a.id,
      action: a.action,
      field: a.field,
      fromValue: a.fromValue,
      toValue: a.toValue,
      actorName: a.actor?.name ?? "System",
      createdAt: a.createdAt.toISOString(),
    })),
    attachments: task.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mime: a.mime,
      size: a.size,
      url: `/uploads/${a.storageKey}`,
      uploaderName: a.uploader.name,
      createdAt: a.createdAt.toISOString(),
    })),
    candidates: candidates.filter((candidate) => !blockedCandidateIds.has(candidate.id)),
    meta: {
      id: ctx.project.id,
      name: ctx.project.name,
      color: ctx.project.color,
      privacy: ctx.project.privacy,
      archived: !!ctx.project.archivedAt,
      workspaceSlug: ctx.workspace.slug,
      canEdit,
      isGuest: ctx.isGuest,
      isProjectAdmin: ctx.isProjectAdmin,
      readOnly: ctx.readOnly,
      currentUserId: ctx.user.id,
      members: [
        ...memberships.map((m) => ({ ...m.user, role: m.role })),
        ...projectGuests.map((m) => ({ ...m.user, role: "GUEST" })),
      ],
      tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
      fields: fields.map((f) => ({ id: f.id, name: f.name, type: f.type, options: f.options, required: f.required })),
      milestones: milestones.map((m) => ({ id: m.id, name: m.name, date: m.date.toISOString() })),
    },
  };
}
