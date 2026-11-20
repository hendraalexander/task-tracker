import { parseFilters, getProjectTasks, loadProjectMeta } from "@/lib/views";
import { requireProject } from "@/lib/access";
import { FiltersBar } from "@/components/views/filters-bar";
import { BoardView } from "@/components/views/board-view";

export default async function BoardPage({
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

  const [meta, tasks] = await Promise.all([loadProjectMeta(ctx), getProjectTasks(projectId, filters)]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-3 sm:px-6">
      <div className="mb-2.5">
        <FiltersBar meta={meta} filters={filters} />
      </div>
      <BoardView meta={meta} tasks={tasks} filters={filters} />
    </div>
  );
}
