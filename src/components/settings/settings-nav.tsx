"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/providers";
import { cn } from "@/lib/utils";

export function SettingsNav({ workspaceSlug, admin }: { workspaceSlug: string; admin: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}/settings`;
  const items = [
    ...(admin ? [{ href: `${base}/members`, label: t("nav.members") }] : []),
    ...(admin ? [{ href: `${base}/billing`, label: t("nav.billing") }] : []),
    { href: `${base}/profile`, label: t("nav.profile") },
    ...(admin ? [{ href: `${base}/tags`, label: t("nav.tags") }] : []),
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "whitespace-nowrap border-b-2 px-3 py-2 text-[12.5px] font-medium transition",
            pathname === item.href || pathname.startsWith(`${item.href}/`)
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
