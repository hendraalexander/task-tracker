"use client";

import { Printer } from "@phosphor-icons/react";
import { Button } from "@/components/ui/primitives";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      <Printer size={14} /> {label}
    </Button>
  );
}
