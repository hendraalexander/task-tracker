"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarBlank, Diamond, Info, Lock } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { useT, useLocale } from "@/components/providers";
import type { ProjectMeta, TaskDTO } from "@/lib/task-types";

const DAY = 86_400_000;
const ROW = 40;
const BAR_H = 26;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDays = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
const iso = (d: Date) => d.toISOString();

function formatRange(start: Date, end: Date, locale: string) {
  const fmt = (date: Date) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
  return start.getTime() === end.getTime() ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export function TimelineView({
  meta,
  tasks,
  deps,
  canTimeline,
  milestones,
}: {
  meta: ProjectMeta;
  tasks: TaskDTO[];
  deps: { taskId: string; blockedByTaskId: string }[];
  canTimeline: boolean;
  milestones: ProjectMeta["milestones"];
}) {
  const t = useT();
  const { locale } = useLocale();
  const pathname = usePathname();
  const params = useSearchParams();
  const [zoom, setZoom] = useState<"week" | "month">("week");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scheduled = useMemo(
    () =>
      tasks
        .map((task) => {
          const s = task.startDate ? new Date(task.startDate) : task.dueDate ? new Date(task.dueDate) : null;
          const e = task.dueDate ? new Date(task.dueDate) : task.startDate ? new Date(task.startDate) : null;
          if (!s || !e) return null;
          return { task, start: startOfDay(s), end: startOfDay(new Date(Math.max(s.getTime(), e.getTime()))) };
        })
        .filter(Boolean) as { task: TaskDTO; start: Date; end: Date }[],
    [tasks],
  );

  const range = useMemo(() => {
    const today = startOfDay(new Date());
    let min = new Date(today);
    let max = new Date(today);
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 21);
    for (const item of scheduled) {
      if (item.start < min) min = item.start;
      if (item.end > max) max = item.end;
    }
    for (const m of milestones) {
      const d = startOfDay(new Date(m.date));
      if (d < min) min = d;
      if (d > max) max = d;
    }
    // Monday-start weeks.
    const start = new Date(min);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(max);
    end.setDate(end.getDate() + (7 - ((end.getDay() + 6) % 7)));
    const days = Math.max(42, diffDays(start, end));
    return { start, days };
  }, [scheduled, milestones]);

  const intlLocale = locale === "en" ? "en-US" : "id-ID";
  const dayWidth = zoom === "week" ? 28 : 11;
  const width = range.days * dayWidth;
  const todayOffset = diffDays(range.start, new Date());
  const rowIndex = new Map(scheduled.map((item, index) => [item.task.id, index]));

  useEffect(() => {
    if (!scrollRef.current) return;
    const offset = Math.max(0, (todayOffset - 7) * dayWidth);
    scrollRef.current.scrollLeft = offset;
  }, [todayOffset, dayWidth]);

  const hrefFor = (taskId: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("task", taskId);
    return `${pathname}?${next.toString()}`;
  };

  if (!canTimeline) {
    return (
      <div className="mx-auto w-full max-w-[800px] px-4 py-10">
        <Card>
          <EmptyState
            icon={<Lock size={22} />}
            title={t("view.timeline")}
            description={t("billing.lockedFeature")}
            action={
              <Link href={`/w/${meta.workspaceSlug}/settings/billing`} className="text-sm font-semibold text-primary hover:underline">
                {t("billing.upgrade")} →
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const unscheduled = tasks.filter((task) => !task.startDate && !task.dueDate);
  const monthHeaders: { label: string; width: number }[] = [];
  {
    let cursor = new Date(range.start);
    while (cursor < new Date(range.start.getTime() + range.days * DAY)) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const end = next < new Date(range.start.getTime() + range.days * DAY) ? next : new Date(range.start.getTime() + range.days * DAY);
      monthHeaders.push({
        label: new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", { month: "short", year: "numeric" }).format(cursor),
        width: Math.max(1, diffDays(cursor, end)) * dayWidth,
      });
      cursor = next;
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-semibold">{t("view.timeline")}</h2>
        <span className="text-[11px] text-muted-foreground">
          {scheduled.length} {t("projects.tasks")}
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
          {(["week", "month"] as const).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium transition",
                zoom === z ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {z === "week" ? t("view.week") : t("view.month")}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex">
          <div className="w-[220px] shrink-0 border-r border-border">
            <div className="flex h-9 items-center border-b border-border bg-surface-muted/40 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("task.title")}
            </div>
            <div className="flex h-8 items-center border-b border-border bg-surface-muted/20 px-2.5 text-[10px] font-medium text-muted-foreground">
              {t("projects.milestones")}
            </div>
            {scheduled.map(({ task, start, end }) => (
              <div key={task.id} className="flex h-[40px] flex-col justify-center border-b border-border/60 px-2.5">
                <Link href={hrefFor(task.id)} className="truncate text-[11.5px] font-medium leading-tight hover:underline">
                  {task.title}
                </Link>
                <span className="mt-0.5 truncate text-[9.5px] text-muted-foreground">
                  {formatRange(start, end, intlLocale)}
                </span>
              </div>
            ))}
          </div>

          <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-x-auto">
            <div style={{ width }} className="relative">
              <div className="flex h-9 border-b border-border bg-surface-muted/40 text-[10px] font-medium text-muted-foreground">
                {monthHeaders.map((header, i) => (
                  <div key={i} style={{ width: header.width }} className="relative flex shrink-0 items-center border-r border-border/60 capitalize">
                    <span className="sticky left-0 z-10 bg-surface-muted/95 px-2 py-0.5 backdrop-blur-sm">{header.label}</span>
                  </div>
                ))}
              </div>

              <div className="relative h-8 border-b border-border bg-surface-muted/20">
                {milestones.map((m) => {
                  const offset = diffDays(range.start, new Date(m.date));
                  if (offset < 0 || offset > range.days) return null;
                  return (
                    <div
                      key={m.id}
                      className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1"
                      style={{ left: offset * dayWidth }}
                      title={`${m.name} · ${new Date(m.date).toLocaleDateString(intlLocale)}`}
                    >
                      <Diamond size={10} weight="fill" className="text-violet-500" />
                      <span className="whitespace-nowrap text-[9px] font-medium text-violet-600 dark:text-violet-400">{m.name}</span>
                    </div>
                  );
                })}
              </div>

              {/* row backgrounds + bars */}
              <div className="relative" style={{ height: scheduled.length * ROW }}>
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: `repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px ${zoom === "week" ? dayWidth * 7 : dayWidth * 7}px)`,
                    opacity: 0.6,
                  }}
                />
                {scheduled.length === 0 && (
                  <div className="flex h-[120px] items-center justify-center px-4 text-center text-[12px] text-muted-foreground">
                    {t("empty.timeline")}
                  </div>
                )}
                {scheduled.map(({ task, start, end }, index) => {
                  const left = diffDays(range.start, start) * dayWidth;
                  const span = Math.max(1, diffDays(start, end) + 1) * dayWidth;
                  const color = task.status === "DONE" ? "#059669" : task.status === "IN_PROGRESS" ? "#2563EB" : task.status === "IN_REVIEW" ? "#F59E0B" : "#94A3B8";
                  return (
                    <Link
                      key={task.id}
                      href={hrefFor(task.id)}
                      className="absolute flex items-center gap-1 overflow-hidden rounded-md border px-1.5 text-[10.5px] font-medium shadow-xs transition hover:brightness-95"
                      style={{
                        top: index * ROW + (ROW - BAR_H) / 2,
                        left,
                        width: span,
                        height: BAR_H,
                        borderColor: `${color}55`,
                        background: `${color}1F`,
                        color,
                      }}
                      title={`${task.title} · ${start.toLocaleDateString(intlLocale)} – ${end.toLocaleDateString(intlLocale)}`}
                    >
                      <span className="truncate">{task.title}</span>
                    </Link>
                  );
                })}

                {/* dependency lines */}
                <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={scheduled.length * ROW} aria-hidden>
                  {deps.map((dep) => {
                    const toIndex = rowIndex.get(dep.taskId);
                    const fromIndex = rowIndex.get(dep.blockedByTaskId);
                    if (toIndex === undefined || fromIndex === undefined) return null;
                    const from = scheduled[fromIndex];
                    const to = scheduled[toIndex];
                    const x1 = (diffDays(range.start, from.end) + 1) * dayWidth;
                    const y1 = fromIndex * ROW + ROW / 2;
                    const x2 = diffDays(range.start, to.start) * dayWidth;
                    const y2 = toIndex * ROW + ROW / 2;
                    return (
                      <polyline
                        key={`${dep.taskId}-${dep.blockedByTaskId}`}
                        points={`${x1},${y1} ${x1 + 6},${y1} ${x1 + 6},${y2} ${x2},${y2}`}
                        fill="none"
                        stroke="var(--border-strong)"
                        strokeWidth="1"
                        strokeDasharray="3 2"
                      />
                    );
                  })}
                </svg>

                {todayOffset >= 0 && todayOffset <= range.days && (
                  <div className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-blue-500/60" style={{ left: todayOffset * dayWidth }}>
                    <span className="absolute -top-0.5 left-1 rounded bg-blue-500 px-1 py-px text-[8px] font-semibold text-white">
                      {t("common.today")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {unscheduled.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Info size={12} /> {t("view.unscheduled")} ({unscheduled.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((task) => (
              <Link key={task.id} href={hrefFor(task.id)} className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] transition hover:bg-surface-muted">
                {task.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {deps.length > 0 && (
        <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
          <CalendarBlank size={11} /> {deps.length} {t("task.dependencies").toLowerCase()}
        </p>
      )}
    </div>
  );
}
