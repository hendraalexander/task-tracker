import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/access";
import { getTimelineTasks, loadProjectMeta } from "@/lib/views";
import { TimelineView } from "@/components/views/timeline-view";

export default async function TimelinePage({ params }: { params: Promise<{ slug: string; projectId: string }> }) {
  const { slug, projectId } = await params;
  const ctx = await requireProject(slug, projectId);

  const [meta, tasks, deps] = await Promise.all([
    loadProjectMeta(ctx),
    getTimelineTasks(projectId),
    prisma.taskDependency.findMany({
      where: { task: { projectId, deletedAt: null }, blockedByTask: { projectId, deletedAt: null } },
      select: { taskId: true, blockedByTaskId: true },
    }),
  ]);

  return (
    <TimelineView
      meta={meta}
      tasks={tasks}
      deps={deps}
      canTimeline={ctx.limits.timeline}
      milestones={meta.milestones}
    />
  );
}
