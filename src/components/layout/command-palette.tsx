"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, ArrowRight, Folder, CheckSquare, User as UserIcon, SpinnerGap } from "@phosphor-icons/react";
import { searchAll, type SearchResult } from "@/actions/search";
import { Modal } from "@/components/ui/modal";
import { Kbd } from "@/components/ui/primitives";
import { useT } from "@/components/providers";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onClose: () => void; workspaceSlug: string };

export function CommandPalette({ open, onClose, workspaceSlug }: Props) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(() => {
      startTransition(async () => {
        const found = await searchAll(query);
        setResults(found.filter((item) => item.workspaceSlug === workspaceSlug));
        setActive(0);
      });
    }, 180);
    return () => window.clearTimeout(timer.current);
  }, [query, workspaceSlug]);

  const grouped = useMemo(() => {
    const order: SearchResult["type"][] = ["task", "project", "person"];
    return order
      .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
      .filter((g) => g.items.length > 0);
  }, [results]);

  const flat = grouped.flatMap((g) => g.items);

  const go = (result?: SearchResult) => {
    const target = result ?? flat[active];
    if (!target) return;
    onClose();
    router.push(target.href);
  };

  const icons = {
    task: <CheckSquare size={15} />,
    project: <Folder size={15} />,
    person: <UserIcon size={15} />,
  };

  return (
    <Modal open={open} onClose={onClose} title={t("search.title")} size="lg">
      <div className="-mx-5 -mt-4">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <MagnifyingGlass size={17} className="text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(flat.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go();
              }
            }}
            placeholder={t("search.placeholder")}
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />
          {pending && <SpinnerGap size={16} className="animate-spin text-muted-foreground" />}
          <Kbd>Esc</Kbd>
        </div>

        <div className="max-h-[52vh] min-h-[132px] overflow-y-auto p-2">
          {!query.trim() && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("search.hint")}</p>
          )}
          {query.trim() && !pending && flat.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("search.noResults")}</p>
          )}
          {grouped.map((group) => (
            <div key={group.type} className="mb-1">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.type === "task" ? t("search.tasks") : group.type === "project" ? t("search.projects") : t("search.people")}
              </div>
              {group.items.map((item) => {
                const index = flat.indexOf(item);
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
                      index === active ? "bg-primary-soft text-foreground" : "hover:bg-surface-muted",
                    )}
                  >
                    <span className="text-muted-foreground">{icons[item.type]}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                    {item.subtitle && <span className="max-w-[40%] truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                    <ArrowRight size={13} className="text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigasi</span>
          <span className="flex items-center gap-1"><Kbd>Enter</Kbd> buka</span>
          <span className="ml-auto">{t("search.hint")}</span>
        </div>
      </div>
    </Modal>
  );
}
