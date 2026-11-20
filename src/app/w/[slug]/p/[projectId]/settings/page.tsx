import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/access";
import { loadProjectMeta } from "@/lib/views";
import { normalizeLocale } from "@/lib/i18n";
import { ProjectSettings } from "@/components/project/project-settings";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const ctx = await requireProject(slug, projectId);
  if (!ctx.isProjectAdmin) notFound();

  const [meta, workspaceUsers] = await Promise.all([
    loadProjectMeta(ctx),
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspace.id, status: "ACTIVE", role: { not: "GUEST" } },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6">
      <ProjectSettings
        meta={meta}
        project={{
          name: ctx.project.name,
          description: ctx.project.description,
          startDate: ctx.project.startDate?.toISOString() ?? null,
          dueDate: ctx.project.dueDate?.toISOString() ?? null,
          privacy: ctx.project.privacy,
          color: ctx.project.color,
          archived: !!ctx.project.archivedAt,
        }}
        members={meta.members}
        workspaceUsers={workspaceUsers.map((m) => m.user)}
        fields={meta.fields}
        milestones={meta.milestones}
        customFieldsAvailable={ctx.limits.customFields}
        locale={normalizeLocale(ctx.user.locale)}
      />
    </div>
  );
}
