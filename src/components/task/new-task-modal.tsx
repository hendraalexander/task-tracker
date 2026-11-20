"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useT, useToast } from "@/components/providers";
import { AssigneePicker } from "@/components/task/assignee-picker";
import { createTask } from "@/actions/task";
import { PRIORITY_ORDER, STATUS_ORDER } from "@/lib/utils";
import type { ProjectMeta } from "@/lib/task-types";

export function NewTaskModal({
  meta,
  open,
  onClose,
  defaultStatus = "TODO",
  defaultDueDate,
}: {
  meta: ProjectMeta;
  open: boolean;
  onClose: () => void;
  defaultStatus?: string;
  defaultDueDate?: string;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  if (!meta.canEdit) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("task.new")}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            loading={pending}
            onClick={() => {
              const form = document.getElementById("new-task-form") as HTMLFormElement | null;
              if (!form) return;
              const fd = new FormData(form);
              const title = String(fd.get("title") ?? "").trim();
              if (!title) {
                setError(t("task.title"));
                return;
              }
              setError(undefined);
              startTransition(async () => {
                const res = await createTask(meta.id, {
                  title,
                  status: String(fd.get("status") ?? "TODO"),
                  priority: String(fd.get("priority") ?? "MEDIUM"),
                  assigneeIds,
                  dueDate: String(fd.get("dueDate") ?? "") || null,
                  description: String(fd.get("description") ?? "") || null,
                });
                if (!res.ok) {
                  setError(res.error ?? t("common.error"));
                  return;
                }
                toast(t("toast.taskCreated"));
                onClose();
                router.refresh();
              });
            }}
          >
            {t("common.create")}
          </Button>
        </>
      }
    >
      <form id="new-task-form" className="space-y-3.5" onSubmit={(e) => e.preventDefault()}>
        <Field label={t("task.title")} error={error}>
          <Input name="title" autoFocus placeholder={t("task.title")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("task.status")}>
            <Select name="status" defaultValue={defaultStatus}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}` as never)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("task.priority")}>
            <Select name="priority" defaultValue="MEDIUM">
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {t(`priority.${p}` as never)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("task.assignee")}>
            <AssigneePicker members={meta.members} value={assigneeIds} onChange={setAssigneeIds} />
          </Field>
          <Field label={t("task.dueDate")}>
            <Input name="dueDate" type="date" defaultValue={defaultDueDate ?? ""} />
          </Field>
        </div>
        <Field label={t("task.description")}>
          <Textarea name="description" rows={3} placeholder={t("common.optional")} />
        </Field>
      </form>
    </Modal>
  );
}
