"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { countGuests, countProjects, countSeats, isReadOnly, logAudit, requireWorkspaceAdmin } from "@/lib/access";
import { makeT, normalizeLocale } from "@/lib/i18n";
import { notifyUsers } from "@/lib/notify";
import type { ActionResult } from "@/actions/project";

const PRICE: Record<string, number> = { PRO: 800, BUSINESS: 1600 };

/**
 * Plan changes.
 *
 * Production wiring: create a Stripe Checkout Session here and redirect, then
 * let the webhook update `Subscription`. Without STRIPE_SECRET_KEY the change is
 * applied locally so the whole flow stays testable (demo mode).
 */
export async function changePlan(workspaceSlug: string, plan: string): Promise<ActionResult> {
  const ctx = await requireWorkspaceAdmin(workspaceSlug);
  const t = makeT(normalizeLocale(ctx.user.locale));
  if (!["FREE", "PRO", "BUSINESS"].includes(plan)) return { ok: false, error: t("common.error") };
  if (plan === ctx.workspace.plan) return { ok: true };

  const [seats, projects, guests] = await Promise.all([
    countSeats(ctx.workspace.id),
    countProjects(ctx.workspace.id),
    countGuests(ctx.workspace.id),
  ]);

  const overFree = plan === "FREE" && (seats > 10 || projects > 3 || guests > 0);
  const overGuestLimit = plan === "PRO" && guests > 20;

  const subscription = await prisma.subscription.findUnique({ where: { workspaceId: ctx.workspace.id } });
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await prisma.$transaction([
    prisma.workspace.update({
      where: { id: ctx.workspace.id },
      data: { plan: plan as never, readOnly: overFree },
    }),
    prisma.subscription.upsert({
      where: { workspaceId: ctx.workspace.id },
      create: {
        workspaceId: ctx.workspace.id,
        plan: plan as never,
        status: overFree ? "READ_ONLY" : "ACTIVE",
        seats,
        periodStart: now,
        periodEnd: plan === "FREE" ? null : periodEnd,
      },
      update: {
        plan: plan as never,
        status: overFree ? "READ_ONLY" : "ACTIVE",
        seats,
        periodStart: now,
        periodEnd: plan === "FREE" ? null : periodEnd,
        cancelAtPeriodEnd: false,
      },
    }),
    ...(PRICE[plan]
      ? [
          prisma.invoice.create({
            data: {
              workspaceId: ctx.workspace.id,
              number: `INV-${now.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
              amountCents: PRICE[plan] * seats,
              status: "paid",
              periodStart: now,
              periodEnd,
            },
          }),
        ]
      : []),
  ]);

  await logAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.user.id,
    action: "plan_changed",
    targetType: "subscription",
    targetId: subscription?.id ?? ctx.workspace.id,
    metadata: { from: ctx.workspace.plan, to: plan, seats, overFree, overGuestLimit },
  });

  await notifyUsers({
    userIds: (await prisma.membership.findMany({
      where: { workspaceId: ctx.workspace.id, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
      select: { userId: true },
    })).map((m) => m.userId),
    workspaceId: ctx.workspace.id,
    type: "BILLING",
    title: `Plan changed to ${plan}`,
    body: overFree
      ? "Usage exceeds Free limits. Workspace is now read-only until you reduce projects/members."
      : `Workspace ${ctx.workspace.name} is now on ${plan}.`,
    url: `/w/${workspaceSlug}/settings/billing`,
  });

  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return {
    ok: true,
    warning: overFree
      ? ctx.user.locale === "en"
        ? "Downgraded. Usage exceeds Free limits, so the workspace is read-only."
        : "Paket diturunkan. Pemakaian melebihi batas Free, workspace kini baca-saja."
      : undefined,
  };
}

export async function startTrial(workspaceSlug: string): Promise<ActionResult> {
  const ctx = await requireWorkspaceAdmin(workspaceSlug);
  if (ctx.workspace.plan !== "FREE") return { ok: false, error: "Not eligible" };
  if (isReadOnly(ctx)) return { ok: false, error: makeT(normalizeLocale(ctx.user.locale))("common.readOnly") };

  const existing = await prisma.subscription.findUnique({ where: { workspaceId: ctx.workspace.id } });
  if (existing?.status === "TRIALING") return { ok: false, error: "Trial already used" };

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 14);
  await prisma.$transaction([
    prisma.workspace.update({ where: { id: ctx.workspace.id }, data: { plan: "PRO" } }),
    prisma.subscription.upsert({
      where: { workspaceId: ctx.workspace.id },
      create: { workspaceId: ctx.workspace.id, plan: "PRO", status: "TRIALING", periodStart: new Date(), periodEnd, seats: await countSeats(ctx.workspace.id) },
      update: { plan: "PRO", status: "TRIALING", periodStart: new Date(), periodEnd, seats: await countSeats(ctx.workspace.id) },
    }),
  ]);
  await logAudit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "trial_started", targetType: "subscription" });
  revalidatePath(`/w/${workspaceSlug}`, "layout");
  return { ok: true };
}
