"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  CheckSquare,
  FolderSimple,
  Plus,
  MagnifyingGlass,
  Bell,
  GearSix,
  UsersThree,
  CreditCard,
  UserCircle,
  Tag,
  SignOut,
  CaretUpDown,
  List,
  X,
  Sun,
  Moon,
  Monitor,
  Archive,
  ArrowSquareOut,
  Check,
  SquaresFour,
} from "@phosphor-icons/react";
import { cn, PROJECT_COLORS } from "@/lib/utils";
import { Avatar, Badge, Button, Field, Input, Kbd, Select, Textarea } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useT, useToast } from "@/components/providers";
import { CommandPalette } from "@/components/layout/command-palette";
import { BrandLogo } from "@/components/brand/logo";
import { createProject } from "@/actions/project";
import { updateTheme } from "@/actions/member";
import { logoutAction } from "@/actions/auth";

export type ShellWorkspace = { id: string; name: string; slug: string; plan: string; logoUrl?: string | null };
export type ShellProject = { id: string; name: string; color: string };
export type ShellUser = { name: string; email: string; avatarUrl: string | null };

type Props = {
  workspace: ShellWorkspace;
  workspaces: ShellWorkspace[];
  projects: ShellProject[];
  archived: ShellProject[];
  user: ShellUser;
  role: string;
  unread: number;
  canManage: boolean;
  children: ReactNode;
};

const THEMES = ["light", "dark", "system"] as const;

