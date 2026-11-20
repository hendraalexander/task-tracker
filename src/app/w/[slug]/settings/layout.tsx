import type { ReactNode } from "react";
import { requireWorkspace } from "@/lib/access";
import { isAdmin } from "@/lib/access";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const t = makeT(normalizeLocale(ctx.user.locale));

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-5 sm:px-6">
      <h1 className="text-[20px] font-bold tracking-[-0.02em]">{t("nav.settings")}</h1>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{ctx.workspace.name}</p>
      <div className="mt-4">
        <SettingsNav workspaceSlug={slug} admin={isAdmin(ctx.membership.role)} />
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}
