"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CaretLeft, CaretRight, Plus, CalendarBlank } from "@phosphor-icons/react";
import { cn, STATUS_STYLES } from "@/lib/utils";
import { Button, Card } from "@/components/ui/primitives";
import { useT, useLocale } from "@/components/providers";
import { NewTaskModal } from "@/components/task/new-task-modal";
import type { ProjectMeta, TaskDTO, ViewFilters } from "@/lib/task-types";

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function CalendarView({
  meta,
  tasks,
  filters,
  initialMonth,
}: {
  meta: ProjectMeta;
  tasks: TaskDTO[];
  filters: ViewFilters;
  initialMonth: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [month, setMonth] = useState(() => {
    const [y, m] = initialMonth.split("-").map(Number);
    return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
  });
  const [newDate, setNewDate] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskDTO[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = keyOf(new Date(task.dueDate));
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const unscheduled = tasks.filter((task) => !task.dueDate);
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const startWeekday = (start.getDay() + 6) % 7; // Monday-first
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - startWeekday);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayKey = keyOf(new Date());
  const intlLocale = locale === "en" ? "en-US" : "id-ID";
  const monthLabel = new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(month);
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i); // Monday, Jan 1 2024
    return new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(d);
  });

  const hrefFor = (taskId: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("task", taskId);
    return `${pathname}?${next.toString()}`;
  };

  const shift = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    const qp = new URLSearchParams(params.toString());
    qp.set("month", `${next.getFullYear()}-${pad(next.getMonth() + 1)}`);
    router.replace(`${pathname}?${qp.toString()}`, { scroll: false });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
            <CaretLeft size={15} />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => shift(1)} aria-label="Next month">
            <CaretRight size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              const qp = new URLSearchParams(params.toString());
              qp.delete("month");
              router.replace(`${pathname}?${qp.toString()}`, { scroll: false });
            }}
          >
            {t("view.today")}
          </Button>
        </div>
        <h2 className="text-[15px] font-semibold capitalize">{monthLabel}</h2>
        <span className="text-[11px] text-muted-foreground">
          {tasks.length} {t("projects.tasks")}
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted/40">
          {weekdays.map((day) => (
            <div key={day} className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = keyOf(day);
            const items = byDay.get(key) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={cn(
                  "group relative min-h-[96px] border-b border-r border-border/70 p-1.5 last:border-r-0",
                  !inMonth && "bg-surface-muted/30",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full text-[11px]",
                      isToday ? "bg-primary font-bold text-white" : inMonth ? "text-foreground" : "text-muted-foreground/60",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {meta.canEdit && (
                    <button
                      type="button"
                      onClick={() => setNewDate(key)}
                      aria-label={t("view.addTask")}
                      className="grid h-4 w-4 cursor-pointer place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-surface-muted group-hover:opacity-100"
                    >
                      <Plus size={11} />
                    </button>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((task) => (
                    <Link
                      key={task.id}
                      href={hrefFor(task.id)}
                      className={cn(
                        "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium transition hover:brightness-95",
                        STATUS_STYLES[task.status].chip,
                      )}
                    >
                      <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: STATUS_STYLES[task.status].bar }} />
                      <span className="truncate">{task.title}</span>
                    </Link>
                  ))}
                  {items.length > 3 && <p className="pl-1 text-[9.5px] text-muted-foreground">+{items.length - 3}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {unscheduled.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
            <CalendarBlank size={13} /> {t("view.unscheduled")} ({unscheduled.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.slice(0, 12).map((task) => (
              <Link key={task.id} href={hrefFor(task.id)} className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] transition hover:bg-surface-muted">
                {task.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {meta.canEdit && (
        <NewTaskModal meta={meta} open={newDate !== null} onClose={() => setNewDate(null)} defaultDueDate={newDate ?? undefined} />
      )}
    </div>
  );
}
