"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarBlank, ChatCircle, DotsThree, ListChecks, Plus } from "@phosphor-icons/react";
import { cn, STATUS_ORDER } from "@/lib/utils";
import { Avatar, Button } from "@/components/ui/primitives";
import { useT, useToast, useLocale } from "@/components/providers";
import { updateTask } from "@/actions/task";
import { NewTaskModal } from "@/components/task/new-task-modal";
import type { ProjectMeta, TaskDTO, ViewFilters } from "@/lib/task-types";

export function BoardView({ meta, tasks, filters }: { meta: ProjectMeta; tasks: TaskDTO[]; filters: ViewFilters }) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [addCol, setAddCol] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const hrefFor = (taskId: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("task", taskId);
    return `${pathname}?${next.toString()}`;
  };

  const move = (taskId: string, status: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;
    startTransition(async () => {
      const res = await updateTask(taskId, { status });
      if (!res.ok) toast(res.error ?? t("common.error"), "error");
      router.refresh();
    });
  };

  return (
    <div className="min-w-0">
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-5 pt-1 sm:px-6">
        {STATUS_ORDER.map((status) => {
          const items = tasks.filter((task) => task.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => {
                if (!meta.canEdit) return;
                e.preventDefault();
                setOverCol(status);
              }}
              onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                if (dragId) move(dragId, status);
                setDragId(null);
              }}
              className={cn(
                "flex w-[286px] shrink-0 flex-col rounded-xl border bg-surface-muted/30 transition",
                overCol === status ? "border-primary/50 bg-primary-soft/30" : "border-border",
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background:
                      status === "DONE" ? "#059669" : status === "IN_PROGRESS" ? "#2563EB" : status === "IN_REVIEW" ? "#F59E0B" : "#94A3B8",
                  }}
                />
                <h2 className="text-[12.5px] font-semibold">{t(`status.${status}` as never)}</h2>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{items.length}</span>
                {meta.canEdit && (
                  <button
                    type="button"
                    onClick={() => setAddCol(status)}
                    aria-label={t("view.addTask")}
                    className="ml-auto grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              <div className="flex min-h-[160px] flex-1 flex-col gap-1.5 px-2 pb-2">
                {items.map((task) => {
                  const overdue = task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date();
                  return (
                    <article
                      key={task.id}
                      draggable={meta.canEdit}
                      onDragStart={() => setDragId(task.id)}
                      onDragEnd={() => setDragId(null)}
                      className={cn(
                        "group rounded-lg border border-border bg-surface p-2.5 shadow-xs transition",
                        meta.canEdit && "cursor-grab active:cursor-grabbing",
                        dragId === task.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <Link href={hrefFor(task.id)} className="min-w-0 flex-1">
                          <p className={cn("text-[12.5px] font-medium leading-snug", task.status === "DONE" && "text-muted-foreground line-through")}>
                            {task.title}
                          </p>
                        </Link>
                        <DotsThree size={15} className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      </div>

                      {task.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {task.tags.slice(0, 3).map((tag) => (
                            <span key={tag.id} className="rounded px-1 py-px text-[9.5px] font-medium" style={{ background: `${tag.color}18`, color: tag.color }}>
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2">
                        <span className={cn("text-[10px] font-medium", task.priority === "URGENT" ? "text-red-600 dark:text-red-400" : task.priority === "HIGH" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                          {t(`priority.${task.priority}` as never)}
                        </span>

                        {task.subtaskTotal > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <ListChecks size={10} /> {task.subtaskDone}/{task.subtaskTotal}
                          </span>
                        )}
                        {task.commentCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <ChatCircle size={10} /> {task.commentCount}
                          </span>
                        )}

                        {task.dueDate && (
                          <span
                            className={cn(
                              "ml-auto inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px]",
                              overdue ? "bg-red-50 font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400" : "text-muted-foreground",
                            )}
                          >
                            <CalendarBlank size={10} />
                            {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", { day: "numeric", month: "short" }).format(new Date(task.dueDate))}
                          </span>
                        )}
                        {task.assignees.length > 0 && (
                          <span className="flex items-center -space-x-1.5">
                            {task.assignees.slice(0, 3).map((member) => (
                              <Avatar key={member.id} name={member.name} src={member.avatarUrl} size={20} ring />
                            ))}
                            {task.assignees.length > 3 && (
                              <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-muted text-[8px] font-semibold ring-2 ring-surface">
                                +{task.assignees.length - 3}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}

                {items.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 px-2 py-6 text-center text-[11px] text-muted-foreground">
                    {t("common.empty")}
                  </div>
                )}

                {meta.canEdit && (
                  <button
                    type="button"
                    onClick={() => setAddCol(status)}
                    className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:bg-surface hover:text-foreground"
                  >
                    <Plus size={11} /> {t("view.addTask")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {meta.canEdit && (
        <NewTaskModal
          meta={meta}
          open={addCol !== null}
          onClose={() => setAddCol(null)}
          defaultStatus={addCol ?? "TODO"}
        />
      )}
    </div>
  );
}
