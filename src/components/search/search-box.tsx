"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/primitives";
import { useT } from "@/components/providers";

export function SearchBox({ initial }: { initial: string }) {
  const t = useT();
  const router = useRouter();
  const [value, setValue] = useState(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`?q=${encodeURIComponent(value.trim())}`);
      }}
      className="relative"
    >
      <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("search.placeholder")}
        className="h-10 pl-9"
        autoFocus
        aria-label={t("search.title")}
      />
    </form>
  );
}
