import { prisma } from "@/lib/db";
import { countGuests, countProjects, countSeats, requireWorkspaceAdmin } from "@/lib/access";
import { normalizeLocale } from "@/lib/i18n";
import { BillingClient } from "@/components/settings/billing-client";

export default async function BillingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceAdmin(slug);

  const [subscription, seats, projects, guests, storage, invoices] = await Promise.all([
    prisma.subscription.findUnique({ where: { workspaceId: ctx.workspace.id } }),
    countSeats(ctx.workspace.id),
    countProjects(ctx.workspace.id),
    countGuests(ctx.workspace.id),
    prisma.attachment.aggregate({
      where: { task: { project: { workspaceId: ctx.workspace.id } } },
      _sum: { size: true },
    }),
    prisma.invoice.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return (
    <BillingClient
      workspaceSlug={slug}
      plan={ctx.workspace.plan}
      status={ctx.workspace.readOnly ? "READ_ONLY" : (subscription?.status ?? "ACTIVE")}
      seats={seats}
      usage={{ members: seats, projects, guests, storageMb: (storage._sum.size ?? 0) / 1024 / 1024 }}
      invoices={invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        amountCents: invoice.amountCents,
        currency: invoice.currency,
        status: invoice.status,
        periodStart: invoice.periodStart.toISOString(),
        periodEnd: invoice.periodEnd.toISOString(),
      }))}
      locale={normalizeLocale(ctx.user.locale)}
    />
  );
}
