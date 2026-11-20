"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  canWrite,
  logActivity,
  requireProjectById,
  requireTask,
  type TaskContext,
} from "@/lib/access";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { notifyUsers } from "@/lib/notify";
import { MAX_FILE_BYTES, MAX_FILES_PER_TASK } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "@/actions/project";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const parseDateInput = (value?: string | null) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T23:59:59`);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toInputDate = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");

function taskWriteError(ctx: TaskContext) {
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (ctx.readOnly) return t("common.readOnly");
  if (ctx.isGuest) return t("common.error");
  if (!canWrite(ctx.membership.role)) return t("common.error");
  if (ctx.project.archivedAt) return t("projects.archived");
  return null;
}

async function nextPosition(projectId: string, status: string) {
  const last = await prisma.task.findFirst({
    where: { projectId, status: status as never, deletedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? 0) + 1000;
}

type AssigneeCtx = { workspace: { id: string }; project: { id: string } };

/**
 * Assignees may be any active workspace member, not only project members.
 * Guests remain project-scoped and can only be assigned inside their project.
 */
async function validAssignees(ctx: AssigneeCtx, userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { ok: true as const, ids: [] as string[] };

  const memberships = await prisma.membership.findMany({
    where: { workspaceId: ctx.workspace.id, userId: { in: ids }, status: "ACTIVE" },
    select: { userId: true, role: true },
  });
  if (memberships.length !== ids.length) return { ok: false as const };

  const guestIds = memberships.filter((m) => m.role === "GUEST").map((m) => m.userId);
  if (guestIds.length) {
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId: ctx.project.id, userId: { in: guestIds } },
      select: { userId: true },
    });
    if (projectMembers.length !== guestIds.length) return { ok: false as const };
  }
  return { ok: true as const, ids };
}

export type CreateTaskInput = {
  title: string;
  status?: string;
  priority?: string;
  assigneeIds?: string[];
  dueDate?: string | null;
  startDate?: string | null;
  description?: string | null;
  milestoneId?: string | null;
  parentTaskId?: string | null;
};

export async function createTask(projectId: string, input: CreateTaskInput): Promise<ActionResult> {
  const ctx = await requireProjectById(projectId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (!ctx.canEdit) return { ok: false, error: ctx.readOnly ? t("common.readOnly") : t("common.error") };

  const title = input.title?.trim();
  if (!title) return { ok: false, error: t("task.title") };
  const status = STATUSES.includes((input.status ?? "TODO") as never) ? (input.status ?? "TODO") : "TODO";
  const priority = PRIORITIES.includes((input.priority ?? "MEDIUM") as never) ? (input.priority ?? "MEDIUM") : "MEDIUM";

  const assignees = await validAssignees(ctx, input.assigneeIds ?? []);
  if (!assignees.ok) return { ok: false, error: t("common.error") };

  if (input.parentTaskId) {
    // Unlimited nesting: only require that the parent is a live task in this project.
    const parent = await prisma.task.findFirst({
      where: { id: input.parentTaskId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) return { ok: false, error: t("common.error") };
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      title: title.slice(0, 300),
      description: input.description?.slice(0, 20_000) || null,
      status: status as never,
      priority: priority as never,
      startDate: parseDateInput(input.startDate),
      dueDate: parseDateInput(input.dueDate),
      milestoneId: input.milestoneId || null,
      parentTaskId: input.parentTaskId ?? null,
      position: await nextPosition(projectId, status),
      completedAt: status === "DONE" ? new Date() : null,
      createdById: ctx.user.id,
      assignees: assignees.ids.length ? { create: assignees.ids.map((userId) => ({ userId })) } : undefined,
    },
  });

  await logActivity({
    workspaceId: ctx.workspace.id,
    projectId,
    taskId: task.id,
    actorId: ctx.user.id,
    action: input.parentTaskId ? "subtask_created" : "task_created",
    toValue: task.title,
  });

  if (assignees.ids.length) {
    await notifyUsers({
      userIds: assignees.ids,
      actorId: ctx.user.id,
      workspaceId: ctx.workspace.id,
      type: "ASSIGNMENT",
      title: `${ctx.user.name} assigned you a task`,
      body: task.title,
      url: `/w/${ctx.workspace.slug}/p/${projectId}/list?task=${task.id}`,
    });
  }

  revalidatePath(`/w/${ctx.workspace.slug}/p/${projectId}`, "layout");
  return { ok: true, id: task.id };
}

export async function quickAddTask(projectId: string, formData: FormData): Promise<ActionResult> {
  return createTask(projectId, {
    title: String(formData.get("title") ?? ""),
    status: String(formData.get("status") ?? "TODO"),
    dueDate: (formData.get("dueDate") as string) || null,
    assigneeIds: formData.getAll("assigneeIds").map(String).filter(Boolean),
  });
}

export type TaskPatch = {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeIds?: string[];
  startDate?: string | null;
  dueDate?: string | null;
  milestoneId?: string | null;
  confirmDone?: boolean;
  position?: number;
};

export async function updateTask(taskId: string, patch: TaskPatch): Promise<ActionResult> {
  const ctx = await requireTask(taskId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  const data: Record<string, unknown> = {};
  const activity: { action: string; field: string; from?: string | null; to?: string | null }[] = [];

  const guestAssigned = ctx.isGuest
    ? !!(await prisma.taskAssignee.findUnique({
        where: { taskId_userId: { taskId, userId: ctx.user.id } },
      }))
    : false;
  const guestStatusOnly =
    ctx.isGuest &&
    guestAssigned &&
    Object.keys(patch).every((k) => k === "status" || k === "confirmDone" || k === "position");

  if (ctx.readOnly) return { ok: false, error: t("common.readOnly") };
  if (!guestStatusOnly) {
    const blocked = taskWriteError(ctx);
    if (blocked) return { ok: false, error: blocked };
  }
  if (ctx.isGuest && !guestStatusOnly) return { ok: false, error: t("common.error") };

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) return { ok: false, error: t("task.title") };
    data.title = title.slice(0, 300);
    activity.push({ action: "title_changed", field: "title", from: ctx.task.title, to: title });
  }
  if (patch.description !== undefined) {
    const value = (patch.description ?? "").slice(0, 20_000);
    data.description = value || null;
    activity.push({ action: "description_changed", field: "description" });
  }
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status as never)) return { ok: false, error: t("common.error") };

    if (patch.status === "DONE" && ctx.task.status !== "DONE" && !patch.confirmDone) {
      const blockers = await prisma.taskDependency.findMany({
        where: { taskId, blockedByTask: { status: { not: "DONE" }, deletedAt: null } },
        include: { blockedByTask: { select: { title: true } } },
      });
      if (blockers.length) {
        return {
          ok: false,
          needsConfirm: true,
          error: `${t("task.blockedWarning")} (${blockers.map((b) => b.blockedByTask.title).join(", ")})`,
        };
      }
    }
    data.status = patch.status;
    data.completedAt = patch.status === "DONE" ? new Date() : null;
    activity.push({ action: "status_changed", field: "status", from: ctx.task.status, to: patch.status });
  }
  if (patch.priority !== undefined) {
    if (!PRIORITIES.includes(patch.priority as never)) return { ok: false, error: t("common.error") };
    data.priority = patch.priority;
    activity.push({ action: "priority_changed", field: "priority", from: ctx.task.priority, to: patch.priority });
  }
  let addedAssignees: string[] = [];
  if (patch.assigneeIds !== undefined) {
    const assignees = await validAssignees(ctx, patch.assigneeIds);
    if (!assignees.ok) return { ok: false, error: t("common.error") };

    const current = await prisma.taskAssignee.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true } } },
    });
    const before = new Set(current.map((a) => a.userId));
    const after = new Set(assignees.ids);
    addedAssignees = [...after].filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !after.has(id));

    data.assignees = {
      deleteMany: {},
      create: assignees.ids.map((userId) => ({ userId })),
    };
    for (const user of current.filter((a) => removed.includes(a.userId))) {
      activity.push({ action: "assignee_removed", field: "assignee", from: user.user.name, to: null });
    }
    if (addedAssignees.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: addedAssignees } },
        select: { id: true, name: true },
      });
      for (const user of users) {
        activity.push({ action: "assignee_added", field: "assignee", from: null, to: user.name });
      }
    }
  }
  if (patch.startDate !== undefined) {
    data.startDate = parseDateInput(patch.startDate);
    activity.push({ action: "start_date_changed", field: "startDate" });
  }
  if (patch.dueDate !== undefined) {
    data.dueDate = parseDateInput(patch.dueDate);
    activity.push({ action: "due_date_changed", field: "dueDate", from: toInputDate(ctx.task.dueDate), to: toInputDate(parseDateInput(patch.dueDate)) });
  }
  if (patch.milestoneId !== undefined) {
    if (patch.milestoneId) {
      const milestone = await prisma.milestone.findFirst({
        where: { id: patch.milestoneId, projectId: ctx.project.id },
      });
      if (!milestone) return { ok: false, error: t("common.error") };
    }
    data.milestoneId = patch.milestoneId || null;
    activity.push({ action: "milestone_changed", field: "milestone" });
  }
  if (patch.position !== undefined) data.position = patch.position;

  if (patch.status && !patch.position) {
    data.position = await nextPosition(ctx.project.id, patch.status);
  }

  await prisma.task.update({ where: { id: taskId }, data });

  for (const item of activity) {
    await logActivity({
      workspaceId: ctx.workspace.id,
      projectId: ctx.project.id,
      taskId,
      actorId: ctx.user.id,
      action: item.action,
      field: item.field,
      fromValue: item.from ?? null,
      toValue: item.to ?? null,
    });
  }

  if (addedAssignees.length) {
    await notifyUsers({
      userIds: addedAssignees,
      actorId: ctx.user.id,
      workspaceId: ctx.workspace.id,
      type: "ASSIGNMENT",
      title: `${ctx.user.name} assigned you a task`,
      body: ctx.task.title,
      url: `/w/${ctx.workspace.slug}/p/${ctx.project.id}/list?task=${taskId}`,
    });
  }

  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

export async function moveTask(taskId: string, status: string): Promise<ActionResult> {
  if (!STATUSES.includes(status as never)) return { ok: false, error: "Invalid status" };
  return updateTask(taskId, { status });
}

export async function duplicateTask(taskId: string): Promise<ActionResult> {
  const ctx = await requireTask(taskId);
  const blocked = taskWriteError(ctx);
  if (blocked) return { ok: false, error: blocked };
  const copy = await prisma.task.create({
    data: {
      projectId: ctx.project.id,
      title: `${ctx.task.title} (copy)`,
      description: ctx.task.description,
      status: ctx.task.status,
      priority: ctx.task.priority,
      startDate: ctx.task.startDate,
      dueDate: ctx.task.dueDate,
      milestoneId: ctx.task.milestoneId,
      position: await nextPosition(ctx.project.id, ctx.task.status),
      createdById: ctx.user.id,
      assignees: {
        create: (await prisma.taskAssignee.findMany({ where: { taskId }, select: { userId: true } })).map((a) => ({ userId: a.userId })),
      },
    },
  });
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true, id: copy.id };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const ctx = await requireTask(taskId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  const blocked = taskWriteError(ctx);
  if (blocked) return { ok: false, error: blocked };

  const now = new Date();
  // Soft delete the whole descendant chain, not just direct children.
  const ids = [taskId];
  let frontier = [taskId];
  for (let depth = 0; frontier.length && depth < 30; depth += 1) {
    const children = await prisma.task.findMany({
      where: { parentTaskId: { in: frontier }, deletedAt: null },
      select: { id: true },
    });
    frontier = children.map((child) => child.id);
    ids.push(...frontier);
  }
  await prisma.task.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    projectId: ctx.project.id,
    taskId,
    actorId: ctx.user.id,
    action: "task_deleted",
    fromValue: ctx.task.title,
  });
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

export async function restoreTask(taskId: string): Promise<ActionResult> {
  // requireTask hides soft-deleted rows, so resolve the row first and then
  // apply the same project-level permission gate.
  const deleted = await prisma.task.findUnique({ where: { id: taskId } });
  if (!deleted?.deletedAt) return { ok: false, error: "Not found" };
  const ctx = await requireProjectById(deleted.projectId);
  if (!ctx.canEdit) return { ok: false, error: "Forbidden" };
  await prisma.task.updateMany({ where: { id: taskId }, data: { deletedAt: null } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    projectId: ctx.project.id,
    taskId,
    actorId: ctx.user.id,
    action: "task_restored",
  });
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

export async function addDependency(taskId: string, blockedByTaskId: string): Promise<ActionResult> {
  const ctx = await requireTask(taskId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  const blocked = taskWriteError(ctx);
  if (blocked) return { ok: false, error: blocked };
  if (taskId === blockedByTaskId) return { ok: false, error: t("task.circular") };

  const blocker = await prisma.task.findFirst({
    where: { id: blockedByTaskId, projectId: ctx.project.id, deletedAt: null },
  });
  if (!blocker) return { ok: false, error: t("common.error") };

  // A task may not be blocked by its own ancestor or descendant (any depth).
  let ancestorCursor: string | null = blocker.parentTaskId;
  for (let i = 0; ancestorCursor && i < 50; i += 1) {
    if (ancestorCursor === taskId) return { ok: false, error: t("task.circular") };
    const parent: { parentTaskId: string | null } | null = await prisma.task.findUnique({
      where: { id: ancestorCursor },
      select: { parentTaskId: true },
    });
    ancestorCursor = parent?.parentTaskId ?? null;
  }
  let taskCursor: string | null = ctx.task.parentTaskId;
  for (let i = 0; taskCursor && i < 50; i += 1) {
    if (taskCursor === blockedByTaskId) return { ok: false, error: t("task.circular") };
    const parent: { parentTaskId: string | null } | null = await prisma.task.findUnique({
      where: { id: taskCursor },
      select: { parentTaskId: true },
    });
    taskCursor = parent?.parentTaskId ?? null;
  }

  // Cycle check: walk the blocker chain; if we reach taskId it would loop.
  const seen = new Set<string>();
  let frontier = [blockedByTaskId];
  while (frontier.length) {
    const current = frontier.pop()!;
    if (current === taskId) return { ok: false, error: t("task.circular") };
    if (seen.has(current)) continue;
    seen.add(current);
    const deps = await prisma.taskDependency.findMany({
      where: { taskId: current },
      select: { blockedByTaskId: true },
    });
    frontier = frontier.concat(deps.map((d) => d.blockedByTaskId));
  }

  try {
    await prisma.taskDependency.create({ data: { taskId, blockedByTaskId } });
  } catch {
    return { ok: false, error: t("common.error") };
  }
  await logActivity({
    workspaceId: ctx.workspace.id,
    projectId: ctx.project.id,
    taskId,
    actorId: ctx.user.id,
    action: "dependency_added",
    toValue: blocker.title,
  });
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

export async function removeDependency(taskId: string, blockedByTaskId: string): Promise<ActionResult> {
  const ctx = await requireTask(taskId);
  const blocked = taskWriteError(ctx);
  if (blocked) return { ok: false, error: blocked };
  await prisma.taskDependency.deleteMany({ where: { taskId, blockedByTaskId } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    projectId: ctx.project.id,
    taskId,
    actorId: ctx.user.id,
    action: "dependency_removed",
  });
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

export async function setTaskTags(taskId: string, tagIds: string[]): Promise<ActionResult> {
  const ctx = await requireTask(taskId);
  const blocked = taskWriteError(ctx);
  if (blocked) return { ok: false, error: blocked };
  const valid = await prisma.tag.findMany({
    where: { id: { in: tagIds }, workspaceId: ctx.workspace.id },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.taskTag.deleteMany({ where: { taskId } }),
    prisma.taskTag.createMany({ data: valid.map((t) => ({ taskId, tagId: t.id })), skipDuplicates: true }),
  ]);
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

export async function setCustomFieldValue(taskId: string, fieldId: string, value: string | null): Promise<ActionResult> {
  const ctx = await requireTask(taskId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  const blocked = taskWriteError(ctx);
  if (blocked) return { ok: false, error: blocked };

  const field = await prisma.customField.findFirst({ where: { id: fieldId, projectId: ctx.project.id } });
  if (!field) return { ok: false, error: t("common.error") };

  let normalized = value?.trim() ?? "";
  if (field.type === "NUMBER" && normalized && Number.isNaN(Number(normalized))) {
    return { ok: false, error: t("common.error") };
  }
  if (field.type === "CHECKBOX") normalized = normalized === "true" ? "true" : "false";
  if (field.type === "DATE" && normalized) {
    const d = parseDateInput(normalized);
    if (!d) return { ok: false, error: t("common.error") };
    normalized = d.toISOString();
  }
  if (field.type === "SINGLE_SELECT" && normalized && !field.options.includes(normalized)) {
    return { ok: false, error: t("common.error") };
  }
  if (field.type === "MULTI_SELECT" && normalized) {
    try {
      const parsed = JSON.parse(normalized) as string[];
      if (!Array.isArray(parsed) || parsed.some((v) => !field.options.includes(v))) {
        return { ok: false, error: t("common.error") };
      }
      normalized = JSON.stringify(parsed);
    } catch {
      return { ok: false, error: t("common.error") };
    }
  }
  if (field.required && !normalized) return { ok: false, error: t("common.required") };

  await prisma.customFieldValue.upsert({
    where: { taskId_fieldId: { taskId, fieldId } },
    create: { taskId, fieldId, value: normalized || null },
    update: { value: normalized || null },
  });
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

/* ------------------------------ comments ------------------------------ */

function escapeRegExpLocal(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function mentionedUserIds(body: string, workspaceId: string, projectId: string) {
  const members = await prisma.membership.findMany({
    where: { workspaceId, status: "ACTIVE", role: { not: "GUEST" } },
    select: { userId: true, user: { select: { name: true } } },
  });
  const guests = await prisma.projectMember.findMany({
    where: { projectId, user: { memberships: { some: { workspaceId, status: "ACTIVE" } } } },
    select: { userId: true, user: { select: { name: true } } },
  });
  const all = [...members, ...guests].filter(
    (m, i, arr) => arr.findIndex((x) => x.userId === m.userId) === i,
  );
  const names = all
    .map((m) => ({ id: m.userId, name: m.user.name }))
    .filter((m) => m.name.length > 1)
    .sort((a, b) => b.name.length - a.name.length);
  if (!names.length) return [];

  const regex = new RegExp(`@(${names.map((n) => escapeRegExpLocal(n.name)).join("|")})`, "gi");
  const found = new Set<string>();
  for (const match of body.matchAll(regex)) {
    const token = match[1]?.toLowerCase();
    const hit = names.find((n) => n.name.toLowerCase() === token);
    if (hit) found.add(hit.id);
  }
  return [...found];
}

export async function addComment(taskId: string, bodyRaw: string): Promise<ActionResult> {
  const ctx = await requireTask(taskId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (ctx.readOnly) return { ok: false, error: t("common.readOnly") };
  const body = bodyRaw.trim();
  if (!body) return { ok: false, error: t("common.error") };
  if (body.length > 10_000) return { ok: false, error: t("common.error") };

  const comment = await prisma.comment.create({
    data: { taskId, authorId: ctx.user.id, body },
  });

  await logActivity({
    workspaceId: ctx.workspace.id,
    projectId: ctx.project.id,
    taskId,
    actorId: ctx.user.id,
    action: "comment_created",
  });

  const mentions = await mentionedUserIds(body, ctx.workspace.id, ctx.project.id);
  if (mentions.length) {
    await notifyUsers({
      userIds: mentions,
      actorId: ctx.user.id,
      workspaceId: ctx.workspace.id,
      type: "MENTION",
      title: `${ctx.user.name} mentioned you`,
      body: `${ctx.task.title}: ${body.slice(0, 160)}`,
      url: `/w/${ctx.workspace.slug}/p/${ctx.project.id}/list?task=${taskId}`,
    });
  }
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true, id: comment.id };
}

export async function editComment(commentId: string, bodyRaw: string): Promise<ActionResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Unauthorized" };
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { task: true } });
  if (!comment || comment.deletedAt) return { ok: false, error: "Not found" };
  if (comment.authorId !== user.id) return { ok: false, error: "Forbidden" };

  const ctx = await requireTask(comment.taskId);
  if (ctx.readOnly) return { ok: false, error: makeT(normalizeLocale(user.locale))("common.readOnly") };
  const body = bodyRaw.trim();
  if (!body) return { ok: false, error: "Empty" };

  await prisma.comment.update({ where: { id: commentId }, data: { body: body.slice(0, 10_000), editedAt: new Date() } });
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Unauthorized" };
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { task: true } });
  if (!comment) return { ok: false, error: "Not found" };
  const ctx = await requireTask(comment.taskId);

  const canDelete = comment.authorId === user.id || ctx.membership.role === "OWNER" || ctx.membership.role === "ADMIN";
  if (!canDelete) return { ok: false, error: "Forbidden" };

  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

/* ------------------------------ attachments ------------------------------ */

const ALLOWED_MIME = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml",
  "application/pdf", "text/plain", "text/csv", "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
]);

export async function uploadAttachment(taskId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireTask(taskId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (ctx.readOnly) return { ok: false, error: t("common.readOnly") };
  if (!canWrite(ctx.membership.role)) return { ok: false, error: t("common.error") };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: t("common.error") };
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: ctx.user.locale === "en" ? `File exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.` : `File melebihi ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`,
    };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: ctx.user.locale === "en" ? "File type is not allowed." : "Tipe file tidak diizinkan." };
  }
  const count = await prisma.attachment.count({ where: { taskId } });
  if (count >= MAX_FILES_PER_TASK) {
    return { ok: false, error: ctx.user.locale === "en" ? `Max ${MAX_FILES_PER_TASK} files per task.` : `Maks ${MAX_FILES_PER_TASK} file per task.` };
  }

  const root = path.join(process.cwd(), process.env.UPLOAD_DIR ?? "public/uploads");
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const key = `${taskId}/${randomUUID()}-${safeName}`;
  const fullPath = path.join(root, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));

  await prisma.attachment.create({
    data: {
      taskId,
      uploaderId: ctx.user.id,
      fileName: safeName,
      mime: file.type,
      size: file.size,
      storageKey: key,
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    projectId: ctx.project.id,
    taskId,
    actorId: ctx.user.id,
    action: "attachment_added",
    toValue: safeName,
  });
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment?.taskId) return { ok: false, error: "Not found" };
  const ctx = await requireTask(attachment.taskId);
  const blocked = taskWriteError(ctx);
  if (blocked) return { ok: false, error: blocked };

  const root = path.join(process.cwd(), process.env.UPLOAD_DIR ?? "public/uploads");
  try {
    await unlink(path.join(root, attachment.storageKey));
  } catch {
    /* file already gone */
  }
  await prisma.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(`/w/${ctx.workspace.slug}/p/${ctx.project.id}`, "layout");
  return { ok: true };
}

/* ------------------------------ notifications ------------------------------ */

export async function markNotificationRead(notificationId: string) {
  const user = await getSession();
  if (!user) return { ok: false };
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const user = await getSession();
  if (!user) return { ok: false };
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
