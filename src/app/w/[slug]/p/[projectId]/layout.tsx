import type { ReactNode } from "react";
import Link from "next/link";
import { Archive, Lock, WarningCircle, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { requireProject } from "@/lib/access";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { Badge } from "@/components/ui/primitives";
import { ProjectTabs } from "@/components/project/project-tabs";
import { ProjectArchiveButton } from "@/components/project/archive-button";
import { ShareProjectButton } from "@/components/project/share-project";
import { TaskDrawerHost } from "@/components/task/task-drawer";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const ctx = await requireProject(slug, projectId);
  const t = makeT(normalizeLocale(ctx.user.locale));

  return (
    <div className="flex min-h-[calc(100dvh-52px)] flex-col">
      <div className="border-b border-border bg-surface/60">
        <div className="mx-auto w-full max-w-[1400px] px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: ctx.project.color }} />
                <h1 className="truncate text-[19px] font-bold tracking-[-0.02em]">{ctx.project.name}</h1>
                {ctx.project.privacy === "PRIVATE" && (
                  <Badge tone="warning">
                    <Lock size={10} /> {t("projects.private")}
                  </Badge>
                )}
                {ctx.project.archivedAt && (
                  <Badge tone="neutral">
                    <Archive size={10} /> {t("projects.archived")}
                  </Badge>
                )}
              </div>
              {ctx.project.description && (
                <p className="mt-1 line-clamp-1 max-w-2xl text-[12.5px] text-muted-foreground">{ctx.project.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {ctx.isProjectAdmin && !ctx.project.archivedAt && (
                <ShareProjectButton
                  workspaceSlug={slug}
                  projectId={projectId}
                  projectName={ctx.project.name}
                  canInviteGuest={ctx.workspace.plan !== "FREE"}
                />
              )}
              {ctx.isProjectAdmin && ctx.project.archivedAt && (
                <ProjectArchiveButton projectId={projectId} archived />
              )}
            </div>
          </div>

          {(ctx.project.archivedAt || ctx.readOnly) && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              <WarningCircle size={15} className="shrink-0" />
              {ctx.project.archivedAt
                ? t("projects.archiveConfirm")
                : t("billing.readOnlyBanner")}
            </div>
          )}

          <div className="mt-3">
            <ProjectTabs workspaceSlug={slug} projectId={projectId} canManage={ctx.isProjectAdmin} />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">{children}</div>
      <TaskDrawerHost />
    </div>
  );
}
