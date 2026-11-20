"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShareNetwork, Link as LinkIcon, EnvelopeSimple } from "@phosphor-icons/react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useT, useToast, CopyButton } from "@/components/providers";
import { inviteGuest } from "@/actions/member";

export function ShareProjectButton({
  workspaceSlug,
  projectId,
  projectName,
  canInviteGuest,
}: {
  workspaceSlug: string;
  projectId: string;
  projectName: string;
  canInviteGuest: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  const projectUrl = typeof window !== "undefined" ? `${window.location.origin}/w/${workspaceSlug}/p/${projectId}/list` : "";

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <ShareNetwork size={14} /> {t("projects.share")}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("projects.share")} description={projectName} size="sm">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <LinkIcon size={13} /> Link
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{projectUrl}</span>
              <CopyButton value={projectUrl} label={t("common.copy")} />
            </div>
          </div>

          {canInviteGuest ? (
            <form
              className="space-y-3 border-t border-border pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("workspaceSlug", workspaceSlug);
                const email = String(fd.get("email") ?? "");
                startTransition(async () => {
                  const res = await inviteGuest(projectId, fd);
                  if (!res.ok) {
                    toast(res.error ?? t("common.error"), "error");
                    return;
                  }
                  toast(t("toast.invited"));
                  if (res.warning) setLink(res.warning);
                  (e.target as HTMLFormElement).reset();
                  router.refresh();
                });
              }}
            >
              <Field label={t("members.invite")} hint={t("members.guestHint")}>
                <Input name="email" type="email" required placeholder="klien@perusahaan.com" />
              </Field>
              <Button type="submit" size="sm" className="w-full" loading={pending}>
                <EnvelopeSimple size={14} /> {t("members.invite")}
              </Button>
              {link && (
                <p className="break-all rounded bg-surface-muted p-2 font-mono text-[10px] text-primary">
                  <a href={link}>{link}</a>
                </p>
              )}
            </form>
          ) : (
            <p className="rounded-lg border border-border bg-surface-muted p-3 text-[12px] text-muted-foreground">
              {t("billing.lockedFeature")}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
