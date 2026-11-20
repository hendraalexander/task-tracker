"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SignOut, Monitor, Warning, Desktop, UploadSimple, Trash, SpinnerGap } from "@phosphor-icons/react";
import { Button, Card, Field, Input, Select, Avatar } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { useT, useToast } from "@/components/providers";
import { deleteAccount, logoutAllSessions, removeAvatar, revokeSession, updateProfile, uploadAvatar } from "@/actions/member";
import { relativeTime, formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

type Prefs = {
  assignmentEmail: boolean;
  mentionEmail: boolean;
  commentEmail: boolean;
  dueDateEmail: boolean;
  digestEmail: boolean;
  inApp: boolean;
};

type SessionRow = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

export function ProfileForm({
  user,
  prefs,
  sessions,
  locale,
}: {
  user: {
    name: string;
    email: string;
    avatarUrl: string | null;
    locale: string;
    timezone: string;
    dateFormat: string;
    theme: string;
    animations: boolean;
    verified: boolean;
  };
  prefs: Prefs;
  sessions: SessionRow[];
  locale: Locale;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, sessionAction] = useTransition();
  const [avatarPending, startAvatar] = useTransition();

  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await updateProfile(fd);
      if (!res.ok) toast(res.error ?? t("common.error"), "error");
      else {
        toast(t("common.saved"));
        router.refresh();
      }
    });
  };

  const timezones = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "Asia/Tokyo", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "UTC"];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="relative">
            {avatarPending ? (
              <div className="grid h-[72px] w-[72px] place-items-center rounded-full border border-border bg-surface-muted">
                <SpinnerGap size={20} className="animate-spin text-primary" />
              </div>
            ) : (
              <Avatar name={user.name} src={user.avatarUrl} size={72} className="text-xl" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{user.name}</p>
            <p className="text-[12px] text-muted-foreground">
              {user.email} {user.verified ? "· ✓" : "· belum terverifikasi"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border bg-surface px-2 text-[11.5px] font-medium transition hover:bg-surface-muted">
                <UploadSimple size={12} /> {locale === "en" ? "Change photo" : "Ganti foto"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  disabled={avatarPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = "";
                    const fd = new FormData();
                    fd.set("avatar", file);
                    startAvatar(async () => {
                      const res = await uploadAvatar(fd);
                      if (!res.ok) toast(res.error ?? t("common.error"), "error");
                      else {
                        toast(t("common.saved"));
                        router.refresh();
                      }
                    });
                  }}
                />
              </label>
              {user.avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    startAvatar(async () => {
                      const res = await removeAvatar();
                      if (!res.ok) toast(res.error ?? t("common.error"), "error");
                      else {
                        toast(t("common.saved"));
                        router.refresh();
                      }
                    })
                  }
                >
                  <Trash size={12} /> {t("common.delete")}
                </Button>
              )}
              <span className="text-[10px] text-muted-foreground">
                PNG · JPG · WebP · GIF (maks 5 MB)
              </span>
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("settings.name")}>
              <Input name="name" defaultValue={user.name} required />
            </Field>
            <Field label={t("settings.email")}>
              <Input value={user.email} readOnly disabled />
            </Field>
            <Field label={t("settings.locale")}>
              <Select name="locale" defaultValue={user.locale}>
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </Select>
            </Field>
            <Field label={t("settings.timezone")}>
              <Select name="timezone" defaultValue={user.timezone}>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("settings.dateFormat")}>
              <Select name="dateFormat" defaultValue={user.dateFormat}>
                <option value="dd/MM/yyyy">31/12/2026</option>
                <option value="MM/dd/yyyy">12/31/2026</option>
                <option value="yyyy-MM-dd">2026-12-31</option>
                <option value="dd MMM yyyy">31 Des 2026</option>
              </Select>
            </Field>
            <Field label={t("settings.theme")}>
              <Select name="theme" defaultValue={user.theme}>
                <option value="system">{t("settings.themeSystem")}</option>
                <option value="light">{t("settings.themeLight")}</option>
                <option value="dark">{t("settings.themeDark")}</option>
              </Select>
            </Field>
            <Field label={t("settings.animations")}>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[12.5px] transition hover:border-border-strong">
                <input type="checkbox" name="animations" defaultChecked={user.animations} className="h-3.5 w-3.5 accent-[var(--primary)]" />
                {t("settings.animationsHint")}
              </label>
            </Field>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2.5 text-[12px] font-semibold">{t("settings.notifications")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["inApp", t("settings.notifInApp")],
                  ["assignmentEmail", t("settings.notifAssignment")],
                  ["mentionEmail", t("settings.notifMention")],
                  ["commentEmail", t("settings.notifComment")],
                  ["dueDateEmail", t("settings.notifDue")],
                  ["digestEmail", t("settings.notifDigest")],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[12.5px] hover:bg-surface-muted">
                  <input type="checkbox" name={key} defaultChecked={prefs[key]} className="h-3.5 w-3.5 accent-[var(--primary)]" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={pending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold">
          <Monitor size={14} /> {t("settings.sessions")}
        </p>
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
              <Desktop size={16} className="text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">
                  {session.userAgent?.split(")")[0] ?? "Unknown device"}
                  {session.current && <span className="ml-1.5 rounded bg-emerald-50 px-1 py-px text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{t("settings.currentSession")}</span>}
                </p>
                <p className="text-[10.5px] text-muted-foreground" suppressHydrationWarning>
                  {session.ip ?? "—"} · {formatDateTime(session.lastSeenAt, locale)} · {relativeTime(session.createdAt, locale)}
                </p>
              </div>
              {!session.current && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    sessionAction(async () => {
                      await revokeSession(session.id);
                      router.refresh();
                    })
                  }
                >
                  {t("settings.revoke")}
                </Button>
              )}
            </div>
          ))}
        </div>
        <form action={logoutAllSessions} className="mt-3 flex justify-end">
          <Button type="submit" variant="secondary" size="sm">
            <SignOut size={14} /> {t("settings.logoutAll")}
          </Button>
        </form>
      </Card>

      <Card className="border-red-200 p-5 dark:border-red-950">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-red-600 dark:text-red-400">
          <Warning size={14} /> {t("settings.dangerZone")}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">{t("settings.deleteAccountHint")}</p>
        <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmDelete(true)}>
          {t("settings.deleteAccount")}
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          sessionAction(async () => {
            await deleteAccount();
          });
        }}
        title={t("settings.deleteAccount")}
        message={t("settings.deleteAccountHint")}
        confirmLabel={t("common.delete")}
      />
    </div>
  );
}
