import Link from "next/link";
import {
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  Clock,
  FolderSimple,
  Sparkle,
  WarningCircle,
  Fire,
} from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/db";
import { canWrite, isAdmin, requireWorkspace } from "@/lib/access";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { addDays, endOfDay, formatDate, isOverdue, startOfDay } from "@/lib/format";
import { Badge, Card, EmptyState, Progress } from "@/components/ui/primitives";
import { NewProjectButton } from "@/components/layout/app-shell";
import { TaskRow, type TaskRowData } from "@/components/task/task-row";
import { cn } from "@/lib/utils";

export default async function HomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  const admin = isAdmin(ctx.membership.role);
  const guest = ctx.membership.role === "GUEST";

  const projectMemberships = await prisma.projectMember.findMany({
    where: { userId: ctx.user.id, project: { workspaceId: ctx.workspace.id } },
    select: { projectId: true },
  });
  const myProjectIds = new Set(projectMemberships.map((p) => p.projectId));

  const allProjects = await prisma.project.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      tasks: { where: { deletedAt: null }, select: { status: true, dueDate: true } },
      _count: { select: { members: true } },
    },
  });

  const visibleProjects = allProjects.filter((p) => {
    if (guest) return myProjectIds.has(p.id);
    if (p.privacy === "PRIVATE") return admin || myProjectIds.has(p.id);
    return true;
  });
  const projectIds = visibleProjects.map((p) => p.id);
  const projectMeta = new Map(visibleProjects.map((p) => [p.id, p]));

  const tasks = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      assignees: { some: { userId: ctx.user.id } },
      deletedAt: null,
      // Include every level: subtasks assigned to me are still my tasks.
    },
    include: {
      project: { select: { name: true, color: true } },
      parent: { select: { id: true, title: true } },
      assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      tags: { include: { tag: true } },
      _count: { select: { comments: true } },
      subtasks: { where: { deletedAt: null }, select: { status: true } },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
  });

  const today = startOfDay(new Date());
  const weekEnd = endOfDay(addDays(today, 7));

  const toRow = (task: (typeof tasks)[number]): TaskRowData => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    assignees: task.assignees.map((a) => a.user),
    projectId: task.projectId,
    projectName: task.project.name,
    projectColor: task.project.color,
    workspaceSlug: slug,
    parent: task.parent ? { id: task.parent.id, title: task.parent.title } : null,
    commentCount: task._count.comments,
    subtaskTotal: task.subtasks.length,
    subtaskDone: task.subtasks.filter((s) => s.status === "DONE").length,
    overdue: isOverdue(task.dueDate, task.status),
    tags: task.tags.map((tt) => tt.tag),
  });

  const activeTasks = tasks.filter((task) => task.status !== "DONE");
  const overdue = activeTasks.filter((task) => task.dueDate && new Date(task.dueDate) < today);
  const dueToday = activeTasks.filter((task) => task.dueDate && new Date(task.dueDate) >= today && new Date(task.dueDate) <= endOfDay(today));
  const upcoming = activeTasks.filter((task) => task.dueDate && new Date(task.dueDate) > endOfDay(today) && new Date(task.dueDate) <= weekEnd);

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const doneThisWeek = tasks.filter((task) => task.status === "DONE" && task.completedAt && task.completedAt >= weekAgo).length;
  const overdueAll = visibleProjects.reduce(
    (acc, project) => acc + project.tasks.filter((task) => isOverdue(task.dueDate, task.status)).length,
    0,
  );

  const dateLabel = new Intl.DateTimeFormat(ctx.user.locale === "en" ? "en-US" : "id-ID", {
    timeZone: ctx.user.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const stats = [
    { label: t("home.statsActive"), value: visibleProjects.length, icon: <FolderSimple size={17} />, tone: "text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300" },
    { label: t("home.statsOverdue"), value: overdueAll, icon: <WarningCircle size={17} />, tone: "text-red-600 bg-red-50 dark:bg-red-950/60 dark:text-red-300" },
    { label: t("home.statsDone"), value: doneThisWeek, icon: <CheckCircle size={17} />, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300" },
  ];

  const noProjects = visibleProjects.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">{dateLabel}</p>
          <h1 className="mt-0.5 text-[24px] font-bold tracking-[-0.02em]">
            {t("home.greeting")}, {ctx.user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("app.tagline")}</p>
        </div>
        {canWrite(ctx.membership.role) && !guest ? <NewProjectButton workspaceSlug={slug} /> : null}
      </div>

      <div className="stagger-list mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="flex items-center gap-3 p-4">
            <span className={cn("grid h-9 w-9 place-items-center rounded-lg", stat.tone)}>{stat.icon}</span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold leading-tight">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {noProjects ? (
        <Card className="mt-5">
          <EmptyState
            icon={<FolderSimple size={22} />}
            title={t("home.noProjects")}
            description={t("home.noProjectsBody")}
            action={
              canWrite(ctx.membership.role) && !guest ? (
                <NewProjectButton workspaceSlug={slug} label={t("home.quickCreate")} />
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0 space-y-5">
            <section>
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                  {t("home.myTasks")}
                  {overdue.length > 0 && <Badge tone="danger">{overdue.length} {t("common.overdue").toLowerCase()}</Badge>}
                </h2>
                <Link href={`/w/${slug}/projects`} className="text-[12px] font-medium text-primary hover:underline">
                  {t("home.allProjects")}
                </Link>
              </div>

              <Card className="overflow-hidden">
                {overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0 ? (
                  <EmptyState icon={<Sparkle size={22} />} title={t("home.empty")} />
                ) : (
                  <>
                    <TaskGroup title={t("home.overdue")} icon={<Fire size={14} className="text-red-500" />} tasks={overdue.map(toRow)} />
                    <TaskGroup title={t("home.today")} icon={<CalendarBlank size={14} className="text-blue-500" />} tasks={dueToday.map(toRow)} />
                    <TaskGroup title={t("home.upcoming")} icon={<Clock size={14} className="text-amber-500" />} tasks={upcoming.map(toRow)} />
                  </>
                )}
              </Card>
            </section>

            {tasks.filter((task) => !task.dueDate && task.status !== "DONE").length > 0 && (
              <section>
                <h2 className="mb-2.5 text-[15px] font-semibold tracking-tight">{t("view.unscheduled")}</h2>
                <Card className="overflow-hidden">
                  {tasks
                    .filter((task) => !task.dueDate && task.status !== "DONE")
                    .slice(0, 5)
                    .map((task) => (
                      <TaskRow key={task.id} task={toRow(task)} />
                    ))}
                </Card>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold tracking-tight">{t("home.recent")}</h2>
            </div>
            <div className="stagger-list space-y-2.5">
              {visibleProjects.slice(0, 4).map((project) => {
                const total = project.tasks.length;
                const done = project.tasks.filter((task) => task.status === "DONE").length;
                const percent = total ? Math.round((done / total) * 100) : 0;
                return (
                  <Link key={project.id} href={`/w/${slug}/p/${project.id}/list`} className="block">
                    <Card className="hover-lift p-3.5 transition hover:border-border-strong">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: project.color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold">{project.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {total} {t("projects.tasks")} · {project._count.members} {t("projects.members")}
                            {project.dueDate ? ` · ${formatDate(project.dueDate, normalizeLocale(ctx.user.locale), ctx.user.timezone, ctx.user.dateFormat)}` : ""}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Progress value={percent} className="h-1" />
                            <span className="text-[10px] font-semibold text-muted-foreground">{percent}%</span>
                          </div>
                        </div>
                        <ArrowRight size={14} className="mt-1 text-muted-foreground" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>

            <Card className="border-dashed bg-surface-muted/40 p-4">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                <Sparkle size={14} weight="fill" className="text-amber-500" />
                {t("search.hint")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {ctx.user.locale === "en"
                  ? "Jump to any task, project, or teammate without leaving the keyboard."
                  : "Lompat ke task, project, atau anggota mana pun tanpa meninggalkan keyboard."}
              </p>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}

function TaskGroup({
  title,
  icon,
  tasks,
}: {
  title: string;
  icon: React.ReactNode;
  tasks: TaskRowData[];
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
        <span className="ml-auto rounded bg-surface px-1.5 text-[10px]">{tasks.length}</span>
      </div>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </div>
  );
}
