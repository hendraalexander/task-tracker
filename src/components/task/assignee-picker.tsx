"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check, MagnifyingGlass, UserCircle, UserPlus } from "@phosphor-icons/react";
import { Avatar, Input } from "@/components/ui/primitives";
import { useT } from "@/components/providers";
import { cn } from "@/lib/utils";
import type { MemberDTO } from "@/lib/task-types";

/**
 * Multi-select assignee picker.
 * The dropdown renders in a portal with fixed positioning so it never gets
 * clipped by drawer/table overflow containers.
 */
export function AssigneePicker({
  members,
  value,
  onChange,
  disabled,
  compact,
  size = 20,
  ariaLabel,
  className,
  align = "start",
}: {
  members: MemberDTO[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  compact?: boolean;
  size?: number;
  ariaLabel?: string;
  className?: string;
  align?: "start" | "end";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 288 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const selected = members.filter((m) => value.includes(m.id));
  const filtered = members.filter(
    (m) =>
      !query.trim() ||
      m.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      m.email.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const position = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom;
    const openUp = below < 320 && rect.top > below;
    let left = align === "end" ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setPos({
      left,
      width,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    position();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => position();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, position]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel ?? t("task.assignee")}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={selected.length ? selected.map((m) => m.name).join(", ") : t("common.unassigned")}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-1 rounded-lg border border-border bg-surface text-left transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60",
          compact ? "h-7 px-1" : "h-9 px-2",
          open && "border-primary ring-2 ring-primary/15",
        )}
      >
        {selected.length === 0 ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 px-0.5 text-[12px] text-muted-foreground">
            {compact ? <UserPlus size={14} className="mx-auto" /> : <><UserCircle size={15} /><span className="truncate">{t("common.unassigned")}</span></>}
          </span>
        ) : (
          <span className={cn("flex min-w-0 flex-1 items-center", compact ? "justify-center" : "gap-1.5")}>
            <span className="flex items-center -space-x-1.5">
              {selected.slice(0, compact ? 3 : 4).map((member) => (
                <Avatar key={member.id} name={member.name} src={member.avatarUrl} size={size} ring />
              ))}
              {selected.length > (compact ? 3 : 4) && (
                <span
                  className="grid place-items-center rounded-full bg-surface-muted text-[9px] font-semibold ring-2 ring-surface"
                  style={{ width: size, height: size }}
                >
                  +{selected.length - (compact ? 3 : 4)}
                </span>
              )}
            </span>
            {!compact && (
              <span className="min-w-0 flex-1 truncate pl-1 text-[12px] text-foreground">
                {selected.map((m) => m.name.split(" ")[0]).join(", ")}
              </span>
            )}
          </span>
        )}
        {!compact && <CaretDown size={12} className="ml-auto shrink-0 text-muted-foreground" />}
      </button>

      {mounted && open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
            className="animate-pop z-[95] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-slate-900/10"
            data-assignee-popover="true"
            role="listbox"
            aria-multiselectable="true"
          >
            <div className="relative border-b border-border p-2">
              <MagnifyingGlass size={13} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search")}
                className="h-8 pl-8 text-[12px]"
                aria-label={t("common.search")}
                autoFocus
              />
            </div>
            <div className="max-h-[248px] overflow-y-auto p-1.5">
              {filtered.map((member) => {
                const on = value.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(member.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition",
                      on ? "bg-primary-soft/70" : "hover:bg-surface-muted",
                    )}
                  >
                    <Avatar name={member.name} src={member.avatarUrl} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">{member.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{member.role}</span>
                    </span>
                    <span
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded border transition",
                        on ? "border-primary bg-primary text-white" : "border-border-strong text-transparent",
                      )}
                    >
                      <Check size={10} weight="bold" />
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">{t("common.empty")}</p>}
            </div>
            <div className="flex items-center justify-between border-t border-border px-2.5 py-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="cursor-pointer text-[10.5px] font-medium text-muted-foreground transition hover:text-foreground"
              >
                {t("common.reset")}
              </button>
              <span className="text-[10px] text-muted-foreground">
                {selected.length} {t("projects.members").toLowerCase()}
              </span>
              <button type="button" onClick={() => setOpen(false)} className="cursor-pointer text-[10.5px] font-semibold text-primary">
                {t("common.close")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
