"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  canWrite,
  isAdmin,
  isReadOnly,
  logAudit,
  planLimits,
  requireProject,
  requireWorkspace,
  type WorkspaceContext,
} from "@/lib/access";
import { normalizeLocale, makeT } from "@/lib/i18n";
import { PROJECT_COLORS } from "@/lib/utils";

export type ActionResult = { ok: boolean; error?: string; warning?: string; id?: string; needsConfirm?: boolean };

const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  privacy: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
});

const dateOrNull = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

function guardWrite(ctx: WorkspaceContext, locale: string): string | null {
  const t = makeT(normalizeLocale(locale));
  if (isReadOnly(ctx)) return t("common.readOnly");
  if (!canWrite(ctx.membership.role)) return t("common.error");
  return null;
}

export async function createProject(workspaceSlug: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireWorkspace(workspaceSlug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  const blocked = guardWrite(ctx, ctx.user.locale);
  if (blocked) return { ok: false, error: blocked };
  if (!isAdmin(ctx.membership.role) && ctx.membership.role !== "MEMBER") {
    return { ok: false, error: t("common.error") };
  }

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    color: formData.get("color") || undefined,
    privacy: (formData.get("privacy") as string) || undefined,
    startDate: (formData.get("startDate") as string) || undefined,
    dueDate: (formData.get("dueDate") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: ctx.user.locale === "en" ? "Project name is required." : "Nama project wajib diisi." };
  }

  const limits = planLimits(ctx.workspace.plan);
  const count = await prisma.project.count({
    where: { workspaceId: ctx.workspace.id, deletedAt: null, archivedAt: null },
  });
  if (count >= limits.maxProjects) return { ok: false, error: t("billing.limitProjects") };

  const project = await prisma.project.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color ?? PROJECT_COLORS[count % PROJECT_COLORS.length],
      privacy: parsed.data.privacy ?? "PUBLIC",
      startDate: dateOrNull(parsed.data.startDate),
      dueDate: dateOrNull(parsed.data.dueDate),
      createdById: ctx.user.id,
      position: (count + 1) * 1000,
      members: { create: { userId: ctx.user.id, role: "PROJECT_ADMIN" } },
    },
  });

  await logAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "project_created",
    targetType: "project",
    targetId: project.id,
    metadata: { name: project.name },
  });

  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return { ok: true, id: project.id };
}

export async function createProjectAndRedirect(workspaceSlug: string, formData: FormData) {
  const result = await createProject(workspaceSlug, formData);
  if (!result.ok) return result;
  redirect(`/w/${workspaceSlug}/p/${result.id}/list`);
}

export async function updateProject(projectId: string, formData: FormData): Promise<ActionResult> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await requireProject(slug, projectId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (!ctx.isProjectAdmin) return { ok: false, error: t("common.error") };
  if (ctx.readOnly) return { ok: false, error: t("common.readOnly") };

  const patch: Record<string, unknown> = {};
  const name = formData.get("name");
  if (typeof name === "string" && name.trim()) patch.name = name.trim().slice(0, 120);
  if (formData.has("description")) patch.description = String(formData.get("description") ?? "").slice(0, 2000) || null;
  if (formData.get("color")) patch.color = String(formData.get("color"));
  if (formData.get("startDate") !== null) patch.startDate = dateOrNull(formData.get("startDate") as string);
  if (formData.get("dueDate") !== null) patch.dueDate = dateOrNull(formData.get("dueDate") as string);
  if (formData.get("privacy")) patch.privacy = formData.get("privacy") === "PRIVATE" ? "PRIVATE" : "PUBLIC";

  await prisma.project.update({ where: { id: projectId }, data: patch });
  await logAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "project_updated",
    targetType: "project",
    targetId: projectId,
    metadata: patch as Record<string, unknown>,
  });

  revalidatePath(`/w/${slug}`, "layout");
  return { ok: true };
}

export async function archiveProject(projectId: string): Promise<ActionResult> {
  const ctx = await requireProjectById(projectId);
  if (!ctx) return { ok: false, error: "Not found" };
  if (!ctx.isProjectAdmin) return { ok: false, error: makeT(normalizeLocale(ctx.user.locale))("common.error") };
  await prisma.project.update({ where: { id: projectId }, data: { archivedAt: new Date() } });
  await logAudit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "project_archived", targetType: "project", targetId: projectId });
  revalidatePath(`/w/${ctx.workspace.slug}`, "layout");
  return { ok: true };
}

export async function restoreProject(projectId: string): Promise<ActionResult> {
  const ctx = await requireProjectById(projectId);
  if (!ctx) return { ok: false, error: "Not found" };
  if (!ctx.isProjectAdmin) return { ok: false, error: makeT(normalizeLocale(ctx.user.locale))("common.error") };
  await prisma.project.update({ where: { id: projectId }, data: { archivedAt: null } });
  revalidatePath(`/w/${ctx.workspace.slug}`, "layout");
  return { ok: true };
}

