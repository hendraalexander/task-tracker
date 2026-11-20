"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  X,
  Check,
  CaretDown,
  Trash,
  Plus,
  Paperclip,
  FilePdf,
  File as FileIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  ChatCircleText,
  ClockCounterClockwise,
  GitBranch,
  ArrowSquareOut,
  Warning,
  PencilSimple,
} from "@phosphor-icons/react";
import { cn, PRIORITY_ORDER, STATUS_ORDER } from "@/lib/utils";
import { Button, Input, Select, Textarea, Avatar, Label, Field, Spinner } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { useT, useToast } from "@/components/providers";
import { relativeTime } from "@/lib/format";
import type { TaskDetail, TaskNode } from "@/lib/task-types";
import { AssigneePicker } from "@/components/task/assignee-picker";
import {
  addComment,
  addDependency,
  deleteAttachment,
  deleteComment,
  deleteTask,
  editComment,
  removeDependency,
  setCustomFieldValue,
  setTaskTags,
  updateTask,
  uploadAttachment,
  createTask,
} from "@/actions/task";
import { getTaskDetail } from "@/actions/task-detail";
import type { ActionResult } from "@/actions/project";

export function TaskDrawerHost() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const taskId = searchParams.get("task");

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return taskId ? <TaskDrawer taskId={taskId} onClose={close} /> : null;
}

function TaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const [confirmBlocked, setConfirmBlocked] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const data = await getTaskDetail(taskId);
    setDetail(data);
    setLoading(false);
    return data;
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Let an open assignee popover consume the first Escape.
      if (document.querySelector('[data-assignee-popover="true"]')) return;
      if (!confirmBlocked && !confirmDelete) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, confirmBlocked, confirmDelete]);

  const refresh = useCallback(async () => {
    await load();
    router.refresh();
  }, [load, router]);

  const run = useCallback(
    (fn: () => Promise<ActionResult>, success?: string) => {
      startTransition(async () => {
        const res = await fn();
        if (!res.ok) {
          if (res.needsConfirm) {
            setConfirmBlocked(true);
            return;
          }
          toast(res.error ?? t("common.error"), "error");
          return;
        }
        if (success) toast(success);
        await refresh();
      });
    },
    [refresh, t, toast],
  );

  const buildTaskHref = (id: string) => {
    if (typeof window === "undefined") return `?task=${id}`;
    const next = new URLSearchParams(window.location.search);
    next.set("task", id);
    return `${window.location.pathname}?${next.toString()}`;
  };

  const task = detail?.task;
  const meta = detail?.meta;
  const canEdit = !!meta?.canEdit;
  const guestCanStatus =
    !!meta?.isGuest &&
    !!task?.assignees.some((a) => a.id === meta?.currentUserId) &&
    !meta?.readOnly;

  return (
    <div className="fixed inset-0 z-[65] flex justify-end">
      <div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("task.details")}
        className="animate-drawer relative flex h-full w-full max-w-[600px] flex-col border-l border-border bg-surface shadow-2xl"
      >
        {loading || !task || !meta || !detail ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="h-6 w-6 text-primary" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <Link
                href={`/w/${meta.workspaceSlug}/p/${meta.id}/list`}
                className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-surface-muted"
                onClick={onClose}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                <span className="truncate">{meta.name}</span>
                <ArrowSquareOut size={11} />
              </Link>
              <div className="ml-auto flex items-center gap-1">
                {(canEdit || guestCanStatus) && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      run(
                        () =>
                          updateTask(task.id, {
                            status: task.status === "DONE" ? "TODO" : "DONE",
                            confirmDone: task.status === "DONE" ? false : false,
                          }),
                        t("toast.taskUpdated"),
                      )
                    }
                  >
                    <Check size={14} />
                    {task.status === "DONE" ? t("task.reopen") : t("task.markDone")}
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common.close")}>
                  <X size={18} />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="px-5 pb-5 pt-4">
                <div className="flex items-start gap-2">
                  <div className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", task.status === "DONE" ? "bg-emerald-500" : task.status === "IN_PROGRESS" ? "bg-blue-500" : "bg-slate-400")} />
                  <input
                    ref={titleRef}
                    defaultValue={task.title}
                    key={task.title}
                    readOnly={!canEdit}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (canEdit && value && value !== task.title) run(() => updateTask(task.id, { title: value }));
                    }}
                    className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-[19px] font-semibold leading-snug tracking-[-0.01em] transition hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
                    aria-label={t("task.title")}
                  />
                </div>

                {detail.parent && (
                  <Link
                    href={buildTaskHref(detail.parent.id)}
                    className="ml-4 mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    ↳ {t("task.subtasks")}: {detail.parent.title}
                  </Link>
                )}

                <div className="mt-4 grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
                  <Property label={t("task.status")}>
                    <Select
                      value={task.status}
                      disabled={!canEdit && !guestCanStatus}
                      onChange={(e) => run(() => updateTask(task.id, { status: e.target.value }))}
                      className="h-8 text-[13px]"
                      aria-label={t("task.status")}
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {t(`status.${s}` as never)}
                        </option>
                      ))}
                    </Select>
                  </Property>
                  <Property label={t("task.assignee")}>
                    <AssigneePicker
                      members={meta.members}
                      value={task.assignees.map((a) => a.id)}
                      onChange={(ids) => run(() => updateTask(task.id, { assigneeIds: ids }))}
                      disabled={!canEdit}
                      size={20}
                      ariaLabel={t("task.assignee")}
                    />
                  </Property>
                  <Property label={t("task.priority")}>
                    <Select
                      value={task.priority}
                      disabled={!canEdit}
                      onChange={(e) => run(() => updateTask(task.id, { priority: e.target.value }))}
                      className="h-8 text-[13px]"
                      aria-label={t("task.priority")}
                    >
                      {PRIORITY_ORDER.map((p) => (
                        <option key={p} value={p}>
                          {t(`priority.${p}` as never)}
                        </option>
                      ))}
                    </Select>
                  </Property>
                  <Property label={t("task.dueDate")}>
                    <Input
                      type="date"
                      defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                      disabled={!canEdit}
                      onChange={(e) => run(() => updateTask(task.id, { dueDate: e.target.value || null }))}
                      className="h-8 text-[13px]"
                      aria-label={t("task.dueDate")}
                    />
                  </Property>
                  <Property label={t("task.startDate")}>
                    <Input
                      type="date"
                      defaultValue={task.startDate ? task.startDate.slice(0, 10) : ""}
                      disabled={!canEdit}
                      onChange={(e) => run(() => updateTask(task.id, { startDate: e.target.value || null }))}
                      className="h-8 text-[13px]"
                      aria-label={t("task.startDate")}
                    />
                  </Property>
                  <Property label={t("task.milestone")}>
                    <Select
                      value={task.milestoneId ?? ""}
                      disabled={!canEdit}
                      onChange={(e) => run(() => updateTask(task.id, { milestoneId: e.target.value || null }))}
                      className="h-8 text-[13px]"
                      aria-label={t("task.milestone")}
                    >
                      <option value="">{t("common.none")}</option>
                      {meta.milestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </Property>
                </div>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {task.tags.map((tag) => (
                    <span key={tag.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${tag.color}18`, color: tag.color }}>
                      {tag.name}
                    </span>
                  ))}
                  {canEdit && (
                    <details className="relative">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-border-strong">
                        <Plus size={10} /> {t("task.tags")}
                      </summary>
                      <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-52 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-xl">
                        {meta.tags.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">{t("common.empty")}</p>}
                        {meta.tags.map((tag) => {
                          const selected = task.tags.some((x) => x.id === tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                const ids = selected ? task.tags.filter((x) => x.id !== tag.id).map((x) => x.id) : [...task.tags.map((x) => x.id), tag.id];
                                run(() => setTaskTags(task.id, ids));
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-muted"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ background: tag.color }} />
                              <span className="flex-1">{tag.name}</span>
                              {selected && <Check size={12} />}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>

                {/* Description */}
                <div className="mt-5">
                  <SectionHeader icon={<ChatCircleText size={14} />} title={t("task.description")} />
                  <DescriptionEditor
                    value={task.description ?? ""}
                    readOnly={!canEdit}
                    onSave={(value) => run(() => updateTask(task.id, { description: value }))}
                    placeholder={t("task.description")}
                  />
                </div>

                {/* Custom fields */}
                {meta.fields.length > 0 && (
                  <div className="mt-5">
                    <SectionHeader icon={<PencilSimple size={14} />} title={t("projects.customFields")} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {meta.fields.map((field) => (
                        <div key={field.id}>
                          <Label className="mb-1 flex items-center gap-1 text-[10px] uppercase">
                            {field.name}
                            {field.required && <span className="text-destructive">*</span>}
                          </Label>
                          <CustomFieldInput
                            field={field}
                            value={task.values[field.id] ?? ""}
                            readOnly={!canEdit}
                            members={meta.members}
                            onSave={(value) => run(() => setCustomFieldValue(task.id, field.id, value || null))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subtasks — unlimited nesting */}
                <div className="mt-5">
                  <SectionHeader
                    icon={<GitBranch size={14} />}
                    title={`${t("task.subtasks")}${allNodes(detail.subtasks).length ? ` · ${allNodes(detail.subtasks).filter((s) => s.status === "DONE").length}/${allNodes(detail.subtasks).length}` : ""}`}
                  />
                  <div className="overflow-hidden rounded-lg border border-border">
                    <SubtaskTree
                      nodes={detail.subtasks}
                      meta={meta}
                      canEdit={canEdit}
                      parentId={task.id}
                      depth={0}
                      run={run}
                    />
                    {canEdit && (
                      <QuickSubtaskForm
                        projectId={meta.id}
                        parentTaskId={task.id}
                        onCreated={() => refresh()}
                        run={run}
                      />
                    )}
                  </div>
                </div>

                {/* Dependencies */}
                <div className="mt-5">
                  <SectionHeader icon={<LinkIcon size={14} />} title={t("task.dependencies")} />
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="w-20 shrink-0 text-[11px] text-muted-foreground">{t("task.blockedBy")}</span>
                      {detail.blockedBy.length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
                      {detail.blockedBy.map((dep) => (
                        <span
                          key={dep.id}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]",
                            dep.status === "DONE" ? "border-border text-muted-foreground line-through" : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
                          )}
                        >
                          {dep.title}
                          {canEdit && (
                            <button type="button" onClick={() => run(() => removeDependency(task.id, dep.id))} aria-label={t("common.delete")} className="cursor-pointer opacity-60 hover:opacity-100">
                              <X size={10} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="w-20 shrink-0 text-[11px] text-muted-foreground">{t("task.blocks")}</span>
                      {detail.blocking.length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
                      {detail.blocking.map((dep) => (
                        <span key={dep.id} className="inline-flex rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {dep.title}
                        </span>
                      ))}
                    </div>
                    {canEdit && (
                      <form
                        className="flex items-center gap-1.5 pt-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const select = e.currentTarget.elements.namedItem("dep") as HTMLSelectElement;
                          if (!select.value) return;
                          run(() => addDependency(task.id, select.value));
                          select.value = "";
                        }}
                      >
                        <Select name="dep" defaultValue="" className="h-7 max-w-[260px] text-[11px]" aria-label={t("task.addDependency")}>
                          <option value="">{t("task.addDependency")}</option>
                          {detail.candidates
                            .filter((c) => !detail.blockedBy.some((b) => b.id === c.id))
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                        </Select>
                        <Button type="submit" variant="secondary" size="xs">
                          {t("common.add")}
                        </Button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Attachments */}
                <div className="mt-5">
                  <SectionHeader icon={<Paperclip size={14} />} title={`${t("task.attachments")} (${detail.attachments.length}/10)`} />
                  <div className="space-y-1.5">
                    {detail.attachments.map((file) => (
                      <div key={file.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
                        <span className="text-muted-foreground">
                          {file.mime.startsWith("image/") ? <ImageIcon size={16} /> : file.mime === "application/pdf" ? <FilePdf size={16} /> : <FileIcon size={16} />}
                        </span>
                        <a href={file.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[12px] font-medium hover:underline">
                          {file.fileName}
                        </a>
                        <span className="text-[10px] text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                        {canEdit && (
                          <button type="button" onClick={() => run(() => deleteAttachment(file.id))} aria-label={t("common.delete")} className="cursor-pointer text-muted-foreground hover:text-destructive">
                            <Trash size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                    {canEdit && (
                      <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-[12px] text-muted-foreground transition hover:border-border-strong hover:text-foreground">
                        <Paperclip size={13} /> {t("task.attachments")}
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const fd = new FormData();
                            fd.set("file", file);
                            e.target.value = "";
                            startTransition(async () => {
                              const res = await uploadAttachment(task.id, fd);
                              if (!res.ok) toast(res.error ?? t("common.error"), "error");
                              else toast(t("common.saved"));
                              await refresh();
                            });
                          }}
                        />
                      </label>
                    )}
                    <p className="text-[10px] text-muted-foreground">{t("task.filesHint")}</p>
                  </div>
                </div>

                {/* Comments */}
                <div className="mt-5">
                  <SectionHeader icon={<ChatCircleText size={14} />} title={`${t("task.comments")} (${detail.comments.length})`} />
                  <div className="space-y-3">
                    {detail.comments.map((comment) => (
                      <CommentItem key={comment.id} comment={comment} onRefresh={refresh} />
                    ))}
                  </div>
                  <CommentComposer taskId={task.id} onDone={refresh} />
                </div>

                {/* Activity */}
                <div className="mt-5">
                  <SectionHeader icon={<ClockCounterClockwise size={14} />} title={t("task.activity")} />
                  <ul className="space-y-1.5">
                    {detail.activity.map((item) => (
                      <li key={item.id} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-border-strong" />
                        <span>
                          <span className="font-medium text-foreground">{item.actorName}</span> · {activityText(item, t)} ·{" "}
                          {relativeTime(item.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {canEdit && (
                  <div className="mt-6 flex items-center justify-between border-t border-border pt-3">
                    <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(true)} className="text-destructive hover:bg-destructive-soft">
                      <Trash size={13} /> {t("common.delete")}
                    </Button>
                    <span className="text-[10px] text-muted-foreground">ID {task.id.slice(-6)}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <ConfirmDialog
          open={confirmBlocked}
          onClose={() => setConfirmBlocked(false)}
          onConfirm={() => {
            setConfirmBlocked(false);
            if (!task) return;
            run(() => updateTask(task.id, { status: "DONE", confirmDone: true }), t("toast.taskUpdated"));
          }}
          title={t("task.blockedWarning")}
          message={t("task.blockedWarning")}
          confirmLabel={t("common.confirm")}
          danger={false}
        />

        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            if (!task) return;
            startTransition(async () => {
              const res = await deleteTask(task.id);
              if (!res.ok) {
                toast(res.error ?? t("common.error"), "error");
                return;
              }
              setConfirmDelete(false);
              onClose();
              router.refresh();
            });
          }}
          title={t("common.delete")}
          message={t("task.deleteConfirm")}
          confirmLabel={t("common.delete")}
        />
      </div>
    </div>
  );
}

function allNodes(nodes: TaskNode[]): TaskNode[] {
  return nodes.flatMap((node) => [node, ...allNodes(node.children)]);
}

function QuickSubtaskForm({
  projectId,
  parentTaskId,
  onCreated,
  run,
  autoFocus,
}: {
  projectId: string;
  parentTaskId: string;
  onCreated: () => void;
  run: (fn: () => Promise<ActionResult>, success?: string) => void;
  autoFocus?: boolean;
}) {
  const t = useT();
  return (
    <form
      className="flex items-center gap-2 border-t border-border/70 px-2.5 py-1.5 first:border-t-0"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("subtask") as HTMLInputElement;
        const title = input.value.trim();
        if (!title) return;
        input.value = "";
        run(async () => {
          const res = await createTask(projectId, { title, parentTaskId });
          if (res.ok) onCreated();
          return res;
        }, t("toast.taskCreated"));
      }}
    >
      <Plus size={13} className="text-muted-foreground" />
      <input
        name="subtask"
        autoFocus={autoFocus}
        placeholder={t("task.addSubtask")}
        aria-label={t("task.addSubtask")}
        className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
      />
    </form>
  );
}

function SubtaskTree({
  nodes,
  meta,
  canEdit,
  depth,
  run,
}: {
  nodes: TaskNode[];
  meta: TaskDetail["meta"];
  canEdit: boolean;
  parentId: string;
  depth: number;
  run: (fn: () => Promise<ActionResult>, success?: string) => void;
}) {
  const t = useT();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const hrefFor = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("task", id);
    return `${pathname}?${next.toString()}`;
  };

  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isCollapsed = collapsed[node.id];
        return (
          <div key={node.id} className="border-b border-border/60 last:border-0">
            <div
              className="group flex items-center gap-1.5 py-1.5 pr-2.5 transition hover:bg-surface-muted/40"
              style={{ paddingLeft: 10 + depth * 16 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [node.id]: !prev[node.id] }))}
                  className="grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground hover:bg-surface-muted"
                  aria-label={isCollapsed ? "Expand" : "Collapse"}
                  aria-expanded={!isCollapsed}
                >
                  <CaretDown size={10} className={cn("transition", isCollapsed && "-rotate-90")} />
                </button>
              ) : (
                <span className="h-4 w-4 shrink-0" />
              )}

              <button
                type="button"
                disabled={!canEdit}
                onClick={() => run(() => updateTask(node.id, { status: node.status === "DONE" ? "TODO" : "DONE", confirmDone: true }))}
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition",
                  node.status === "DONE"
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-border-strong text-transparent hover:border-emerald-500",
                )}
                aria-label={t("task.markDone")}
              >
                <Check size={9} weight="bold" />
              </button>

              <Link href={hrefFor(node.id)} className="min-w-0 flex-1">
                <span className={cn("truncate text-[12.5px]", node.status === "DONE" && "text-muted-foreground line-through")}>
                  {node.title}
                </span>
              </Link>

              {hasChildren && (
                <span className="rounded bg-surface-muted px-1 text-[9px] text-muted-foreground">
                  {node.children.filter((c) => c.status === "DONE").length}/{node.children.length}
                </span>
              )}

              <div className="w-[72px] shrink-0 sm:w-[104px]">
                <AssigneePicker
                  members={meta.members}
                  value={node.assignees.map((a) => a.id)}
                  onChange={(ids) => run(() => updateTask(node.id, { assigneeIds: ids }))}
                  disabled={!canEdit}
                  compact
                  size={18}
                  ariaLabel={`${t("task.assignee")}: ${node.title}`}
                />
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => setAddingFor((current) => (current === node.id ? null : node.id))}
                  className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-surface-muted hover:text-foreground group-hover:opacity-100"
                  aria-label={t("task.addSubtask")}
                >
                  <Plus size={11} />
                </button>
              )}
            </div>

            {addingFor === node.id && (
              <div style={{ paddingLeft: 10 + (depth + 1) * 16 }}>
                <QuickSubtaskForm
                  projectId={meta.id}
                  parentTaskId={node.id}
                  autoFocus
                  onCreated={() => {
                    setAddingFor(null);
                    router.refresh();
                  }}
                  run={run}
                />
              </div>
            )}

            {hasChildren && !isCollapsed && (
              <div className="border-l border-border/60" style={{ marginLeft: 17 + depth * 16 }}>
                <SubtaskTree
                  nodes={node.children}
                  meta={meta}
                  canEdit={canEdit}
                  parentId={node.id}
                  depth={0}
                  run={run}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 text-[10px] uppercase">{label}</Label>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
      <span className="text-muted-foreground">{icon}</span>
      {title}
    </h3>
  );
}

function DescriptionEditor({
  value,
  readOnly,
  onSave,
  placeholder,
}: {
  value: string;
  readOnly: boolean;
  onSave: (value: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => setDraft(value), [value]);

  if (readOnly) {
    return <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{value || "—"}</p>;
  }

  return (
    <div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setEditing(true)}
        rows={3}
        placeholder={placeholder}
        className="resize-y text-[13px]"
        aria-label={placeholder}
      />
      {editing && draft !== value && (
        <div className="mt-1.5 flex justify-end gap-1.5">
          <Button variant="ghost" size="xs" onClick={() => setDraft(value)}>
            Batal
          </Button>
          <Button
            size="xs"
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
          >
            Simpan
          </Button>
        </div>
      )}
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  readOnly,
  members,
  onSave,
}: {
  field: { id: string; type: string; options: string[] };
  value: string;
  readOnly: boolean;
  members: { id: string; name: string }[];
  onSave: (value: string) => void;
}) {
  const t = useT();
  const [, startTransition] = useTransition();
  const save = (v: string) => {
    if (readOnly) return;
    startTransition(() => onSave(v));
  };

  if (field.type === "CHECKBOX") {
    return (
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={value === "true"} disabled={readOnly} onChange={(e) => save(e.target.checked ? "true" : "false")} className="h-3.5 w-3.5 accent-[var(--primary)]" />
        {value === "true" ? "✓" : ""}
      </label>
    );
  }
  if (field.type === "DATE") {
    return <Input type="date" defaultValue={value ? value.slice(0, 10) : ""} disabled={readOnly} onChange={(e) => save(e.target.value)} className="h-8 text-[12px]" />;
  }
  if (field.type === "SINGLE_SELECT") {
    return (
      <Select defaultValue={value} disabled={readOnly} onChange={(e) => save(e.target.value)} className="h-8 text-[12px]">
        <option value="">{t("common.none")}</option>
        {field.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }
  if (field.type === "MULTI_SELECT") {
    let selected: string[] = [];
    try {
      selected = value ? (JSON.parse(value) as string[]) : [];
    } catch {
      selected = [];
    }
    return (
      <div className="flex flex-wrap gap-1">
        {field.options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              disabled={readOnly}
              onClick={() => save(JSON.stringify(on ? selected.filter((x) => x !== o) : [...selected, o]))}
              className={cn(
                "cursor-pointer rounded-md border px-1.5 py-0.5 text-[11px] transition",
                on ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-surface-muted",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  if (field.type === "PERSON") {
    return (
      <Select defaultValue={value} disabled={readOnly} onChange={(e) => save(e.target.value)} className="h-8 text-[12px]">
        <option value="">{t("common.none")}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </Select>
    );
  }
  if (field.type === "NUMBER") {
    return (
      <Input
        type="number"
        defaultValue={value}
        disabled={readOnly}
        onBlur={(e) => save(e.target.value)}
        className="h-8 text-[12px]"
      />
    );
  }
  return <Input defaultValue={value} disabled={readOnly} onBlur={(e) => save(e.target.value)} className="h-8 text-[12px]" />;
}

function CommentItem({ comment, onRefresh }: { comment: TaskDetail["comments"][number]; onRefresh: () => Promise<void> | void }) {
  const t = useT();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2.5">
      <Avatar name={comment.authorName} src={comment.authorAvatar} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold">{comment.authorName}</span>
          <span className="text-[10px] text-muted-foreground">{relativeTime(comment.createdAt)}</span>
          {comment.editedAt && <span className="text-[10px] italic text-muted-foreground">({t("task.edited")})</span>}
          <span className="ml-auto flex items-center gap-1">
            {comment.canModify && (
              <button type="button" onClick={() => setEditing((e) => !e)} aria-label={t("common.edit")} className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground">
                <PencilSimple size={12} />
              </button>
            )}
            {comment.canDelete && (
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteComment(comment.id);
                    if (!res.ok) toast(res.error ?? t("common.error"), "error");
                    await onRefresh();
                  })
                }
                aria-label={t("common.delete")}
                className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-destructive"
              >
                <Trash size={12} />
              </button>
            )}
          </span>
        </div>
        {editing ? (
          <div className="mt-1">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="text-[12px]" autoFocus />
            <div className="mt-1 flex justify-end gap-1">
              <Button variant="ghost" size="xs" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                size="xs"
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await editComment(comment.id, draft);
                    if (!res.ok) toast(res.error ?? t("common.error"), "error");
                    else setEditing(false);
                    await onRefresh();
                  })
                }
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/90">{comment.body}</p>
        )}
      </div>
    </div>
  );
}

function CommentComposer({ taskId, onDone }: { taskId: string; onDone: () => Promise<void> | void }) {
  const t = useT();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const value = body.trim();
    if (!value) return;
    setBody("");
    startTransition(async () => {
      const res = await addComment(taskId, value);
      if (!res.ok) {
        toast(res.error ?? t("common.error"), "error");
        setBody(value);
        return;
      }
      await onDone();
    });
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-muted/40 p-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        rows={2}
        placeholder={t("task.commentPlaceholder")}
        className="border-0 bg-transparent p-1 shadow-none focus:ring-0"
        aria-label={t("task.commentPlaceholder")}
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Ctrl + Enter</span>
        <Button size="xs" loading={pending} onClick={submit} disabled={!body.trim()}>
          {t("task.send")}
        </Button>
      </div>
    </div>
  );
}

function activityText(item: TaskDetail["activity"][number], t: ReturnType<typeof useT>) {
  const map: Record<string, string> = {
    task_created: t("task.new"),
    subtask_created: t("task.subtasks"),
    status_changed: t("task.status"),
    assignee_changed: t("task.assignee"),
    assignee_added: t("task.assignee"),
    assignee_removed: t("task.assignee"),
    due_date_changed: t("task.dueDate"),
    start_date_changed: t("task.startDate"),
    priority_changed: t("task.priority"),
    title_changed: t("task.title"),
    description_changed: t("task.description"),
    milestone_changed: t("task.milestone"),
    comment_created: t("task.comments"),
    attachment_added: t("task.attachments"),
    dependency_added: t("task.dependencies"),
    dependency_removed: t("task.dependencies"),
    task_deleted: t("common.delete"),
    task_restored: t("common.restore"),
  };
  const label = map[item.action] ?? item.action;
  if (item.field === "status" && item.fromValue && item.toValue) {
    return `${label}: ${item.fromValue} → ${item.toValue}`;
  }
  if (item.action === "assignee_added") return `${label}: +${item.toValue ?? ""}`;
  if (item.action === "assignee_removed") return `${label}: −${item.fromValue ?? ""}`;
  if (item.action === "assignee_changed") return label;
  return label;
}
