"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EnvelopeSimple, Trash, UserPlus, UsersThree, ClockCounterClockwise, Copy, UploadSimple, SpinnerGap } from "@phosphor-icons/react";
import { Avatar, Badge, Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { useT, useToast, CopyButton } from "@/components/providers";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  removeWorkspaceLogo,
  resendInvitation,
  revokeInvitation,
  updateWorkspaceSettings,
  uploadWorkspaceLogo,
} from "@/actions/member";
import { relativeTime, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

type Member = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
};

type Invitation = { id: string; email: string; role: string; expiresAt: string; createdAt: string; link: string };

export function MembersAdmin({
  workspaceSlug,
  workspaceName,
  workspaceSlugValue,
  workspaceLogoUrl,
  members,
  invitations,
  seats,
  seatLimit,
  audit,
  locale,
  currentUserId,
}: {
  workspaceSlug: string;
  workspaceName: string;
  workspaceSlugValue: string;
  workspaceLogoUrl: string | null;
  members: Member[];
  invitations: Invitation[];
  seats: number;
  seatLimit: number;
  audit: { id: string; action: string; actorName: string; target: string; createdAt: string }[];
  locale: Locale;
  currentUserId: string;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, inviting] = useActionState(inviteMember, null);
  const [pending, startTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [logoPending, startLogo] = useTransition();
  const limitReached = seats >= seatLimit;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UsersThree size={17} className="text-muted-foreground" />
            <h2 className="text-[15px] font-semibold">{t("members.title")}</h2>
          </div>
          <Badge tone={limitReached ? "warning" : "neutral"}>
            {t("members.seats")}: {seats}/{seatLimit === Infinity ? "∞" : seatLimit}
          </Badge>
        </div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{t("members.subtitle")}</p>

        <form
          action={(fd) => {
            fd.set("workspaceSlug", workspaceSlug);
            startTransition(() => action(fd));
          }}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <Field label={t("members.email")} className="min-w-[220px] flex-1">
            <div className="relative">
              <EnvelopeSimple size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input name="email" type="email" required placeholder="nama@perusahaan.com" className="pl-8" />
            </div>
          </Field>
          <Field label={t("members.role")} className="w-[140px]">
            <Select name="role" defaultValue="MEMBER">
              <option value="MEMBER">{t("role.MEMBER")}</option>
              <option value="ADMIN">{t("role.ADMIN")}</option>
              <option value="VIEWER">{t("role.VIEWER")}</option>
            </Select>
          </Field>
          <Button type="submit" size="md" loading={inviting || pending} disabled={limitReached}>
            <UserPlus size={15} /> {t("members.invite")}
          </Button>
        </form>

        {limitReached && (
          <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">{t("members.limitReached")}</p>
        )}
        {state?.error && <p className="mt-2 text-[11px] font-medium text-destructive">{state.error}</p>}
        {state?.warning && (
          <div className="mt-2 rounded-md border border-dashed border-border bg-surface-muted p-2">
            <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Dev link</p>
            <a href={state.warning} className="block break-all font-mono text-[10px] text-primary">{state.warning}</a>
          </div>
        )}

        <div className="mt-5 divide-y divide-border">
          {members.map((member) => (
            <div key={member.userId} className="flex flex-wrap items-center gap-2 py-2.5">
              <Avatar name={member.name} src={member.avatarUrl} size={32} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                  {member.name}
                  {member.userId === currentUserId && <span className="rounded bg-surface-muted px-1 py-px text-[9px] text-muted-foreground">{t("members.you")}</span>}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{member.email}</p>
              </div>
              {member.role === "OWNER" ? (
                <Badge tone="primary">{t("role.OWNER")}</Badge>
              ) : (
                <>
                  <Select
                    value={member.role}
                    disabled={pending || member.userId === currentUserId}
                    onChange={(e) =>
                      startTransition(async () => {
                        const res = await changeMemberRole(workspaceSlug, member.userId, e.target.value);
                        if (!res.ok) toast(res.error ?? t("common.error"), "error");
                        else toast(t("members.roleChanged"));
                        router.refresh();
                      })
                    }
                    className="h-7 w-[120px] text-[11.5px]"
                    aria-label={t("members.role")}
                  >
                    <option value="ADMIN">{t("role.ADMIN")}</option>
                    <option value="MEMBER">{t("role.MEMBER")}</option>
                    <option value="VIEWER">{t("role.VIEWER")}</option>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => setRemoveTarget(member)} aria-label={t("members.remove")} className="hover:text-destructive">
                    <Trash size={14} />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      {invitations.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-[13px] font-semibold">{t("members.pending")}</h3>
          <div className="space-y-2">
            {invitations.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{invite.email}</p>
                  <p className="text-[10.5px] text-muted-foreground">
                    {t(`role.${invite.role}` as never)} · {t("members.expires")} {formatDate(invite.expiresAt, locale)}
                  </p>
                </div>
                <CopyButton value={invite.link} label={t("common.copy")} />
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    startTransition(async () => {
                      const res = await resendInvitation(workspaceSlug, invite.id);
                      if (!res.ok) toast(res.error ?? t("common.error"), "error");
                      else toast(t("toast.invited"));
                      router.refresh();
                    })
                  }
                >
                  {t("members.resend")}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="hover:text-destructive"
                  onClick={() =>
                    startTransition(async () => {
                      await revokeInvitation(workspaceSlug, invite.id);
                      toast(t("common.saved"));
                      router.refresh();
                    })
                  }
                >
                  {t("members.revoke")}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="mb-3 text-[13px] font-semibold">{t("nav.workspace")}</h3>

        <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border pb-4">
          {logoPending ? (
            <div className="grid h-14 w-14 place-items-center rounded-xl border border-border bg-surface-muted">
              <SpinnerGap size={18} className="animate-spin text-primary" />
            </div>
          ) : workspaceLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workspaceLogoUrl}
              alt={workspaceName}
              className="h-14 w-14 rounded-xl border border-border bg-surface object-cover"
            />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">
              {workspaceName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold">{t("settings.workspaceLogo")}</p>
            <p className="text-[10.5px] text-muted-foreground">{t("settings.logoHint")}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border bg-surface px-2 text-[11.5px] font-medium transition hover:bg-surface-muted">
                <UploadSimple size={12} />
                {t("settings.changeLogo")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  disabled={logoPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = "";
                    const fd = new FormData();
                    fd.set("logo", file);
                    startLogo(async () => {
                      const res = await uploadWorkspaceLogo(workspaceSlug, fd);
                      if (!res.ok) toast(res.error ?? t("common.error"), "error");
                      else {
                        toast(t("common.saved"));
                        router.refresh();
                      }
                    });
                  }}
                />
              </label>
              {workspaceLogoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={logoPending}
                  onClick={() =>
                    startLogo(async () => {
                      const res = await removeWorkspaceLogo(workspaceSlug);
                      if (!res.ok) toast(res.error ?? t("common.error"), "error");
                      else {
                        toast(t("common.saved"));
                        router.refresh();
                      }
                    })
                  }
                >
                  <Trash size={12} /> {t("settings.removeLogo")}
                </Button>
              )}
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const res = await updateWorkspaceSettings(workspaceSlug, fd);
              if (!res.ok) toast(res.error ?? t("common.error"), "error");
              else toast(t("common.saved"));
              router.refresh();
            });
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Field label={t("onboarding.wsName")}>
            <Input name="name" defaultValue={workspaceName} required />
          </Field>
          <Field label={t("onboarding.wsSlug")}>
            <Input name="slug" defaultValue={workspaceSlugValue} required />
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" size="sm" loading={pending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold">
          <ClockCounterClockwise size={14} /> {t("settings.auditLog")}
        </h3>
        <p className="mb-2 text-[11px] text-muted-foreground">{t("settings.auditHint")}</p>
        <ul className="space-y-1.5">
          {audit.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="font-medium text-foreground">{item.actorName}</span>
              <span>{item.action.replaceAll("_", " ")}</span>
              {item.target && <span className="truncate">· {item.target}</span>}
              <span className="ml-auto text-[10.5px]" suppressHydrationWarning>{relativeTime(item.createdAt, locale)}</span>
            </li>
          ))}
          {audit.length === 0 && <li className="text-[12px] text-muted-foreground">{t("common.empty")}</li>}
        </ul>
      </Card>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          const target = removeTarget;
          setRemoveTarget(null);
          startTransition(async () => {
            const res = await removeMember(workspaceSlug, target.userId);
            if (!res.ok) toast(res.error ?? t("common.error"), "error");
            else toast(t("common.saved"));
            router.refresh();
          });
        }}
        title={t("members.remove")}
        message={t("members.removeConfirm")}
        confirmLabel={t("members.remove")}
      />
    </div>
  );
}