export async function deleteProject(projectId: string, confirmName: string): Promise<ActionResult> {
  const ctx = await requireProjectById(projectId);
  if (!ctx) return { ok: false, error: "Not found" };
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (!ctx.isProjectAdmin) return { ok: false, error: t("common.error") };
  if (confirmName.trim() !== ctx.project.name) return { ok: false, error: t("common.error") };
  await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });
  await logAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "project_deleted",
    targetType: "project",
    targetId: projectId,
    metadata: { name: ctx.project.name },
  });
  revalidatePath(`/w/${ctx.workspace.slug}`, "layout");
  redirect(`/w/${ctx.workspace.slug}/projects`);
}

/** Resolve a project by id alone (for actions without a slug in the payload). */
async function requireProjectById(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { workspace: { include: { subscription: true } } },
  });
  if (!project) return null;
  try {
    const ctx = await requireProject(project.workspace.slug, projectId);
    return ctx;
  } catch {
    return null;
  }
}

export async function upsertMilestone(projectId: string, formData: FormData): Promise<ActionResult> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await requireProject(slug, projectId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (!ctx.isProjectAdmin || ctx.readOnly) return { ok: false, error: t("common.error") };

  const id = String(formData.get("milestoneId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const date = dateOrNull(formData.get("date") as string);
  if (!name || !date) return { ok: false, error: t("common.error") };

  if (id) {
    await prisma.milestone.updateMany({ where: { id, projectId }, data: { name, date } });
  } else {
    await prisma.milestone.create({ data: { projectId, name, date, createdBy: ctx.user.id } });
  }
  revalidatePath(`/w/${slug}/p/${projectId}`, "layout");
  return { ok: true };
}

export async function deleteMilestone(projectId: string, milestoneId: string): Promise<ActionResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { workspace: true } });
  if (!project) return { ok: false };
  const ctx = await requireProject(project.workspace.slug, projectId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (!ctx.isProjectAdmin || ctx.readOnly) return { ok: false, error: t("common.error") };
  await prisma.milestone.deleteMany({ where: { id: milestoneId, projectId } });
  revalidatePath(`/w/${project.workspace.slug}/p/${projectId}`, "layout");
  return { ok: true };
}

export async function createCustomField(projectId: string, formData: FormData): Promise<ActionResult> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await requireProject(slug, projectId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (!ctx.isProjectAdmin || ctx.readOnly) return { ok: false, error: t("common.error") };
  if (!ctx.limits.customFields) return { ok: false, error: t("billing.lockedFeature") };

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "TEXT");
  const optionsRaw = String(formData.get("options") ?? "");
  const allowed = ["TEXT", "NUMBER", "DATE", "SINGLE_SELECT", "MULTI_SELECT", "CHECKBOX", "PERSON"];
  if (!name || !allowed.includes(type)) return { ok: false, error: t("common.error") };

  const options = ["SINGLE_SELECT", "MULTI_SELECT"].includes(type)
    ? optionsRaw.split(",").map((o) => o.trim()).filter(Boolean)
    : [];

  const count = await prisma.customField.count({ where: { projectId } });
  await prisma.customField.create({
    data: { projectId, name, type: type as never, options, required: formData.get("required") === "on", position: count },
  });
  revalidatePath(`/w/${slug}/p/${projectId}`, "layout");
  return { ok: true };
}

export async function deleteCustomField(projectId: string, fieldId: string): Promise<ActionResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { workspace: true } });
  if (!project) return { ok: false };
  const ctx = await requireProject(project.workspace.slug, projectId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (!ctx.isProjectAdmin || ctx.readOnly) return { ok: false, error: t("common.error") };
  // Values are removed by the FK cascade after explicit confirmation in the UI.
  await prisma.customFieldValue.deleteMany({ where: { fieldId, field: { projectId } } });
  await prisma.customField.deleteMany({ where: { id: fieldId, projectId } });
  revalidatePath(`/w/${project.workspace.slug}/p/${projectId}`, "layout");
  return { ok: true };
}

export async function addProjectMember(projectId: string, formData: FormData): Promise<ActionResult> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await requireProject(slug, projectId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (!ctx.isProjectAdmin || ctx.readOnly) return { ok: false, error: t("common.error") };

  const userId = String(formData.get("userId") ?? "");
  const role = formData.get("role") === "PROJECT_ADMIN" ? "PROJECT_ADMIN" : "MEMBER";
  if (!userId) return { ok: false, error: t("common.error") };

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId } },
  });
  if (!membership || membership.status !== "ACTIVE") return { ok: false, error: t("members.notFound") };

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role },
    update: { role },
  });
  revalidatePath(`/w/${slug}/p/${projectId}`, "layout");
  return { ok: true };
}

export async function removeProjectMember(projectId: string, userId: string): Promise<ActionResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { workspace: true } });
  if (!project) return { ok: false };
  const ctx = await requireProject(project.workspace.slug, projectId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (!ctx.isProjectAdmin || ctx.readOnly) return { ok: false, error: t("common.error") };
  if (userId === ctx.user.id && !isAdmin(ctx.membership.role)) return { ok: false, error: t("common.error") };

  await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  // Tasks assigned to a removed guest must stop referencing an inaccessible assignee.
  await prisma.taskAssignee.deleteMany({ where: { userId, task: { projectId } } });
  revalidatePath(`/w/${project.workspace.slug}/p/${projectId}`, "layout");
  return { ok: true };
}
