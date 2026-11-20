import Link from "next/link";
import { CheckSquare, FolderSimple, User as UserIcon, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { requireWorkspace } from "@/lib/access";
import { searchAll } from "@/actions/search";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { Card, EmptyState } from "@/components/ui/primitives";
import { SearchBox } from "@/components/search/search-box";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const ctx = await requireWorkspace(slug);
  const t = makeT(normalizeLocale(ctx.user.locale));

  const all = q ? await searchAll(q) : [];
  const results = all.filter((item) => item.workspaceSlug === slug);

  const groups = [
    { type: "task" as const, label: t("search.tasks"), icon: <CheckSquare size={14} />, items: results.filter((r) => r.type === "task") },
    { type: "project" as const, label: t("search.projects"), icon: <FolderSimple size={14} />, items: results.filter((r) => r.type === "project") },
    { type: "person" as const, label: t("search.people"), icon: <UserIcon size={14} />, items: results.filter((r) => r.type === "person") },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <h1 className="text-[20px] font-bold tracking-[-0.02em]">{t("search.title")}</h1>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{t("search.hint")}</p>

      <div className="mt-4">
        <SearchBox initial={q ?? ""} />
      </div>

      {!q ? (
        <Card className="mt-5">
          <EmptyState icon={<MagnifyingGlass size={22} />} title={t("search.title")} description={t("search.hint")} />
        </Card>
      ) : results.length === 0 ? (
        <Card className="mt-5">
          <EmptyState icon={<MagnifyingGlass size={22} />} title={t("empty.searchTitle")} description={t("empty.searchBody")} />
        </Card>
      ) : (
        <div className="mt-5 space-y-4">
          <p className="text-[12px] text-muted-foreground">
            {results.length} {t("search.title").toLowerCase()}
          </p>
          {groups.map((group) => (
            <Card key={group.type} className="overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.icon}
                {group.label}
                <span className="ml-auto rounded bg-surface px-1.5 text-[10px]">{group.items.length}</span>
              </div>
              {group.items.map((item) => (
                <Link key={`${item.type}-${item.id}`} href={item.href} className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-[13px] transition last:border-0 hover:bg-surface-muted/50">
                  <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                  {item.subtitle && <span className="max-w-[40%] truncate text-[11px] text-muted-foreground">{item.subtitle}</span>}
                </Link>
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
