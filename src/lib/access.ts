import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, requireUser, type SessionUser } from "@/lib/auth";
import type { Membership, Project, Subscription, Workspace, WorkspaceRole } from "@prisma/client";

export type PlanLimits = {
  maxMembers: number;
  maxProjects: number;
  maxGuests: number;
  timeline: boolean;
  customFields: boolean;
  activityDays: number;
  storageGb: number;
  seats: boolean;
};

export function planLimits(plan: string): PlanLimits {
  switch (plan) {
    case "BUSINESS":
      return { maxMembers: Infinity, maxProjects: Infinity, maxGuests: 50, timeline: true, customFields: true, activityDays: Infinity, storageGb: 500, seats: true };
    case "PRO":
      return { maxMembers: Infinity, maxProjects: Infinity, maxGuests: 20, timeline: true, customFields: true, activityDays: 365, storageGb: 100, seats: true };
    default:
      return { maxMembers: 10, maxProjects: 3, maxGuests: 0, timeline: false, customFields: false, activityDays: 30, storageGb: 2, seats: true };
  }
}

export const WRITE_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "MEMBER"];
export const ADMIN_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN"];

export function isAdmin(role?: WorkspaceRole | null) {
  return !!role && ADMIN_ROLES.includes(role);
}

export function canWrite(role?: WorkspaceRole | null) {
  return !!role && WRITE_ROLES.includes(role);
}

export type WorkspaceContext = {
  user: SessionUser;
  workspace: Workspace & { subscription: Subscription | null };
  membership: Membership;
  limits: PlanLimits;
};

async function loadWorkspace(slug: string): Promise<WorkspaceContext> {
  const user = await requireUser();
  const workspace = await prisma.workspace.findFirst({
    where: { slug, deletedAt: null },
    include: { subscription: true },
  });
  if (!workspace) notFound();

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
  });
  if (!membership || membership.status !== "ACTIVE") notFound();

  return { user, workspace, membership, limits: planLimits(workspace.plan) };
}

export const requireWorkspace = cache(loadWorkspace);

export async function requireWorkspaceAdmin(slug: string) {
  const ctx = await requireWorkspace(slug);
  if (!isAdmin(ctx.membership.role)) notFound();
  return ctx;
}

export type ProjectContext = WorkspaceContext & {
  project: Project;
  projectRole: "PROJECT_ADMIN" | "MEMBER" | null;
  isProjectAdmin: boolean;
  canEdit: boolean;
  isGuest: boolean;
  readOnly: boolean;
};

export function canAccessProject(
  role: WorkspaceRole,
  project: Pick<Project, "privacy" | "archivedAt">,
  projectRole: string | null,
) {
  if (role === "GUEST") return !!projectRole;
  if (project.privacy === "PRIVATE") return isAdmin(role) || !!projectRole;
  return true;
}

async function loadProject(slug: string, projectId: string): Promise<ProjectContext> {
  const ctx = await requireWorkspace(slug);
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: ctx.workspace.id, deletedAt: null },
  });
  if (!project) notFound();

  const pm = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: ctx.user.id } },
  });

  if (!canAccessProject(ctx.membership.role, project, pm?.role ?? null)) notFound();

  const isProjectAdmin =
    pm?.role === "PROJECT_ADMIN" || isAdmin(ctx.membership.role);

  const readOnly = ctx.workspace.readOnly || ctx.workspace.subscription?.status === "READ_ONLY";
  const isGuest = ctx.membership.role === "GUEST";

  return {
    ...ctx,
    project,
    projectRole: pm?.role ?? null,
    isProjectAdmin,
    canEdit: !readOnly && !isGuest && canWrite(ctx.membership.role) && !project.archivedAt,
    isGuest,
    readOnly,
  };
}

export const requireProject = cache(loadProject);

export function isReadOnly(ctx: WorkspaceContext) {
  return ctx.workspace.readOnly || ctx.workspace.subscription?.status === "READ_ONLY";
}

export async function countSeats(workspaceId: string) {
  return prisma.membership.count({
    where: { workspaceId, status: "ACTIVE", role: { in: WRITE_ROLES } },
  });
}

export async function countGuests(workspaceId: string) {
  return prisma.membership.count({
    where: { workspaceId, status: "ACTIVE", role: "GUEST" },
  });
}

export async function countProjects(workspaceId: string) {
  return prisma.project.count({ where: { workspaceId, deletedAt: null, archivedAt: null } });
}

export async function logActivity(input: {
  workspaceId: string;
  projectId?: string | null;
  taskId?: string | null;
  actorId?: string | null;
  action: string;
  field?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.activityLog.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      field: input.field ?? null,
      fromValue: input.fromValue ?? null,
      toValue: input.toValue ?? null,
      metadata: (input.metadata ?? undefined) as never,
    },
  });
}

export async function logAudit(input: {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: (input.metadata ?? undefined) as never,
    },
  });
}

export type ProjectMemberUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
  projectRole: "PROJECT_ADMIN" | "MEMBER" | null;
};

export async function getWorkspaceUsers(workspaceId: string): Promise<ProjectMemberUser[]> {
  const members = await prisma.membership.findMany({
    where: { workspaceId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  return members.map((m) => ({
    ...m.user,
    role: m.role,
    projectRole: null,
  }));
}

export async function requireSessionUser() {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}


export type TaskContext = {
  user: SessionUser;
  workspace: Workspace & { subscription: Subscription | null };
  membership: Membership;
  limits: PlanLimits;
  project: Project;
  task: import("@prisma/client").Task;
  projectRole: "PROJECT_ADMIN" | "MEMBER" | null;
  isGuest: boolean;
  isProjectAdmin: boolean;
  readOnly: boolean;
};

/**
 * Resolve a task with tenant isolation + project permission checks.
 * Every task mutation goes through this guard.
 */
async function loadTask(taskId: string): Promise<TaskContext> {
  const user = await requireUser();
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    include: { project: { include: { workspace: { include: { subscription: true } } } } },
  });
  if (!task) notFound();

  const workspace = task.project.workspace;
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
  });
  if (!membership || membership.status !== "ACTIVE") notFound();

  const pm = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: task.projectId, userId: user.id } },
  });
  if (!canAccessProject(membership.role, task.project, pm?.role ?? null)) notFound();

  const { workspace: _ws, ...project } = task.project;
  void _ws;

  return {
    user,
    workspace,
    membership,
    limits: planLimits(workspace.plan),
    project,
    task,
    projectRole: pm?.role ?? null,
    isGuest: membership.role === "GUEST",
    isProjectAdmin: pm?.role === "PROJECT_ADMIN" || isAdmin(membership.role),
    readOnly: workspace.readOnly || workspace.subscription?.status === "READ_ONLY",
  };
}


export const requireTask = cache(loadTask);

/** Resolve a project by id for actions that only receive the id. */
async function loadProjectById(projectId: string): Promise<ProjectContext> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { workspace: { select: { slug: true } } },
  });
  if (!project) notFound();
  return requireProject(project.workspace.slug, projectId);
}

export const requireProjectById = cache(loadProjectById);