export function AppShell({ workspace, workspaces, projects, archived, user, role, unread, canManage, children }: Props) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("system");

  useEffect(() => {
    const stored = (document.documentElement.dataset.themePref as (typeof THEMES)[number]) ?? "system";
    setTheme(stored);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const cycleTheme = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    document.documentElement.dataset.themePref = next;
    document.cookie = `at_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    void updateTheme(next);
    router.refresh();
  };

  const themeIcon =
    theme === "dark" ? <Moon size={17} /> : theme === "light" ? <Sun size={17} /> : <Monitor size={17} />;

  const base = `/w/${workspace.slug}`;
  const nav = [
    { href: `${base}/home`, label: t("nav.home"), icon: <House size={17} /> },
    { href: `${base}/projects`, label: t("nav.projects"), icon: <SquaresFour size={17} /> },
    { href: `${base}/notifications`, label: t("nav.notifications"), icon: <Bell size={17} />, badge: unread },
  ];

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <BrandLogo href={`${base}/home`} size={26} textClassName="text-[15px]" />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface-muted lg:hidden"
          aria-label={t("common.close")}
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-3 pt-2">
        <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />
      </div>

      <div className="px-3 pt-2">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] text-muted-foreground transition hover:border-border-strong"
        >
          <MagnifyingGlass size={15} />
          <span className="flex-1 text-left">{t("common.search")}</span>
          <Kbd>Ctrl K</Kbd>
        </button>
      </div>

      <nav className="mt-3 space-y-0.5 px-3" aria-label="Utama">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition",
                active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <span className={active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 flex items-center justify-between px-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("nav.projects")}</p>
        <NewProjectButton workspaceSlug={workspace.slug} compact />
      </div>

      <div className="mt-1.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        {projects.map((project) => {
          const href = `/w/${workspace.slug}/p/${project.id}/list`;
          const active = pathname.includes(`/p/${project.id}`);
          return (
            <Link
              key={project.id}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition",
                active ? "bg-surface-muted font-medium text-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: project.color }} />
              <span className="truncate">{project.name}</span>
            </Link>
          );
        })}
        {archived.length > 0 && (
          <Link
            href={`${base}/projects?tab=archived`}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition",
              pathname === `${base}/projects` ? "text-muted-foreground hover:bg-surface-muted" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <Archive size={14} />
            <span className="truncate">{t("nav.archived")}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{archived.length}</span>
          </Link>
        )}
      </div>

      <div className="border-t border-border px-3 py-2">
        {canManage && (
          <>
            <Link
              href={`${base}/settings/members`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition",
                pathname.includes("/settings/members")
                  ? "bg-surface-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <UsersThree size={16} /> {t("nav.members")}
            </Link>
            <Link
              href={`${base}/settings/billing`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition",
                pathname.includes("/settings/billing")
                  ? "bg-surface-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <CreditCard size={16} /> {t("nav.billing")}
            </Link>
            <Link
              href={`${base}/settings/tags`}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
            >
              <Tag size={16} /> {t("nav.tags")}
            </Link>
          </>
        )}
        <Link
          href={`${base}/settings/profile`}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
        >
          <GearSix size={16} /> {t("nav.settings")}
        </Link>
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1 py-1">
          <Avatar name={user.name} src={user.avatarUrl} size={30} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight">{user.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{role}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title={t("nav.logout")}
              aria-label={t("nav.logout")}
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
            >
              <SignOut size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-border lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="animate-drawer absolute inset-y-0 left-0 w-[280px] border-r border-border shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-[52px] items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-surface-muted lg:hidden"
            aria-label="Menu"
          >
            <List size={19} />
          </button>

          <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
            <span className="hidden truncate font-medium text-foreground sm:block">{workspace.name}</span>
            <span className="hidden sm:block" aria-hidden>/</span>
            <span className="truncate">{crumb(pathname, projects) ?? t("nav.home")}</span>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setPaletteOpen(true)} aria-label={t("search.open")}>
              <MagnifyingGlass size={18} />
            </Button>
            <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label={t("settings.theme")} title={theme}>
              {themeIcon}
            </Button>
            <Link
              href={`${base}/notifications`}
              className="relative grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
              aria-label={t("nav.notifications")}
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link href={`${base}/settings/profile`} aria-label={t("nav.profile")}>
              <Avatar name={user.name} src={user.avatarUrl} size={28} />
            </Link>
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspaceSlug={workspace.slug} />
    </div>
  );
}

function crumb(pathname: string, projects: ShellProject[]) {
  const match = pathname.match(/\/p\/([^/]+)\/(\w+)/);
  if (!match) return null;
  const project = projects.find((p) => p.id === match[1]);
  const view = match[2];
  const labels: Record<string, string> = {
    list: "List",
    board: "Board",
    calendar: "Calendar",
    timeline: "Timeline",
    dashboard: "Dashboard",
    settings: "Settings",
  };
  return project ? `${project.name} · ${labels[view] ?? ""}` : null;
}

function WorkspaceSwitcher({ workspace, workspaces }: { workspace: ShellWorkspace; workspaces: ShellWorkspace[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-left transition hover:border-border-strong"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {workspace.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={workspace.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded-md border border-border object-cover" />
        ) : (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white">
            {workspace.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-tight">{workspace.name}</span>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{workspace.plan}</span>
        </span>
        <CaretUpDown size={14} className="text-muted-foreground" />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-pop absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl"
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("nav.switchWorkspace")}
          </p>
          {workspaces.map((w) => (
            <Link
              key={w.id}
              href={`/w/${w.slug}/home`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition hover:bg-surface-muted"
              onClick={() => setOpen(false)}
            >
              {w.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.logoUrl} alt="" className="h-5 w-5 shrink-0 rounded border border-border object-cover" />
              ) : (
                <span className="grid h-5 w-5 place-items-center rounded bg-surface-muted text-[9px] font-bold">
                  {w.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === workspace.id && <Check size={14} className="text-primary" />}
            </Link>
          ))}
          <div className="my-1 border-t border-border" />
          <Link
            href="/onboarding?new=1"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            <Plus size={14} /> {t("nav.newWorkspace")}
          </Link>
        </div>
      )}
    </div>
  );
}

export function NewProjectButton({
  workspaceSlug,
  compact,
  label,
}: {
  workspaceSlug: string;
  compact?: boolean;
  label?: string;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("projects.new")}
          className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
        >
          <Plus size={15} />
        </button>
      ) : (
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus size={15} weight="bold" /> {label ?? t("projects.new")}
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("projects.new")}
        description={t("projects.subtitle")}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              loading={pending}
              onClick={() => {
                const form = document.getElementById("new-project-form") as HTMLFormElement | null;
                if (!form) return;
                const fd = new FormData(form);
                fd.set("color", color);
                startTransition(async () => {
                  const res = await createProject(workspaceSlug, fd);
                  if (!res.ok) {
                    toast(res.error ?? t("common.error"), "error");
                    return;
                  }
                  toast(t("toast.saved"));
                  setOpen(false);
                  router.push(`/w/${workspaceSlug}/p/${res.id}/list`);
                });
              }}
            >
              {t("common.create")}
            </Button>
          </>
        }
      >
        <form id="new-project-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <Field label={t("projects.name")}>
            <Input name="name" required placeholder="Redesign Website Klien" autoFocus />
          </Field>
          <Field label={t("projects.description")}>
            <Textarea name="description" rows={2} placeholder={t("common.optional")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("projects.startDate")}>
              <Input name="startDate" type="date" />
            </Field>
            <Field label={t("projects.dueDate")}>
              <Input name="dueDate" type="date" />
            </Field>
          </div>
          <Field label={t("projects.privacy")}>
            <Select name="privacy" defaultValue="PUBLIC">
              <option value="PUBLIC">{t("projects.public")}</option>
              <option value="PRIVATE">{t("projects.private")}</option>
            </Select>
          </Field>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">{t("projects.color")}</p>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 cursor-pointer rounded-full ring-offset-2 ring-offset-surface transition",
                    color === c ? "ring-2 ring-foreground" : "hover:scale-110",
                  )}
                  style={{ background: c }}
                  aria-label={c}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
