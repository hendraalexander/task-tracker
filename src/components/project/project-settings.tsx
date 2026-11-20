"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Diamond, Lock, Plus, Trash, UserPlus, Warning } from "@phosphor-icons/react";
import { Avatar, Badge, Button, Card, Field, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { useT, useToast } from "@/components/providers";
import {
  addProjectMember,
  archiveProject,
  createCustomField,
  deleteCustomField,
  deleteMilestone,
  deleteProject,
  removeProjectMember,
  updateProject,
  upsertMilestone,
} from "@/actions/project";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { FieldDTO, MemberDTO, MilestoneDTO, ProjectMeta } from "@/lib/task-types";

export function ProjectSettings({
  meta,
  project,
  members,
  workspaceUsers,
  fields,
  milestones,
  customFieldsAvailable,
  locale,
}: {
  meta: ProjectMeta;
  project: {
    name: string;
    description: string | null;
    startDate: string | null;
    dueDate: string | null;
    privacy: string;
    color: string;
    archived: boolean;
  };
  members: MemberDTO[];
  workspaceUsers: { id: string; name: string; email: string; avatarUrl: string | null }[];
  fields: FieldDTO[];
  milestones: MilestoneDTO[];
  customFieldsAvailable: boolean;
  locale: Locale;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [fieldType, setFieldType] = useState("TEXT");
  const [deleteField, setDeleteField] = useState<FieldDTO | null>(null);
  const [deleteMilestoneTarget, setDeleteMilestoneTarget] = useState<MilestoneDTO | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string; warning?: string }>, success = t("common.saved")) => {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast(res.error ?? t("common.error"), "error");
      else {
        toast(success);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">{t("projects.settings")}</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("workspaceSlug", meta.workspaceSlug);
            run(() => updateProject(meta.id, fd));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("projects.name")} className="sm:col-span-2">
              <Input name="name" defaultValue={project.name} required />
            </Field>
            <Field label={t("projects.description")} className="sm:col-span-2">
              <Textarea name="description" defaultValue={project.description ?? ""} rows={2} />
            </Field>
            <Field label={t("projects.startDate")}>
              <Input name="startDate" type="date" defaultValue={project.startDate?.slice(0, 10) ?? ""} />
            </Field>
            <Field label={t("projects.dueDate")}>
              <Input name="dueDate" type="date" defaultValue={project.dueDate?.slice(0, 10) ?? ""} />
            </Field>
            <Field label={t("projects.privacy")}>
              <Select name="privacy" defaultValue={project.privacy}>
                <option value="PUBLIC">{t("projects.public")}</option>
                <option value="PRIVATE">{t("projects.private")}</option>
              </Select>
            </Field>
            <Field label={t("projects.color")}>
              <div className="flex items-center gap-2">
                <input type="color" name="color" defaultValue={project.color} className="h-9 w-14 cursor-pointer rounded-lg border border-border bg-surface p-1" />
                <span className="font-mono text-[11px] text-muted-foreground">{project.color}</span>
              </div>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={pending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">{t("projects.members")}</h2>
        <div className="mt-3 divide-y divide-border">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-2 py-2">
              <Avatar name={member.name} src={member.avatarUrl} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium">{member.name}</p>
                <p className="truncate text-[10.5px] text-muted-foreground">{member.email}</p>
              </div>
              <Badge tone={member.role === "PROJECT_ADMIN" ? "primary" : "neutral"}>
                {member.role === "PROJECT_ADMIN" ? t("role.PROJECT_ADMIN") : t("role.MEMBER")}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="hover:text-destructive"
                aria-label={t("members.remove")}
                onClick={() => run(() => removeProjectMember(meta.id, member.id))}
              >
                <Trash size={13} />
              </Button>
            </div>
          ))}
        </div>

        <form
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("workspaceSlug", meta.workspaceSlug);
            const form = e.currentTarget;
            run(() => addProjectMember(meta.id, fd), t("common.saved"));
            form.reset();
          }}
        >
          <Field label={t("projects.addMember")} className="min-w-[200px] flex-1">
            <Select name="userId" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {workspaceUsers
                .filter((user) => !members.some((m) => m.id === user.id))
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t("members.role")} className="w-[150px]">
            <Select name="role" defaultValue="MEMBER">
              <option value="MEMBER">{t("role.MEMBER")}</option>
              <option value="PROJECT_ADMIN">{t("role.PROJECT_ADMIN")}</option>
            </Select>
          </Field>
          <Button type="submit" size="md" loading={pending}>
            <UserPlus size={14} /> {t("common.add")}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">{t("projects.customFields")}</h2>
          {!customFieldsAvailable && <Badge tone="warning"><Lock size={10} /> Pro</Badge>}
        </div>

        <div className="mt-3 space-y-1.5">
          {fields.map((field) => (
            <div key={field.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">{field.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {field.type.replaceAll("_", " ").toLowerCase()}
                  {field.options.length > 0 ? ` · ${field.options.join(", ")}` : ""}
                  {field.required ? ` · ${t("common.required")}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="hover:text-destructive" aria-label={t("common.delete")} onClick={() => setDeleteField(field)}>
                <Trash size={13} />
              </Button>
            </div>
          ))}
          {fields.length === 0 && <p className="text-[12px] text-muted-foreground">{t("common.empty")}</p>}
        </div>

        <form
          className="mt-3 space-y-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!customFieldsAvailable) {
              toast(t("billing.lockedFeature"), "info");
              return;
            }
            const fd = new FormData(e.currentTarget);
            fd.set("workspaceSlug", meta.workspaceSlug);
            const form = e.currentTarget;
            run(() => createCustomField(meta.id, fd));
            form.reset();
            setFieldType("TEXT");
          }}
        >
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("projects.customFields")} className="min-w-[160px] flex-1">
              <Input name="name" required placeholder="Budget" disabled={!customFieldsAvailable} />
            </Field>
            <Field label="Tipe" className="w-[150px]">
              <Select name="type" value={fieldType} onChange={(e) => setFieldType(e.target.value)} disabled={!customFieldsAvailable}>
                {["TEXT", "NUMBER", "DATE", "SINGLE_SELECT", "MULTI_SELECT", "CHECKBOX", "PERSON"].map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ").toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
            {["SINGLE_SELECT", "MULTI_SELECT"].includes(fieldType) && (
              <Field label="Opsi (pisah koma)" className="min-w-[180px] flex-1">
                <Input name="options" placeholder="Riset, Desain, Build" disabled={!customFieldsAvailable} />
              </Field>
            )}
            <label className="flex h-9 items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <input type="checkbox" name="required" className="h-3.5 w-3.5 accent-[var(--primary)]" disabled={!customFieldsAvailable} />
              {t("common.required")}
            </label>
            <Button type="submit" size="md" disabled={!customFieldsAvailable}>
              <Plus size={14} /> {t("common.add")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">{t("projects.milestones")}</h2>
        <div className="mt-3 space-y-1.5">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Diamond size={13} className="text-violet-500" />
              <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{milestone.name}</p>
              <span className="text-[10.5px] text-muted-foreground">{formatDate(milestone.date, locale)}</span>
              <Button variant="ghost" size="icon" className="hover:text-destructive" aria-label={t("common.delete")} onClick={() => setDeleteMilestoneTarget(milestone)}>
                <Trash size={13} />
              </Button>
            </div>
          ))}
          {milestones.length === 0 && <p className="text-[12px] text-muted-foreground">{t("common.empty")}</p>}
        </div>
        <form
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("workspaceSlug", meta.workspaceSlug);
            const form = e.currentTarget;
            run(() => upsertMilestone(meta.id, fd));
            form.reset();
          }}
        >
          <Field label={t("projects.milestones")} className="min-w-[180px] flex-1">
            <Input name="name" required placeholder="Peluncuran" />
          </Field>
          <Field label={t("task.dueDate")} className="w-[160px]">
            <Input name="date" type="date" required />
          </Field>
          <Button type="submit" size="md">
            <Plus size={14} /> {t("common.add")}
          </Button>
        </form>
      </Card>

      <Card className="border-red-200 p-5 dark:border-red-950">
        <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-red-600 dark:text-red-400">
          <Warning size={15} /> {t("settings.dangerZone")}
        </h2>
        <p className="mt-1 text-[12px] text-muted-foreground">{t("projects.archiveConfirm")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() => {
              run(() => archiveProject(meta.id));
              router.push(`/w/${meta.workspaceSlug}/projects`);
            }}
          >
            <Archive size={14} /> {t("common.archive")}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmDeleteProject(true)}>
            <Trash size={14} /> {t("common.delete")}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={!!deleteField}
        onClose={() => setDeleteField(null)}
        onConfirm={() => {
          if (!deleteField) return;
          const field = deleteField;
          setDeleteField(null);
          run(() => deleteCustomField(meta.id, field.id));
        }}
        title={t("common.delete")}
        message={`${deleteField?.name ?? ""} — ${t("task.filesHint")}`}
        confirmLabel={t("common.delete")}
      />

      <ConfirmDialog
        open={!!deleteMilestoneTarget}
        onClose={() => setDeleteMilestoneTarget(null)}
        onConfirm={() => {
          if (!deleteMilestoneTarget) return;
          const milestone = deleteMilestoneTarget;
          setDeleteMilestoneTarget(null);
          run(() => deleteMilestone(meta.id, milestone.id));
        }}
        title={t("common.delete")}
        message={deleteMilestoneTarget?.name ?? ""}
        confirmLabel={t("common.delete")}
      />

      <ConfirmDialog
        open={confirmDeleteProject}
        onClose={() => {
          setConfirmDeleteProject(false);
          setConfirmName("");
        }}
        onConfirm={() => {
          startTransition(async () => {
            const res = await deleteProject(meta.id, confirmName);
            if (res && !res.ok) toast(res.error ?? t("common.error"), "error");
          });
        }}
        title={t("projects.deleteTitle")}
        message={t("projects.deleteHint")}
        confirmLabel={t("common.delete")}
      >
        <Label>{t("projects.name")}</Label>
        <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={project.name} />
      </ConfirmDialog>
    </div>
  );
}
