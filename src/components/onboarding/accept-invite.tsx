"use client";

import { useTransition } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/primitives";
import { acceptInvitation } from "@/actions/member";
import { useToast } from "@/components/providers";
import { useT } from "@/components/providers";

export function AcceptInviteButton({ token, label }: { token: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const t = useT();
  return (
    <Button
      size="lg"
      className="w-full"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await acceptInvitation(token);
          if (res && !res.ok) toast(res.error ?? t("common.error"), "error");
        })
      }
    >
      {label}
      {!pending && <ArrowRight size={16} weight="bold" />}
    </Button>
  );
}
