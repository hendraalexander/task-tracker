"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { At, ChatCircle, CheckSquare, Clock, Bell, CreditCard, EnvelopeSimple } from "@phosphor-icons/react";
import { Button, Card } from "@/components/ui/primitives";
import { useT, useToast } from "@/components/providers";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/task";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

type Item = { id: string; type: string; title: string; body: string | null; url: string | null; read: boolean; createdAt: string };

export function NotificationsList({ items, locale }: { items: Item[]; locale: Locale }) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const icons: Record<string, React.ReactNode> = {
    ASSIGNMENT: <CheckSquare size={15} />,
    MENTION: <At size={15} />,
    COMMENT: <ChatCircle size={15} />,
    DUE_DATE: <Clock size={15} />,
    INVITATION: <EnvelopeSimple size={15} />,
    BILLING: <CreditCard size={15} />,
  };

  if (items.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Bell size={22} className="text-muted-foreground" />
          <p className="mt-2 text-[13px] text-muted-foreground">{t("notif.empty")}</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button
          variant="ghost"
          size="xs"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              await markAllNotificationsRead();
              toast(t("common.saved"));
              router.refresh();
            })
          }
        >
          {t("notif.markAll")}
        </Button>
      </div>
      <Card className="overflow-hidden">
        {items.map((item) => (
          <div key={item.id} className={cn("flex items-start gap-3 border-b border-border/70 px-4 py-3 last:border-0", !item.read && "bg-primary-soft/30")}>
            <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", item.read ? "bg-surface-muted text-muted-foreground" : "bg-primary-soft text-primary")}>
              {icons[item.type] ?? <Bell size={15} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[13px] leading-snug", !item.read && "font-semibold")}>{item.title}</p>
              {item.body && <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{item.body}</p>}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>{relativeTime(item.createdAt, locale)}</span>
                {item.url && (
                  <Link href={item.url} className="text-[10.5px] font-medium text-primary hover:underline">
                    {t("common.viewAll")}
                  </Link>
                )}
                {!item.read && (
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await markNotificationRead(item.id);
                        router.refresh();
                      })
                    }
                    className="cursor-pointer text-[10.5px] text-muted-foreground hover:text-foreground"
                  >
                    {t("notif.markRead")}
                  </button>
                )}
              </div>
            </div>
            {!item.read && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          </div>
        ))}
      </Card>
    </div>
  );
}
