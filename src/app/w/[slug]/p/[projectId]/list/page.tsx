import { parseFilters, getProjectTasks, loadProjectMeta } from "@/lib/views";
import { requireProject } from "@/lib/access";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { FiltersBar } from "@/components/views/filters-bar";
import { ListView } from "@/components/views/list-view";

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, projectId } = await params;
  const ctx = await requireProject(slug, projectId);
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const t = makeT(normalizeLocale(ctx.user.locale));

  const [meta, tasks] = await Promise.all([loadProjectMeta(ctx), getProjectTasks(projectId, filters)]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground">{tasks.length}</span> {t("projects.tasks")}
        </p>
        <div className="w-full sm:w-auto">
          <FiltersBar meta={meta} filters={filters} />
        </div>
      </div>

      <div className="mt-2.5 overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
        <ListView meta={meta} tasks={tasks} filters={filters} />
      </div>
    </div>
  );
}
