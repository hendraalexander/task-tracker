"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Crown, DownloadSimple, Lightning, Sparkle, UsersThree, FolderSimple, HardDrive, UserPlus } from "@phosphor-icons/react";
import { Badge, Button, Card, Progress } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { useT, useToast } from "@/components/providers";
import { changePlan, startTrial } from "@/actions/billing";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PlanKey = "FREE" | "PRO" | "BUSINESS";

export function BillingClient({
  workspaceSlug,
  plan,
  status,
  seats,
  usage,
  invoices,
  locale,
}: {
  workspaceSlug: string;
  plan: string;
  status: string;
  seats: number;
  usage: { members: number; projects: number; guests: number; storageMb: number };
  invoices: { id: string; number: string; amountCents: number; currency: string; status: string; periodStart: string; periodEnd: string }[];
  locale: Locale;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<PlanKey | null>(null);

  const plans: {
    key: PlanKey;
    name: string;
    price: number;
    tagline: string;
    features: string[];
    icon: React.ReactNode;
  }[] = [
    {
      key: "FREE",
      name: t("billing.free"),
      price: 0,
      tagline: locale === "id" ? "Untuk mencoba dengan tim kecil" : "Try it with a small team",
      features:
        locale === "id"
          ? ["10 anggota", "3 project", "List, Board, Calendar", "Tag", "Riwayat 30 hari", "2 GB"]
          : ["10 members", "3 projects", "List, Board, Calendar", "Tags", "30-day history", "2 GB"],
      icon: <UsersThree size={16} />,
    },
    {
      key: "PRO",
      name: t("billing.pro"),
      price: 8,
      tagline: locale === "id" ? "Untuk tim yang sedang tumbuh" : "For growing teams",
      features:
        locale === "id"
          ? ["Anggota tak terbatas", "Project tak terbatas", "Timeline & dependency", "Custom field", "Guest 20", "Riwayat 1 tahun", "100 GB"]
          : ["Unlimited members", "Unlimited projects", "Timeline & dependencies", "Custom fields", "20 guests", "1-year history", "100 GB"],
      icon: <Lightning size={16} />,
    },
    {
      key: "BUSINESS",
      name: t("billing.business"),
      price: 16,
      tagline: locale === "id" ? "Untuk operasi multi-tim" : "For multi-team operations",
      features:
        locale === "id"
          ? ["Semua fitur Pro", "Guest 50", "Riwayat tak terbatas", "500 GB", "Dukungan prioritas"]
          : ["Everything in Pro", "50 guests", "Unlimited history", "500 GB", "Priority support"],
      icon: <Crown size={16} />,
    },
  ];

  const planOrder: PlanKey[] = ["FREE", "PRO", "BUSINESS"];
  const currentIndex = planOrder.indexOf(plan as PlanKey);

  const choose = (next: PlanKey) => {
    if (next === plan) return;
    if (planOrder.indexOf(next) < currentIndex) {
      setConfirm(next);
      return;
    }
    startTransition(async () => {
      const res = await changePlan(workspaceSlug, next);
      if (!res.ok) toast(res.error ?? t("common.error"), "error");
      else {
        toast(res.warning ?? t("common.saved"), res.warning ? "info" : "success");
        router.refresh();
      }
    });
  };

  const storageLimit = plan === "BUSINESS" ? 500 * 1024 : plan === "PRO" ? 100 * 1024 : 2 * 1024;

  return (
    <div className="space-y-4">
      {status === "READ_ONLY" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {t("billing.readOnlyBanner")}
        </div>
      )}

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
          <Sparkle size={20} weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("billing.current")}</p>
          <p className="flex items-center gap-2 text-[18px] font-bold leading-tight">
            {t(`billing.${plan.toLowerCase()}` as never)}
            <Badge tone={status === "TRIALING" ? "primary" : status === "READ_ONLY" ? "danger" : "success"}>
              {status === "TRIALING" ? t("billing.trial") : status === "READ_ONLY" ? "read-only" : status}
            </Badge>
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {seats} {t("billing.seats").toLowerCase()} · ${plan === "BUSINESS" ? 16 : plan === "PRO" ? 8 : 0} {t("billing.perSeat")}
          </p>
        </div>
        {plan === "FREE" && (
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await startTrial(workspaceSlug);
                if (!res.ok) toast(res.error ?? t("common.error"), "error");
                else {
                  toast(t("billing.trial"));
                  router.refresh();
                }
              })
            }
          >
            <Lightning size={14} /> {t("billing.startTrial")}
          </Button>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((item) => {
          const active = item.key === plan;
          const isUpgrade = planOrder.indexOf(item.key) > currentIndex;
          return (
            <Card
              key={item.key}
              className={cn("relative flex flex-col p-4", active && "border-primary ring-1 ring-primary/20")}
            >
              {item.key === "PRO" && !active && (
                <span className="absolute -top-2 left-4 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Popular
                </span>
              )}
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <span className="text-primary">{item.icon}</span>
                {item.name}
                {active && <Badge tone="primary" className="ml-auto">Current</Badge>}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.tagline}</p>
              <p className="mt-3 text-[22px] font-bold leading-none">
                ${item.price}
                <span className="text-[11px] font-normal text-muted-foreground">{t("billing.perSeat")}</span>
              </p>
              <ul className="mt-3 flex-1 space-y-1.5">
                {item.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                    <Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant={active ? "secondary" : isUpgrade ? "primary" : "outline"}
                size="sm"
                className="mt-4 w-full"
                disabled={active || pending}
                onClick={() => choose(item.key)}
              >
                {active ? t("billing.current") : isUpgrade ? t("billing.upgrade") : t("billing.downgrade")}
              </Button>
            </Card>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">{t("billing.mockNote")}</p>

      <Card className="p-5">
        <h3 className="mb-3 text-[13px] font-semibold">{t("billing.usage")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: <UsersThree size={14} />, label: t("billing.seats"), value: usage.members, max: plan === "FREE" ? 10 : 100, display: String(usage.members) },
            { icon: <FolderSimple size={14} />, label: t("nav.projects"), value: usage.projects, max: plan === "FREE" ? 3 : 100, display: String(usage.projects) },
            { icon: <UserPlus size={14} />, label: "Guest", value: usage.guests, max: plan === "FREE" ? 1 : plan === "PRO" ? 20 : 50, display: String(usage.guests) },
            { icon: <HardDrive size={14} />, label: "Storage", value: usage.storageMb, max: storageLimit, display: `${usage.storageMb.toFixed(1)} MB / ${storageLimit >= 1024 ? `${Math.round(storageLimit / 1024)} GB` : `${storageLimit} MB`}` },
          ].map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-muted-foreground">{item.icon} {item.label}</span>
                <span className="font-medium">{item.display}</span>
              </div>
              <Progress value={Math.min(100, (item.value / Math.max(1, item.max)) * 100)} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-[13px] font-semibold">{t("billing.invoices")}</h3>
        </div>
        {invoices.length === 0 ? (
          <p className="px-5 py-6 text-center text-[12px] text-muted-foreground">{t("common.empty")}</p>
        ) : (
          <div className="divide-y divide-border">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-[12px]">
                <span className="font-medium">{invoice.number}</span>
                <Badge tone={invoice.status === "paid" ? "success" : "warning"}>{invoice.status === "paid" ? t("billing.paid") : invoice.status}</Badge>
                <span className="text-muted-foreground">
                  {formatDate(invoice.periodStart, locale)} – {formatDate(invoice.periodEnd, locale)}
                </span>
                <span className="ml-auto font-semibold">${(invoice.amountCents / 100).toFixed(2)}</span>
                <Link
                  href={`/w/${workspaceSlug}/settings/billing/invoice/${invoice.id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium transition hover:bg-surface-muted"
                >
                  <DownloadSimple size={12} /> {t("billing.invoice")}
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          const next = confirm;
          setConfirm(null);
          startTransition(async () => {
            const res = await changePlan(workspaceSlug, next);
            if (!res.ok) toast(res.error ?? t("common.error"), "error");
            else {
              toast(res.warning ?? t("common.saved"), res.warning ? "info" : "success");
              router.refresh();
            }
          });
        }}
        title={t("billing.downgrade")}
        message={t("billing.downgradeConfirm")}
        confirmLabel={t("common.confirm")}
      />
    </div>
  );
}
