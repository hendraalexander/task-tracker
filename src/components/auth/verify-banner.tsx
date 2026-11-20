"use client";

import { useState, useTransition } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/primitives";
import { resendVerificationAction } from "@/actions/auth";
import { useT } from "@/components/providers";

export function VerifyEmailBanner({ locale }: { locale: "id" | "en" }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | undefined>();

  return (
    <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
      <div className="flex items-start gap-2">
        <EnvelopeSimple size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          {locale === "id"
            ? "Email belum terverifikasi. Anda bisa lanjut, tetapi mengundang anggota baru aktif setelah verifikasi."
            : "Email is not verified yet. You can continue, but inviting members requires verification."}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await resendVerificationAction();
              setLink(res.devLink);
            })
          }
        >
          {link ? t("common.saved") : locale === "id" ? "Kirim tautan" : "Send link"}
        </Button>
      </div>
      {link && (
        <a href={link} className="mt-2 block break-all rounded bg-white/60 p-1.5 font-mono text-[10px] underline dark:bg-black/20">
          {link}
        </a>
      )}
    </div>
  );
}
