import Link from "next/link";
import { ArrowRight, ChartLineUp, WarningCircle, UsersThree, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/access";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { formatDate, isOverdue } from "@/lib/format";
import { Avatar, Badge, Card, Progress } from "@/components/ui/primitives";
import { STATUS_STYLES, cn } from "@/lib/utils";

const DONE_COLOR = "#059669";

export default async function DashboardPage({ params }: { params: Promise<{ slug: string; projectId: string }> }) {
  const { slug, projectId } = await params;
  const ctx = await requireProject(slug, projectId);
  const t = makeT(normalizeLocale(ctx.user.locale));
  const locale = normalizeLocale(ctx.user.locale);

  const [tasks, members, milestones] = await Promise.all([
    prisma.task.findMany({
      where: { projectId, deletedAt: null, parentTaskId: null },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        assignees: { select: { userId: true } },
      },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.milestone.findMany({ where: { projectId }, orderBy: { date: "asc" } }),
  ]);

  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "DONE").length;
  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const overdue = tasks
    .filter((task) => isOverdue(task.dueDate, task.status))
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));

  const statusCounts = (["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const).map((status) => ({
    status,
    count: tasks.filter((task) => task.status === status).length,
  }));

  const memberIds = new Set(members.map((m) => m.user.id));
  const extraAssigneeIds = [...new Set(tasks.flatMap((task) => task.assignees.map((a) => a.userId)))].filter(
    (id) => !memberIds.has(id),
  );
  const extraUsers = extraAssigneeIds.length
    ? await prisma.user.findMany({
        where: { id: { in: extraAssigneeIds } },
        select: { id: true, name: true, avatarUrl: true },
      })
    : [];

  const workload = [...members.map((m) => m.user), ...extraUsers]
    .map((user) => {
      const active = tasks.filter((task) => task.assignees.some((a) => a.userId === user.id) && task.status !== "DONE");
      const completed = tasks.filter((task) => task.assignees.some((a) => a.userId === user.id) && task.status === "DONE");
      return { member: user, active: active.length, completed: completed.length };
    })
    .filter((item) => item.active + item.completed > 0)
    .sort((a, b) => b.active - a.active);
  const unassigned = tasks.filter((task) => task.assignees.length === 0 && task.status !== "DONE").length;

  // 8-week completion trend
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const count = tasks.filter(
      (task) => task.completedAt && task.completedAt >= start && task.completedAt <= end,
    ).length;
    return { start, end, count };
  }).reverse();
  const trendMax = Math.max(1, ...weeks.map((w) => w.count));

  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">{t("dash.title")}</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {total} {t("dash.tasksCount")} · {t("dash.done")} {done} · {t("dash.inProgress")} {inProgress}
          </p>
        </div>
        <Link href={`/w/${slug}/p/${projectId}/list`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
          {t("dash.viewTasks")} <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="flex items-center gap-5 p-4">
          <div className="relative h-[112px] w-[112px] shrink-0">
            <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90">
              <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--surface-muted)" strokeWidth="10" />
              <circle
                cx="56"
                cy="56"
                r={radius}
                fill="none"
                stroke={DONE_COLOR}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (circumference * percent) / 100}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold leading-none">{percent}%</span>
              <span className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{t("dash.completion")}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("dash.total")}</p>
            <p className="text-2xl font-bold leading-none">{total}</p>
            <p className="text-[11px] text-muted-foreground">
              {done} {t("common.done").toLowerCase()} · {total - done} {t("status.TODO").toLowerCase()}
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("dash.statusDist")}</p>
          <div className="space-y-2">
            {statusCounts.map(({ status, count }) => (
              <div key={status}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_STYLES[status].bar }} />
                    {t(`status.${status}` as never)}
                  </span>
                  <span className="font-semibold">{count}</span>
                </div>
                <Progress
                  value={total ? (count / total) * 100 : 0}
                  className="h-1.5"
                  barClassName={cn(
                    "transition-none",
                    status === "DONE"
                      ? "bg-emerald-500"
                      : status === "IN_PROGRESS"
                        ? "bg-blue-500"
                        : status === "IN_REVIEW"
                          ? "bg-amber-500"
                          : "bg-slate-400",
                  )}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <WarningCircle size={13} /> {t("dash.overdue")}
            {overdue.length > 0 && <Badge tone="danger">{overdue.length}</Badge>}
          </p>
          {overdue.length === 0 ? (
            <div className="flex h-[92px] flex-col items-center justify-center text-center">
              <CheckCircle size={22} weight="fill" className="text-emerald-500" />
              <p className="mt-1.5 text-[12px] text-muted-foreground">{t("dash.noOverdue")}</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {overdue.slice(0, 4).map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/w/${slug}/p/${projectId}/list?task=${task.id}`}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] transition hover:bg-surface-muted"
                  >
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <span className="shrink-0 text-[10px] font-medium text-red-600 dark:text-red-400">
                      {task.dueDate ? formatDate(task.dueDate, locale, ctx.user.timezone, ctx.user.dateFormat) : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Card className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ChartLineUp size={13} /> {t("dash.trend")}
          </p>
          <div className="relative flex h-[164px] items-end gap-2">
            {trendMax <= 1 && (
              <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] text-muted-foreground">
                {locale === "en" ? "No completed tasks in this period yet." : "Belum ada task selesai pada periode ini."}
              </p>
            )}
            {weeks.map((week, i) => {
              const barHeight = Math.max(4, Math.round((week.count / trendMax) * 108));
              return (
                <div key={i} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <div className="relative flex h-[120px] w-full items-end justify-center">
                    <span
                      className={cn(
                        "absolute text-[10px] font-semibold leading-none",
                        week.count > 0 ? "text-foreground" : "text-muted-foreground",
                      )}
                      style={{ bottom: `${barHeight + 4}px` }}
                    >
                      {week.count}
                    </span>
                    <div
                      className={cn(
                        "w-full max-w-[42px] rounded-t-md transition-colors",
                        week.count > 0
                          ? "bg-primary/80 group-hover:bg-primary"
                          : "bg-slate-300 dark:bg-slate-600",
                      )}
                      style={{ height: `${barHeight}px` }}
                      title={`${week.count} ${locale === "en" ? "tasks" : "task"}`}
                      role="img"
                      aria-label={`${week.count} tasks`}
                    />
                  </div>
                  <span className="text-[9.5px] text-muted-foreground">
                    {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", { day: "numeric", month: "short" }).format(week.start)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <UsersThree size={13} /> {t("dash.workload")}
          </p>
          <div className="space-y-2.5">
            {workload.slice(0, 5).map(({ member, active, completed }) => {
              const max = Math.max(1, ...workload.map((w) => w.active));
              return (
                <div key={member.id} className="flex items-center gap-2">
                  <Avatar name={member.name} src={member.avatarUrl} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="truncate font-medium">{member.name}</span>
                      <span className="text-muted-foreground">{active} {locale === "en" ? "active" : "aktif"}</span>
                    </div>
                    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(active / max) * 100}%` }} />
                      <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${(completed / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {unassigned > 0 && (
              <p className="pt-1 text-[11px] text-muted-foreground">
                {unassigned} {t("common.unassigned").toLowerCase()}
              </p>
            )}
            {workload.length === 0 && (
              <p className="py-3 text-center text-[11px] text-muted-foreground">{t("common.empty")}</p>
            )}
          </div>
        </Card>
      </div>

      {milestones.length > 0 && (
        <Card className="mt-3 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("projects.milestones")}</p>
          <div className="flex flex-wrap gap-2">
            {milestones.map((milestone) => {
              return (
                <div key={milestone.id} className="rounded-lg border border-border px-2.5 py-1.5">
                  <p className="text-[12px] font-medium">{milestone.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(milestone.date, locale, ctx.user.timezone, ctx.user.dateFormat)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
