import { parseFilters, getProjectTasks, loadProjectMeta } from "@/lib/views";
import { requireProject } from "@/lib/access";
import { CalendarView } from "@/components/views/calendar-view";

export default async function CalendarPage({
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
  const now = new Date();
  const monthParam = typeof raw.month === "string" && /^\d{4}-\d{2}$/.test(raw.month) ? raw.month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [meta, tasks] = await Promise.all([loadProjectMeta(ctx), getProjectTasks(projectId, filters)]);

  return <CalendarView meta={meta} tasks={tasks} filters={filters} initialMonth={monthParam} />;
}
