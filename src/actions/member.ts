"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, requireUser } from "@/lib/auth";
import {
  countGuests,
  countSeats,
  isReadOnly,
  logAudit,
  requireWorkspace,
  requireWorkspaceAdmin,
  type WorkspaceContext,
} from "@/lib/access";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { sendEmail, appUrl } from "@/lib/email";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/actions/project";

const workspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(48),
  projectName: z.string().trim().max(120).optional(),
});

export async function createWorkspace(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = makeT(normalizeLocale(user.locale));

  const parsed = workspaceSchema.safeParse({
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
    projectName: (formData.get("projectName") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: user.locale === "en" ? "Workspace name is required." : "Nama workspace wajib diisi." };
  }

  const existing = await prisma.workspace.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return { ok: false, error: user.locale === "en" ? "That URL is already taken." : "URL tersebut sudah dipakai." };
  }

  const membershipCount = await prisma.membership.count({ where: { userId: user.id, status: "ACTIVE" } });
  if (membershipCount >= 20) return { ok: false, error: t("common.error") };

  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      ownerId: user.id,
      memberships: { create: { userId: user.id, role: "OWNER" } },
      subscription: { create: { plan: "FREE", status: "ACTIVE", seats: 1 } },
    },
  });

  let projectId: string | undefined;
  if (parsed.data.projectName) {
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: parsed.data.projectName,
        createdById: user.id,
        members: { create: { userId: user.id, role: "PROJECT_ADMIN" } },
      },
    });
    projectId = project.id;
    await prisma.task.create({
      data: {
        projectId: project.id,
        title: user.locale === "en" ? "Explore A Tracker" : "Jelajahi A Tracker",
        description:
          user.locale === "en"
            ? "Open this task, change its status, and add a comment to see collaboration in action."
            : "Buka task ini, ubah statusnya, dan tambahkan komentar untuk mencoba kolaborasi.",
        createdById: user.id,
        assignees: { create: [{ userId: user.id }] },
        dueDate: new Date(Date.now() + 2 * 86_400_000),
      },
    });
  }

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "workspace_created",
    targetType: "workspace",
    targetId: workspace.id,
  });

  redirect(`/onboarding?step=2&w=${workspace.slug}${projectId ? `&p=${projectId}` : ""}`);
}

export async function inviteMember(prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await requireWorkspaceAdmin(slug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (isReadOnly(ctx)) return { ok: false, error: t("common.readOnly") };

  const inviter = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!inviter?.emailVerified) {
    return { ok: false, error: ctx.user.locale === "en" ? "Verify your email before inviting members." : "Verifikasi email Anda sebelum mengundang anggota." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return { ok: false, error: ctx.user.locale === "en" ? "Enter a valid email." : "Masukkan email yang valid." };
  }
  const roleRaw = String(formData.get("role") ?? "MEMBER");
  const role = roleRaw === "ADMIN" ? "ADMIN" : roleRaw === "VIEWER" ? "VIEWER" : "MEMBER";

  if (role !== "VIEWER") {
    const seats = await countSeats(ctx.workspace.id);
    if (seats + 1 > ctx.limits.maxMembers) return { ok: false, error: t("members.limitReached") };
  }

  const already = await prisma.membership.findFirst({
    where: { workspaceId: ctx.workspace.id, status: "ACTIVE", user: { email } },
  });
  if (already) {
    return { ok: false, error: ctx.user.locale === "en" ? "This person is already a member." : "Orang ini sudah menjadi anggota." };
  }

  const token = randomUUID();
  const invitation = await prisma.invitation.create({
    data: {
      workspaceId: ctx.workspace.id,
      email,
      role,
      token,
      invitedById: ctx.user.id,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });

  const link = appUrl(`/invite/${token}`);
  await sendEmail({
    to: email,
    subject: `${ctx.user.name} invited you to ${ctx.workspace.name} on A Tracker`,
    text: `${ctx.user.name} (${ctx.user.email}) invited you to join ${ctx.workspace.name} as ${role.toLowerCase()}.\n${link}`,
  });

  await logAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "member_invited",
    targetType: "invitation",
    targetId: invitation.id,
    metadata: { email, role },
  });

  revalidatePath(`/w/${slug}/settings/members`);
  return { ok: true, id: invitation.id, warning: process.env.RESEND_API_KEY ? undefined : link };
}

