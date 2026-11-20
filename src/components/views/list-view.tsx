"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, CaretDown, ListChecks, ChatCircle, Plus } from "@phosphor-icons/react";
import { cn, PRIORITY_ORDER, STATUS_ORDER } from "@/lib/utils";
import { Button, EmptyState } from "@/components/ui/primitives";
import { AssigneePicker } from "@/components/task/assignee-picker";
import { useT, useToast } from "@/components/providers";
import { createTask, updateTask } from "@/actions/task";
import type { ProjectMeta, TaskDTO, ViewFilters } from "@/lib/task-types";

export function ListView({ meta, tasks, filters }: { meta: ProjectMeta; tasks: TaskDTO[]; filters: ViewFilters }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [quick, setQuick] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const hrefFor = (taskId: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("task", taskId);
    return `${pathname}?${next.toString()}`;
  };

  const update = (taskId: string, patch: Parameters<typeof updateTask>[1], success?: string) => {
    startTransition(async () => {
      const res = await updateTask(taskId, patch);
      if (!res.ok) toast(res.error ?? t("common.error"), "error");
      else if (success) toast(success);
      router.refresh();
    });
  };

  const groups = groupTasks(tasks, filters, meta, t);

  const columns = [
    { key: "title", label: t("task.title"), className: "flex-1 min-w-0" },
    { key: "assignee", label: t("task.assignee"), className: "w-[132px] hidden md:block" },
    { key: "status", label: t("task.status"), className: "w-[118px] hidden sm:block" },
    { key: "priority", label: t("task.priority"), className: "w-[104px] hidden lg:block" },
    { key: "due", label: t("task.dueDate"), className: "w-[116px]" },
    ...meta.fields.slice(0, 2).map((field) => ({ key: field.id, label: field.name, className: "w-[120px] hidden xl:block" })),
  ];

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 border-b border-border px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {columns.map((col) => (
          <span key={col.key} className={cn("truncate px-1.5", col.className)}>
            {col.label}
          </span>
        ))}
      </div>

      {groups.map((group) => (
        <section key={group.key} className="border-b border-border last:border-0">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
            className="flex w-full cursor-pointer items-center gap-1.5 border-b border-border/70 bg-surface-muted/50 px-2 py-1.5 text-left"
          >
            <CaretDown size={11} className={cn("text-muted-foreground transition", collapsed[group.key] && "-rotate-90")} />
            {group.dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: group.dot }} />}
            <span className="text-[11.5px] font-semibold">{group.label}</span>
            <span className="rounded bg-surface px-1.5 text-[10px] font-medium text-muted-foreground">{group.tasks.length}</span>
          </button>

          {!collapsed[group.key] && (
            <>
              {group.tasks.map((task) => {
                const overdue = task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date();
                return (
                  <div
                    key={task.id}
                    className="group flex items-center gap-0 border-b border-border/50 px-1 py-1 transition last:border-0 hover:bg-surface-muted/40"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", task.status === "DONE" ? "bg-emerald-500" : task.priority === "URGENT" ? "bg-red-500" : "bg-slate-300 dark:bg-slate-600")} />
                      <Link href={hrefFor(task.id)} className="min-w-0 flex-1 py-1 text-[13px] font-medium leading-snug hover:underline">
                        <span className={cn("block truncate", task.status === "DONE" && "text-muted-foreground line-through")}>{task.title}</span>
                        <span className="mt-0.5 flex items-center gap-2">
                          {task.tags.slice(0, 2).map((tag) => (
                            <span key={tag.id} className="rounded px-1 py-px text-[9.5px] font-medium" style={{ background: `${tag.color}18`, color: tag.color }}>
                              {tag.name}
                            </span>
                          ))}
                          {task.subtaskTotal > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[9.5px] text-muted-foreground">
                              <ListChecks size={10} /> {task.subtaskDone}/{task.subtaskTotal}
                            </span>
                          )}
                          {task.commentCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[9.5px] text-muted-foreground">
                              <ChatCircle size={10} /> {task.commentCount}
                            </span>
                          )}
                        </span>
                      </Link>
                    </div>

                    <div className="hidden w-[132px] shrink-0 px-1 md:block">
                      <AssigneePicker
                        members={meta.members}
                        value={task.assignees.map((a) => a.id)}
                        onChange={(ids) => update(task.id, { assigneeIds: ids })}
                        disabled={!meta.canEdit || pending}
                        compact
                        size={18}
                        ariaLabel={t("task.assignee")}
                      />
                    </div>

                    <div className="hidden w-[118px] shrink-0 px-1 sm:block">
                      <select
                        value={task.status}
                        disabled={!meta.canEdit || pending}
                        onChange={(e) => update(task.id, { status: e.target.value })}
                        aria-label={t("task.status")}
                        className="h-6 w-full cursor-pointer appearance-none rounded-md border border-transparent bg-transparent px-1 text-[11px] font-medium text-muted-foreground transition hover:border-border focus:border-primary focus:outline-none"
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {t(`status.${s}` as never)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hidden w-[104px] shrink-0 px-1 lg:block">
                      <select
                        value={task.priority}
                        disabled={!meta.canEdit || pending}
                        onChange={(e) => update(task.id, { priority: e.target.value })}
                        aria-label={t("task.priority")}
                        className="h-6 w-full cursor-pointer appearance-none rounded-md border border-transparent bg-transparent px-1 text-[11px] text-muted-foreground transition hover:border-border focus:border-primary focus:outline-none"
                      >
                        {PRIORITY_ORDER.map((p) => (
                          <option key={p} value={p}>
                            {t(`priority.${p}` as never)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-[116px] shrink-0 px-1">
                      <input
                        type="date"
                        value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                        disabled={!meta.canEdit || pending}
                        onChange={(e) => update(task.id, { dueDate: e.target.value || null })}
                        aria-label={t("task.dueDate")}
                        className={cn(
                          "h-6 w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1 text-[11px] transition hover:border-border focus:border-primary focus:outline-none",
                          overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground",
                        )}
                      />
                    </div>

                    {meta.fields.slice(0, 2).map((field) => (
                      <div key={field.id} className="hidden w-[120px] shrink-0 truncate px-1.5 text-[11px] text-muted-foreground xl:block">
                        {displayValue(task.values[field.id], field.type)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </section>
      ))}

      {tasks.length === 0 && (
        <EmptyState
          icon={<ListChecks size={22} />}
          title={t("view.noTasks")}
          description={t("task.emptyBody")}
        />
      )}

      {meta.canEdit && (
        <form
          className="flex items-center gap-2 px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = quick.trim();
            if (!value) return;
            setQuick("");
            startTransition(async () => {
              const res = await createTask(meta.id, { title: value, status: filters.status.length === 1 ? filters.status[0] : "TODO" });
              if (!res.ok) toast(res.error ?? t("common.error"), "error");
              else router.refresh();
            });
          }}
        >
          <Plus size={14} className="text-muted-foreground" />
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder={t("task.quickAdd")}
            className="h-7 flex-1 rounded-md border border-transparent bg-transparent px-1 text-[12.5px] outline-none transition placeholder:text-muted-foreground hover:border-border focus:border-primary focus:bg-surface"
          />
          {quick.trim() && (
            <Button type="submit" size="xs" variant="secondary" loading={pending}>
              {t("common.add")}
            </Button>
          )}
        </form>
      )}
    </div>
  );
}

function displayValue(value: string | null | undefined, type: string) {
  if (!value) return "—";
  if (type === "CHECKBOX") return value === "true" ? "✓" : "—";
  if (type === "DATE") return new Date(value).toLocaleDateString();
  if (type === "MULTI_SELECT") {
    try {
      return (JSON.parse(value) as string[]).join(", ");
    } catch {
      return value;
    }
  }
  return value;
}

function groupTasks(
  tasks: TaskDTO[],
  filters: ViewFilters,
  meta: ProjectMeta,
  t: ReturnType<typeof useT>,
) {
  const groups: { key: string; label: string; dot?: string; tasks: TaskDTO[] }[] = [];

  if (filters.group === "status") {
    for (const status of STATUS_ORDER) {
      groups.push({
        key: status,
        label: t(`status.${status}` as never),
        dot: status === "DONE" ? "#059669" : status === "IN_PROGRESS" ? "#2563EB" : status === "IN_REVIEW" ? "#F59E0B" : "#94A3B8",
        tasks: tasks.filter((task) => task.status === status),
      });
    }
  } else if (filters.group === "assignee") {
    for (const member of meta.members) {
      groups.push({
        key: member.id,
        label: member.name,
        tasks: tasks.filter((task) => task.assignees.some((a) => a.id === member.id)),
      });
    }
    groups.push({ key: "unassigned", label: t("common.unassigned"), tasks: tasks.filter((task) => task.assignees.length === 0) });
  } else if (filters.group === "priority") {
    for (const priority of [...PRIORITY_ORDER].reverse()) {
      groups.push({
        key: priority,
        label: t(`priority.${priority}` as never),
        dot: priority === "URGENT" ? "#DC2626" : priority === "HIGH" ? "#F59E0B" : priority === "MEDIUM" ? "#2563EB" : "#94A3B8",
        tasks: tasks.filter((task) => task.priority === priority),
      });
    }
  } else {
    groups.push({ key: "all", label: t("common.all"), tasks });
  }

  return groups.filter((group) => group.tasks.length > 0 || filters.group === "status");
}
