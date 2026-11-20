"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, EnvelopeSimple, Plus, X } from "@phosphor-icons/react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useT, useToast } from "@/components/providers";
import { createWorkspace, inviteMember } from "@/actions/member";
import { createProject, type ActionResult } from "@/actions/project";
import { slugify } from "@/lib/utils";

export function WorkspaceForm() {
  const t = useT();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createWorkspace, null);
  const [slug, setSlug] = useState("");

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      <Field label={t("onboarding.wsName")}>
        <Input
          name="name"
          required
          placeholder="Nusantara Digital"
          onChange={(e) => setSlug(slugify(e.target.value))}
        />
      </Field>
      <Field label={t("onboarding.wsSlug")}>
        <div className="flex items-center rounded-lg border border-border bg-surface shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <span className="pl-3 text-[13px] text-muted-foreground">atracker.app/w/</span>
          <input
            name="slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            required
            className="h-9 min-w-0 flex-1 rounded-r-lg bg-transparent px-1.5 pr-3 text-sm outline-none"
          />
        </div>
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("onboarding.createWorkspace")}
        {!pending && <ArrowRight size={16} weight="bold" />}
      </Button>
    </form>
  );
}

export function ProjectForm({ workspaceSlug }: { workspaceSlug: string }) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await createProject(workspaceSlug, fd);
          if (!res.ok) {
            toast(res.error ?? t("common.error"), "error");
            return;
          }
          router.push(`/onboarding?step=3&w=${workspaceSlug}&p=${res.id}`);
        });
      }}
    >
      <Field label={t("onboarding.projectName")}>
        <Input name="name" required placeholder="Redesign Website Klien" autoFocus />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("projects.startDate")}>
          <Input name="startDate" type="date" />
        </Field>
        <Field label={t("projects.dueDate")}>
          <Input name="dueDate" type="date" />
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("onboarding.createProject")}
        {!pending && <ArrowRight size={16} weight="bold" />}
      </Button>
      <Link href={`/onboarding?step=3&w=${workspaceSlug}`} className="block text-center text-[13px] text-muted-foreground hover:text-foreground">
        {t("onboarding.skip")}
      </Link>
    </form>
  );
}

export function InviteTeamForm({ workspaceSlug, next }: { workspaceSlug: string; next: string }) {
  const t = useT();
  const router = useRouter();
  const [emails, setEmails] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const add = () => {
    const clean = value.trim().toLowerCase();
    if (!clean || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setError(t("common.error"));
      return;
    }
    setEmails((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setValue("");
    setError(undefined);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground">{t("onboarding.invite")}</p>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="bagas@perusahaan.com"
            type="email"
          />
          <Button type="button" variant="secondary" onClick={add} aria-label={t("common.add")}>
            <Plus size={15} />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("onboarding.inviteHint")}</p>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>

      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map((email) => (
            <span key={email} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs">
              <EnvelopeSimple size={12} />
              {email}
              <button
                type="button"
                onClick={() => setEmails((prev) => prev.filter((e) => e !== email))}
                className="cursor-pointer rounded-full p-0.5 text-muted-foreground hover:bg-surface hover:text-foreground"
                aria-label={`Remove ${email}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-2.5">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">Dev links (no email provider configured)</p>
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link} className="truncate font-mono text-[10px] text-primary">
                <a href={link}>{link}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="flex-1"
          loading={pending}
          disabled={!emails.length}
          onClick={() =>
            startTransition(async () => {
              const created: string[] = [];
              for (const email of emails) {
                const fd = new FormData();
                fd.set("workspaceSlug", workspaceSlug);
                fd.set("email", email);
                fd.set("role", "MEMBER");
                const res = await inviteMember(null, fd);
                if (!res.ok) {
                  setError(res.error);
                  continue;
                }
                if (res.warning) created.push(res.warning);
              }
              setLinks(created);
              setEmails([]);
            })
          }
        >
          {t("members.invite")}
        </Button>
        <Button type="button" size="lg" className="flex-1" onClick={() => router.push(next)}>
          {t("onboarding.finish")}
        </Button>
      </div>
      <button type="button" onClick={() => router.push(next)} className="block w-full text-center text-[13px] text-muted-foreground hover:text-foreground">
        {t("onboarding.skip")}
      </button>
    </div>
  );
}
