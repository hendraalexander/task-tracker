"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Flag, CalendarBlank, ChatCircle, ArrowElbowDownRight } from "@phosphor-icons/react";
import { cn, PRIORITY_STYLES, STATUS_STYLES } from "@/lib/utils";
import { useT, useLocale } from "@/components/providers";
import { Avatar } from "@/components/ui/primitives";
import { updateTask } from "@/actions/task";
import type { TaskStatus, TaskPriority } from "@prisma/client";

export type TaskRowData = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  projectColor: string;
  workspaceSlug: string;
  parent?: { id: string; title: string } | null;
  assignees: { id: string; name: string; avatarUrl: string | null }[];
  commentCount?: number;
  subtaskTotal?: number;
  subtaskDone?: number;
  overdue?: boolean;
  tags?: { id: string; name: string; color: string }[];
};

export function TaskRow({
  task,
  showProject = true,
  compact = false,
}: {
  task: TaskRowData;
  showProject?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const done = task.status === "DONE";
  const href = `/w/${task.workspaceSlug}/p/${task.projectId}/list?task=${task.id}`;

  const toggle = () => {
    startTransition(async () => {
      await updateTask(task.id, { status: done ? "TODO" : "DONE", confirmDone: true });
      router.refresh();
    });
  };

  return (
    <div className="group flex items-center gap-2.5 border-b border-border/70 px-3 py-2.5 transition last:border-0 hover:bg-surface-muted/50">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={done ? t("task.reopen") : t("task.markDone")}
        aria-pressed={done}
        className={cn(
          "grid h-[18px] w-[18px] shrink-0 cursor-pointer place-items-center rounded-full border-2 transition",
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-border-strong text-transparent hover:border-emerald-500 hover:text-emerald-500",
        )}
      >
        <Check size={11} weight="bold" />
      </button>

      <Link href={href} className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[13.5px] font-medium leading-snug",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>
        {task.parent ? (
          <span className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
            <ArrowElbowDownRight size={11} className="shrink-0" />
            <span className="truncate">{task.parent.title}</span>
          </span>
        ) : null}
        {!compact && task.tags?.length ? (
          <span className="mt-1 flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="rounded px-1.5 py-px text-[10px] font-medium"
                style={{ background: `${tag.color}18`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </span>
        ) : null}
      </Link>

      {showProject && (
        <Link
          href={`/w/${task.workspaceSlug}/p/${task.projectId}/list`}
          className="hidden max-w-[160px] items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-surface-muted sm:flex"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: task.projectColor }} />
          <span className="truncate">{task.projectName}</span>
        </Link>
      )}

      {task.commentCount ? (
        <span className="hidden items-center gap-0.5 text-[11px] text-muted-foreground sm:flex">
          <ChatCircle size={12} /> {task.commentCount}
        </span>
      ) : null}

      {(task.subtaskTotal ?? 0) > 0 && (
        <span className="hidden rounded border border-border px-1 text-[10px] text-muted-foreground sm:block">
          {task.subtaskDone}/{task.subtaskTotal}
        </span>
      )}

      <span className={cn("hidden text-[11px] sm:inline-flex", PRIORITY_STYLES[task.priority].chip)} title={t(`priority.${task.priority}` as never)}>
        <Flag size={12} weight="fill" />
      </span>

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

      {task.dueDate ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            task.overdue
              ? "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400"
              : "text-muted-foreground",
          )}
          title={t("task.dueDate")}
        >
          <CalendarBlank size={12} />
          {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", { day: "numeric", month: "short" }).format(new Date(task.dueDate))}
        </span>
      ) : null}

      <span className={cn("hidden rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset md:inline-flex", STATUS_STYLES[task.status].chip)}>
        {t(`status.${task.status}` as never)}
      </span>
    </div>
  );
}
