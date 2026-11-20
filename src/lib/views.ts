import "server-only";
import { prisma } from "@/lib/db";
import type { ProjectContext } from "@/lib/access";
import type { FieldDTO, MemberDTO, ProjectMeta, TagDTO, TaskDTO, ViewFilters } from "@/lib/task-types";

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): ViewFilters {
  const one = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : (value ?? "");
  };
  const status = String(
    Array.isArray(searchParams.status) ? searchParams.status.join(",") : (searchParams.status ?? ""),
  )
    .split(",")
    .filter(Boolean);
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (key.startsWith("f_") && typeof value === "string" && value) fields[key.slice(2)] = value;
  }
  return {
    status,
    assignee: one("assignee"),
    priority: one("priority"),
    tag: one("tag"),
    due: one("due"),
    q: one("q"),
    sort: one("sort") || "due",
    group: one("group") || "status",
    fields,
  };
}

export async function loadProjectMeta(ctx: ProjectContext): Promise<ProjectMeta> {
  const [memberships, projectGuests, tags, fields, milestones] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspace.id, status: "ACTIVE", role: { not: "GUEST" } },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId: ctx.project.id, user: { memberships: { some: { workspaceId: ctx.workspace.id, role: "GUEST", status: "ACTIVE" } } } },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    prisma.tag.findMany({ where: { workspaceId: ctx.workspace.id }, orderBy: { name: "asc" } }),
    prisma.customField.findMany({ where: { projectId: ctx.project.id }, orderBy: { position: "asc" } }),
    prisma.milestone.findMany({ where: { projectId: ctx.project.id }, orderBy: { date: "asc" } }),
  ]);

  const members: MemberDTO[] = [
    ...memberships.map((m) => ({ ...m.user, role: m.role })),
    ...projectGuests.map((m) => ({ ...m.user, role: "GUEST" })),
  ];

  return {
    id: ctx.project.id,
    name: ctx.project.name,
    color: ctx.project.color,
    privacy: ctx.project.privacy,
    archived: !!ctx.project.archivedAt,
    workspaceSlug: ctx.workspace.slug,
    canEdit: ctx.canEdit,
    isGuest: ctx.isGuest,
    isProjectAdmin: ctx.isProjectAdmin,
    readOnly: ctx.readOnly,
    currentUserId: ctx.user.id,
    members,
    tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    fields: fields.map<FieldDTO>((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      options: f.options,
      required: f.required,
    })),
    milestones: milestones.map((m) => ({ id: m.id, name: m.name, date: m.date.toISOString() })),
  };
}

type TaskWithRelations = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  startDate: Date | null;
  assignees: { user: { id: string; name: string; avatarUrl: string | null } }[];
  position: number;
  createdAt: Date;
  completedAt: Date | null;
  description: string | null;
  milestoneId: string | null;
  tags: { tag: { id: string; name: string; color: string } }[];
  fieldValues: { fieldId: string; value: string | null }[];
  subtasks: { status: string }[];
  _count: { comments: number };
};

export function serializeTask(task: TaskWithRelations): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: iso(task.dueDate),
    startDate: iso(task.startDate),
    assignees: task.assignees.map((a) => a.user),
    tags: task.tags.map((t) => t.tag),
    values: Object.fromEntries(task.fieldValues.map((v) => [v.fieldId, v.value])),
    subtaskTotal: task.subtasks.length,
    subtaskDone: task.subtasks.filter((s) => s.status === "DONE").length,
    commentCount: task._count.comments,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    completedAt: iso(task.completedAt),
    description: task.description,
    milestoneId: task.milestoneId,
  };
}

export const taskInclude = {
  assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  tags: { include: { tag: true } },
  fieldValues: true,
  subtasks: { where: { deletedAt: null }, select: { status: true } },
  _count: { select: { comments: { where: { deletedAt: null } } } },
} as const;

export async function getProjectTasks(projectId: string, filters: ViewFilters): Promise<TaskDTO[]> {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);
  const weekEnd = new Date(startToday);
  weekEnd.setDate(weekEnd.getDate() + 8);

  const where: Record<string, unknown> = {
    projectId,
    deletedAt: null,
    parentTaskId: null,
  };
  if (filters.status.length) where.status = { in: filters.status };
  if (filters.priority) where.priority = filters.priority;
  if (filters.assignee === "none") where.assignees = { none: {} };
  else if (filters.assignee) where.assignees = { some: { userId: filters.assignee } };
  if (filters.tag) where.tags = { some: { tagId: filters.tag } };
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.due === "overdue") {
    where.dueDate = { lt: startToday };
    where.status = { not: "DONE" };
  } else if (filters.due === "today") {
    where.dueDate = { gte: startToday, lt: endToday };
  } else if (filters.due === "week") {
    where.dueDate = { gte: startToday, lt: weekEnd };
  } else if (filters.due === "none") {
    where.dueDate = null;
  }
  for (const [fieldId, value] of Object.entries(filters.fields)) {
    where.fieldValues = {
      some: { fieldId, value: value === "__none__" ? null : value },
    };
  }

  const orderBy =
    filters.sort === "priority"
      ? [{ priority: "desc" as const }, { dueDate: "asc" as const }]
      : filters.sort === "status"
        ? [{ status: "asc" as const }, { position: "asc" as const }]
        : filters.sort === "created"
          ? [{ createdAt: "desc" as const }]
          : filters.sort === "alpha"
            ? [{ title: "asc" as const }]
            : [{ dueDate: { sort: "asc" as const, nulls: "last" as const } }, { position: "asc" as const }];

  const tasks = await prisma.task.findMany({
    where: where as never,
    include: taskInclude,
    orderBy,
  });
  return tasks.map(serializeTask);
}

export async function getTimelineTasks(projectId: string): Promise<TaskDTO[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null, parentTaskId: null },
    include: taskInclude,
    orderBy: [{ startDate: "asc" }, { dueDate: "asc" }],
  });
  return tasks.map(serializeTask);
}

export const includeTaskForMeta = { tags: true } as const;
