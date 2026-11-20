"use client";

import Link from "next/link";
import { Button } from "@/components/ui/primitives";
import { WarningCircle } from "@phosphor-icons/react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-destructive-soft text-destructive">
        <WarningCircle size={24} />
      </span>
      <h1 className="mt-4 text-lg font-bold">Terjadi kesalahan</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Permintaan tidak dapat diproses. Coba lagi; jika berulang, hubungi Admin workspace.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Button onClick={reset} size="sm">
          Coba lagi
        </Button>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Kembali
        </Link>
      </div>
    </div>
  );
}
