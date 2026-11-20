import { prisma } from "@/lib/db";
import { requireWorkspaceAdmin } from "@/lib/access";
import { TagsAdmin } from "@/components/settings/tags-admin";

export default async function TagsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceAdmin(slug);

  const tags = await prisma.tag.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: { _count: { select: { tasks: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <TagsAdmin
      workspaceSlug={slug}
      tags={tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color, count: tag._count.tasks }))}
    />
  );
}
