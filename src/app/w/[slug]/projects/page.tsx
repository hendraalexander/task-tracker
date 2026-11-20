import Link from "next/link";
import { Archive, ArrowRight, FolderSimple, Lock, Users } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/db";
import { canWrite, isAdmin, requireWorkspace } from "@/lib/access";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { Avatar, Badge, Card, EmptyState, Progress } from "@/components/ui/primitives";
import { NewProjectButton } from "@/components/layout/app-shell";
import { ProjectArchiveButton } from "@/components/project/archive-button";
import { cn } from "@/lib/utils";

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const ctx = await requireWorkspace(slug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  const admin = isAdmin(ctx.membership.role);
  const guest = ctx.membership.role === "GUEST";
  const archivedTab = tab === "archived";

  const [memberships, projects] = await Promise.all([
    prisma.projectMember.findMany({ where: { userId: ctx.user.id }, select: { projectId: true } }),
    prisma.project.findMany({
      where: { workspaceId: ctx.workspace.id, deletedAt: null },
      orderBy: { position: "asc" },
      include: {
        tasks: { where: { deletedAt: null }, select: { status: true, dueDate: true } },
        members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } }, take: 4 },
        _count: { select: { members: true } },
      },
    }),
  ]);

  const myProjects = new Set(memberships.map((m) => m.projectId));
  const visible = projects.filter((p) => {
    if (guest) return myProjects.has(p.id);
    if (p.privacy === "PRIVATE") return admin || myProjects.has(p.id);
    return true;
  });

  const active = visible.filter((p) => !p.archivedAt);
  const archived = visible.filter((p) => p.archivedAt);
  const list = archivedTab ? archived : active;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">{t("projects.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("projects.subtitle")}</p>
        </div>
        {!guest && canWrite(ctx.membership.role) ? <NewProjectButton workspaceSlug={slug} /> : null}
      </div>

      <div className="mt-5 flex items-center gap-1 border-b border-border">
        <Link
          href={`/w/${slug}/projects`}
          className={cn(
            "border-b-2 px-3 py-2 text-[13px] font-medium transition",
            !archivedTab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t("projects.active")}
          <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px]">{active.length}</span>
        </Link>
        <Link
          href={`/w/${slug}/projects?tab=archived`}
          className={cn(
            "border-b-2 px-3 py-2 text-[13px] font-medium transition",
            archivedTab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t("projects.archived")}
          <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px]">{archived.length}</span>
        </Link>
      </div>

      {list.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={archivedTab ? <Archive size={22} /> : <FolderSimple size={22} />}
            title={archivedTab ? t("projects.archived") : t("projects.empty")}
            description={archivedTab ? undefined : t("projects.emptyBody")}
            action={!archivedTab && !guest ? <NewProjectButton workspaceSlug={slug} /> : undefined}
          />
        </Card>
      ) : (
        <div className="stagger-list mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((project) => {
            const total = project.tasks.length;
            const done = project.tasks.filter((task) => task.status === "DONE").length;
            const overdue = project.tasks.filter(
              (task) => task.status !== "DONE" && task.dueDate && new Date(task.dueDate) < new Date(),
            ).length;
            const percent = total ? Math.round((done / total) * 100) : 0;

            return (
              <Card key={project.id} className="group hover-lift overflow-hidden transition hover:border-border-strong">
                <Link href={`/w/${slug}/p/${project.id}/list`} className="block p-4">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
                      style={{ background: project.color }}
                    >
                      <FolderSimple size={17} weight="fill" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-semibold leading-snug">{project.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={project.privacy === "PRIVATE" ? "warning" : "neutral"}>
                          {project.privacy === "PRIVATE" ? <Lock size={10} /> : null}
                          {project.privacy === "PRIVATE" ? t("projects.private") : t("projects.public")}
                        </Badge>
                        {overdue > 0 && <Badge tone="danger">{overdue} {t("common.overdue").toLowerCase()}</Badge>}
                      </div>
                    </div>
                  </div>

                  {project.description && (
                    <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{project.description}</p>
                  )}

                  <div className="mt-3.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{done}/{total} {t("projects.tasks")}</span>
                      <span className="font-semibold text-foreground">{percent}%</span>
                    </div>
                    <Progress value={percent} className="mt-1.5" barClassName={overdue > 0 ? "bg-amber-500" : "bg-emerald-500"} />
                  </div>

                  <div className="mt-3.5 flex items-center justify-between">
                    <div className="flex items-center -space-x-1.5">
                      {project.members.slice(0, 4).map((m) => (
                        <Avatar key={m.user.id} name={m.user.name} src={m.user.avatarUrl} size={22} ring />
                      ))}
                      {project._count.members > 4 && (
                        <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-surface-muted text-[9px] font-semibold ring-2 ring-surface">
                          +{project._count.members - 4}
                        </span>
                      )}
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users size={12} /> {project._count.members}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      {project.dueDate ? formatDate(project.dueDate, normalizeLocale(ctx.user.locale), ctx.user.timezone, ctx.user.dateFormat) : ""}
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>

                {archivedTab && admin && (
                  <div className="border-t border-border bg-surface-muted/40 px-4 py-2">
                    <ProjectArchiveButton projectId={project.id} archived />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