export async function inviteGuest(projectId: string, formData: FormData): Promise<ActionResult> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await requireWorkspaceAdmin(slug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (ctx.workspace.plan === "FREE") return { ok: false, error: t("billing.lockedFeature") };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { ok: false, error: t("common.error") };

  const guests = await countGuests(ctx.workspace.id);
  if (guests >= ctx.limits.maxGuests) return { ok: false, error: t("billing.limitGuests") };

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: ctx.workspace.id, deletedAt: null },
  });
  if (!project) return { ok: false, error: t("members.notFound") };

  const token = randomUUID();
  await prisma.invitation.create({
    data: {
      workspaceId: ctx.workspace.id,
      projectId,
      email,
      role: "GUEST",
      token,
      invitedById: ctx.user.id,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  const link = appUrl(`/invite/${token}`);
  await sendEmail({
    to: email,
    subject: `${ctx.user.name} shared "${project.name}" with you`,
    text: `View progress and leave feedback on ${project.name}: ${link}`,
  });
  revalidatePath(`/w/${slug}/p/${projectId}`, "layout");
  return { ok: true, warning: process.env.RESEND_API_KEY ? undefined : link };
}

export async function revokeInvitation(workspaceSlug: string, invitationId: string): Promise<ActionResult> {
  const ctx = await requireWorkspaceAdmin(workspaceSlug);
  if (isReadOnly(ctx)) return { ok: false, error: makeT(normalizeLocale(ctx.user.locale))("common.readOnly") };
  await prisma.invitation.updateMany({
    where: { id: invitationId, workspaceId: ctx.workspace.id, acceptedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/w/${workspaceSlug}/settings/members`);
  return { ok: true };
}

export async function resendInvitation(workspaceSlug: string, invitationId: string): Promise<ActionResult> {
  const ctx = await requireWorkspaceAdmin(workspaceSlug);
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, workspaceId: ctx.workspace.id, acceptedAt: null, revokedAt: null },
  });
  if (!invitation) return { ok: false, error: makeT(normalizeLocale(ctx.user.locale))("members.notFound") };

  const token = randomUUID();
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { token, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
  });
  const link = appUrl(`/invite/${token}`);
  await sendEmail({
    to: invitation.email,
    subject: `Reminder: join ${ctx.workspace.name} on A Tracker`,
    text: link,
  });
  revalidatePath(`/w/${workspaceSlug}/settings/members`);
  return { ok: true, warning: process.env.RESEND_API_KEY ? undefined : link };
}

async function syncSeats(workspaceId: string) {
  const seats = await countSeats(workspaceId);
  await prisma.subscription.updateMany({ where: { workspaceId }, data: { seats } });
}

export async function acceptInvitation(token: string): Promise<ActionResult> {
  const user = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return { ok: false, error: "This invitation is invalid or expired." };
  }
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "This invitation was sent to a different email address." };
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: invitation.workspaceId } });
  if (!workspace) return { ok: false, error: "Workspace not found." };

  const existing = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
  });

  await prisma.$transaction([
    existing
      ? prisma.membership.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", role: existing.role },
        })
      : prisma.membership.create({
          data: { workspaceId: workspace.id, userId: user.id, role: invitation.role },
        }),
    prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ...(invitation.projectId
      ? [
          prisma.projectMember.upsert({
            where: { projectId_userId: { projectId: invitation.projectId, userId: user.id } },
            create: { projectId: invitation.projectId, userId: user.id, role: "MEMBER" },
            update: {},
          }),
        ]
      : []),
  ]);

  await syncSeats(workspace.id);
  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "invitation_accepted",
    targetType: "invitation",
    targetId: invitation.id,
    metadata: { email: user.email },
  });

  revalidatePath("/", "layout");
  redirect(invitation.projectId ? `/w/${workspace.slug}/p/${invitation.projectId}/list` : `/w/${workspace.slug}/home`);
}

export async function changeMemberRole(workspaceSlug: string, userId: string, role: string): Promise<ActionResult> {
  const ctx = await requireWorkspaceAdmin(workspaceSlug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (isReadOnly(ctx)) return { ok: false, error: t("common.readOnly") };
  if (!["ADMIN", "MEMBER", "VIEWER", "GUEST"].includes(role)) return { ok: false, error: t("common.error") };

  const target = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId } },
  });
  if (!target || target.status !== "ACTIVE") return { ok: false, error: t("members.notFound") };
  if (target.role === "OWNER") return { ok: false, error: t("common.error") };
  if (ctx.membership.role === "ADMIN" && target.role === "ADMIN" && role === "OWNER") {
    return { ok: false, error: t("common.error") };
  }
  if (userId === ctx.user.id) return { ok: false, error: t("common.error") };

  await prisma.membership.update({ where: { id: target.id }, data: { role: role as never } });
  await syncSeats(ctx.workspace.id);
  await logAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "role_changed",
    targetType: "membership",
    targetId: target.id,
    metadata: { from: target.role, to: role, userId },
  });
  revalidatePath(`/w/${workspaceSlug}/settings/members`);
  return { ok: true };
}

export async function removeMember(workspaceSlug: string, userId: string): Promise<ActionResult> {
  const ctx: WorkspaceContext = await requireWorkspaceAdmin(workspaceSlug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (isReadOnly(ctx)) return { ok: false, error: t("common.readOnly") };
  if (userId === ctx.user.id) return { ok: false, error: t("members.removeSelf") };
  if (ctx.membership.role !== "OWNER") {
    const target = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId } },
    });
    if (target?.role === "OWNER") return { ok: false, error: t("common.error") };
  }

  await prisma.$transaction([
    prisma.membership.updateMany({
      where: { workspaceId: ctx.workspace.id, userId },
      data: { status: "REMOVED" },
    }),
    prisma.taskAssignee.deleteMany({
      where: { userId, task: { project: { workspaceId: ctx.workspace.id } } },
    }),
    prisma.projectMember.deleteMany({
      where: { userId, project: { workspaceId: ctx.workspace.id } },
    }),
  ]);

  await syncSeats(ctx.workspace.id);
  await logAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "member_removed",
    targetType: "membership",
    targetId: userId,
  });
  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return { ok: true };
}

export async function updateWorkspaceSettings(workspaceSlug: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireWorkspaceAdmin(workspaceSlug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (isReadOnly(ctx)) return { ok: false, error: t("common.readOnly") };

  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? ""));
  if (!name || slug.length < 2) return { ok: false, error: t("common.error") };
  if (slug !== ctx.workspace.slug) {
    const taken = await prisma.workspace.findUnique({ where: { slug } });
    if (taken) return { ok: false, error: ctx.user.locale === "en" ? "That URL is already taken." : "URL tersebut sudah dipakai." };
  }

  await prisma.workspace.update({
    where: { id: ctx.workspace.id },
    // Logo has its own upload/remove actions; never overwrite it from this form.
    data: { name, slug },
  });
  await logAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "workspace_updated",
    targetType: "workspace",
    targetId: ctx.workspace.id,
    metadata: { name, slug },
  });
  if (slug !== ctx.workspace.slug) redirect(`/w/${slug}/settings/members`);
  revalidatePath(`/w/${slug}`, "layout");
  return { ok: true };
}

export async function createTag(workspaceSlug: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireWorkspaceAdmin(workspaceSlug);
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#64748B");
  if (!name) return { ok: false, error: makeT(normalizeLocale(ctx.user.locale))("common.error") };
  try {
    const tag = await prisma.tag.create({
      data: { workspaceId: ctx.workspace.id, name, color },
    });
    revalidatePath(`/w/${workspaceSlug}`, "layout");
    return { ok: true, id: tag.id };
  } catch {
    return { ok: false, error: makeT(normalizeLocale(ctx.user.locale))("common.error") };
  }
}

export async function deleteTag(workspaceSlug: string, tagId: string): Promise<ActionResult> {
  const ctx = await requireWorkspaceAdmin(workspaceSlug);
  await prisma.tag.deleteMany({ where: { id: tagId, workspaceId: ctx.workspace.id } });
  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return { ok: true };
}

/* ------------------------------ profile ------------------------------ */

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const jar = await cookies();
  const name = String(formData.get("name") ?? "").trim();
  const locale = normalizeLocale(String(formData.get("locale") ?? user.locale));
  const timezone = String(formData.get("timezone") ?? user.timezone);
  const dateFormat = String(formData.get("dateFormat") ?? user.dateFormat);
  const theme = ["light", "dark", "system"].includes(String(formData.get("theme"))) ? String(formData.get("theme")) : "system";
  const animations = formData.get("animations") === "on";

  await prisma.user.update({
    where: { id: user.id },
    data: { name: name || user.name, locale, timezone, dateFormat, theme, animations },
  });

  const prefs = {
    assignmentEmail: formData.get("assignmentEmail") === "on",
    mentionEmail: formData.get("mentionEmail") === "on",
    commentEmail: formData.get("commentEmail") === "on",
    dueDateEmail: formData.get("dueDateEmail") === "on",
    digestEmail: formData.get("digestEmail") === "on",
    inApp: formData.get("inApp") === "on",
  };
  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...prefs },
    update: prefs,
  });

  jar.set("at_locale", locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  jar.set("at_theme", theme, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  jar.set("at_motion", animations ? "on" : "off", { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true };
}

function detectImage(buffer: Buffer): "png" | "jpg" | "gif" | "webp" | null {
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length > 6 && buffer.subarray(0, 4).toString("ascii") === "GIF8") return "gif";
  if (buffer.length > 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

const AVATAR_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = makeT(normalizeLocale(user.locale));
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: t("common.error") };
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: user.locale === "en" ? "Avatar max 5 MB." : "Avatar maksimal 5 MB." };
  }
  const ext = AVATAR_TYPES[file.type];
  if (!ext) {
    return {
      ok: false,
      error: user.locale === "en" ? "Use PNG, JPG, WebP, or GIF." : "Gunakan PNG, JPG, WebP, atau GIF.",
    };
  }

  const root = path.join(process.cwd(), process.env.UPLOAD_DIR ?? "public/uploads");
  const key = `avatars/${user.id}-${randomUUID()}.${ext}`;
  const fullPath = path.join(root, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));

  const previous = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } });
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: `/uploads/${key}` } });

  // Clean up the old local avatar (never touch external/seed URLs).
  if (previous?.avatarUrl?.startsWith("/uploads/avatars/")) {
    try {
      await unlink(path.join(root, previous.avatarUrl.replace("/uploads/", "")));
    } catch {
      /* already gone */
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, id: `/uploads/${key}` };
}

export async function uploadWorkspaceLogo(workspaceSlug: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireWorkspaceAdmin(workspaceSlug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (isReadOnly(ctx)) return { ok: false, error: t("common.readOnly") };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: t("common.error") };
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: ctx.user.locale === "en" ? "Logo max 5 MB." : "Logo maksimal 5 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Validate the real file signature instead of trusting the browser MIME type.
  const ext = detectImage(buffer);
  if (!ext) {
    return {
      ok: false,
      error: ctx.user.locale === "en" ? "Use a PNG, JPG, WebP, or GIF image." : "Gunakan gambar PNG, JPG, WebP, atau GIF.",
    };
  }

  const root = path.join(process.cwd(), process.env.UPLOAD_DIR ?? "public/uploads");
  const key = `workspaces/${ctx.workspace.id}-${randomUUID()}.${ext}`;
  const fullPath = path.join(root, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);

  const previous = ctx.workspace.logoUrl;
  await prisma.workspace.update({ where: { id: ctx.workspace.id }, data: { logoUrl: `/uploads/${key}` } });

  if (previous?.startsWith("/uploads/workspaces/")) {
    try {
      await unlink(path.join(root, previous.replace("/uploads/", "")));
    } catch {
      /* already gone */
    }
  }

  await logAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "workspace_logo_changed",
    targetType: "workspace",
    targetId: ctx.workspace.id,
  });

  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return { ok: true, id: `/uploads/${key}` };
}

export async function removeWorkspaceLogo(workspaceSlug: string): Promise<ActionResult> {
  const ctx = await requireWorkspaceAdmin(workspaceSlug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (isReadOnly(ctx)) return { ok: false, error: t("common.readOnly") };

  const previous = ctx.workspace.logoUrl;
  await prisma.workspace.update({ where: { id: ctx.workspace.id }, data: { logoUrl: null } });

  if (previous?.startsWith("/uploads/workspaces/")) {
    const root = path.join(process.cwd(), process.env.UPLOAD_DIR ?? "public/uploads");
    try {
      await unlink(path.join(root, previous.replace("/uploads/", "")));
    } catch {
      /* already gone */
    }
  }

  await logAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "workspace_logo_removed",
    targetType: "workspace",
    targetId: ctx.workspace.id,
  });

  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return { ok: true };
}

export async function removeAvatar(): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTheme(theme: string): Promise<ActionResult> {
  const user = await requireUser();
  const value = ["light", "dark", "system"].includes(theme) ? theme : "system";
  await prisma.user.update({ where: { id: user.id }, data: { theme: value } });
  const jar = await cookies();
  jar.set("at_theme", value, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  return { ok: true };
}

export async function revokeSession(sessionId: string): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.session.updateMany({
    where: { id: sessionId, userId: user.id },
    data: { revokedAt: new Date() },
  });
  return { ok: true };
}

export async function logoutAllSessions() {
  const user = await requireUser();
  await prisma.session.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const jar = await cookies();
  jar.delete("at_session");
  redirect("/login");
}

export async function deleteAccount(): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: new Date(),
        email: `deleted-${user.id}@atracker.invalid`,
        name: "Former member",
        avatarUrl: null,
      },
    }),
    prisma.session.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }),
    prisma.membership.updateMany({ where: { userId: user.id }, data: { status: "REMOVED" } }),
    prisma.projectMember.deleteMany({ where: { userId: user.id } }),
    prisma.taskAssignee.deleteMany({ where: { userId: user.id } }),
    prisma.verificationToken.deleteMany({ where: { userId: user.id } }),
  ]);
  const jar = await cookies();
  jar.delete("at_session");
  redirect("/login");
}
