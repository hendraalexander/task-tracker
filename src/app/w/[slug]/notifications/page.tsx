import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/access";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { NotificationsList } from "@/components/notifications/notifications-list";

export default async function NotificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const t = makeT(normalizeLocale(ctx.user.locale));

  const notifications = await prisma.notification.findMany({
    where: { userId: ctx.user.id, workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-[-0.02em]">
        {t("notif.title")}
        {unread > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>}
      </h1>
      <div className="mt-4">
        <NotificationsList
          items={notifications.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            url: n.url,
            read: !!n.readAt,
            createdAt: n.createdAt.toISOString(),
          }))}
          locale={normalizeLocale(ctx.user.locale)}
        />
      </div>
    </div>
  );
}
