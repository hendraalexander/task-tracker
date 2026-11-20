"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListBullets, Kanban, CalendarBlank, ChartBar, ChartLineUp, GearSix } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/providers";

export function ProjectTabs({
  workspaceSlug,
  projectId,
  canManage,
}: {
  workspaceSlug: string;
  projectId: string;
  canManage: boolean;
}) {
  const t = useT();
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}/p/${projectId}`;
  const tabs = [
    { key: "list", href: `${base}/list`, label: t("view.list"), icon: <ListBullets size={14} /> },
    { key: "board", href: `${base}/board`, label: t("view.board"), icon: <Kanban size={14} /> },
    { key: "calendar", href: `${base}/calendar`, label: t("view.calendar"), icon: <CalendarBlank size={14} /> },
    { key: "timeline", href: `${base}/timeline`, label: t("view.timeline"), icon: <ChartLineUp size={14} /> },
    { key: "dashboard", href: `${base}/dashboard`, label: t("view.dashboard"), icon: <ChartBar size={14} /> },
  ];

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition",
              active ? "bg-surface-muted text-foreground" : "text-muted-foreground hover:bg-surface-muted/60 hover:text-foreground",
            )}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
      {canManage && (
        <Link
          href={`${base}/settings`}
          className={cn(
            "ml-0.5 flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition",
            pathname.startsWith(`${base}/settings`) ? "bg-surface-muted text-foreground" : "text-muted-foreground hover:bg-surface-muted/60 hover:text-foreground",
          )}
        >
          <GearSix size={14} />
          {t("nav.settings")}
        </Link>
      )}
    </div>
  );
}
