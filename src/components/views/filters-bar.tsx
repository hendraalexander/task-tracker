"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FunnelSimple, MagnifyingGlass, X, ArrowsDownUp, Rows } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Input, Select } from "@/components/ui/primitives";
import { useT } from "@/components/providers";
import type { ProjectMeta, ViewFilters } from "@/lib/task-types";

export function FiltersBar({ meta, filters }: { meta: ProjectMeta; filters: ViewFilters }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(filters.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latestParams = useRef(new URLSearchParams(params.toString()));

  useEffect(() => setQuery(filters.q), [filters.q]);
  useEffect(() => {
    latestParams.current = new URLSearchParams(params.toString());
  }, [params]);

  const update = (mutate: (p: URLSearchParams) => void) => {
    // Build from the ref, not props: two fast interactions must not clobber each other.
    const next = new URLSearchParams(latestParams.current.toString());
    next.delete("task");
    mutate(next);
    latestParams.current = next;
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const set = (key: string, value: string) => {
    update((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
    });
  };

  const toggleStatus = (status: string) => {
    const current = new Set((latestParams.current.get("status") ?? "").split(",").filter(Boolean));
    if (current.has(status)) current.delete(status);
    else current.add(status);
    set("status", [...current].join(","));
  };

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (query !== filters.q) set("q", query);
    }, 300);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const activeCount =
    filters.status.length +
    (filters.assignee ? 1 : 0) +
    (filters.priority ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (filters.due ? 1 : 0) +
    Object.keys(filters.fields).length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="relative min-w-[160px] flex-1 sm:max-w-[260px]">
        <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.search")}
          className="h-8 pl-8 text-[12.5px]"
          aria-label={t("common.search")}
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground" aria-label={t("common.reset")}>
            <X size={12} />
          </button>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition",
            activeCount > 0 ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground",
          )}
        >
          <FunnelSimple size={14} />
          {t("common.filters")}
          {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{activeCount}</span>}
        </button>

        {filtersOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setFiltersOpen(false)} aria-hidden />
            <div className="animate-pop absolute left-0 top-[calc(100%+4px)] z-40 w-[280px] rounded-xl border border-border bg-surface p-3 shadow-xl">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("view.filterStatus")}</p>
              <div className="mb-3 grid grid-cols-2 gap-1">
                {(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const).map((status) => (
                  <label key={status} className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-[12px] hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={() => toggleStatus(status)}
                      className="h-3.5 w-3.5 accent-[var(--primary)]"
                    />
                    {t(`status.${status}` as never)}
                  </label>
                ))}
              </div>

              <div className="space-y-2 border-t border-border pt-2">
                <Select value={filters.assignee} onChange={(e) => set("assignee", e.target.value)} className="h-8 text-[12px]" aria-label={t("view.filterAssignee")}>
                  <option value="">{t("view.filterAssignee")}: {t("common.all")}</option>
                  <option value="none">{t("common.unassigned")}</option>
                  {meta.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
                <Select value={filters.priority} onChange={(e) => set("priority", e.target.value)} className="h-8 text-[12px]" aria-label={t("view.filterPriority")}>
                  <option value="">{t("view.filterPriority")}: {t("common.all")}</option>
                  {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                    <option key={p} value={p}>
                      {t(`priority.${p}` as never)}
                    </option>
                  ))}
                </Select>
                <Select value={filters.due} onChange={(e) => set("due", e.target.value)} className="h-8 text-[12px]" aria-label={t("view.filterDue")}>
                  <option value="">{t("view.filterDue")}: {t("common.all")}</option>
                  <option value="overdue">{t("view.dueOverdue")}</option>
                  <option value="today">{t("view.dueToday")}</option>
                  <option value="week">{t("view.dueWeek")}</option>
                  <option value="none">{t("view.dueNone")}</option>
                </Select>
                <Select value={filters.tag} onChange={(e) => set("tag", e.target.value)} className="h-8 text-[12px]" aria-label={t("view.filterTag")}>
                  <option value="">{t("view.filterTag")}: {t("common.all")}</option>
                  {meta.tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </Select>
                {meta.fields.length > 0 && (
                  <div className="space-y-1.5 border-t border-border pt-2">
                    {meta.fields.map((field) => (
                      <Select
                        key={field.id}
                        value={filters.fields[field.id] ?? ""}
                        onChange={(e) => {
                          update((p) => {
                            if (e.target.value) p.set(`f_${field.id}`, e.target.value);
                            else p.delete(`f_${field.id}`);
                          });
                        }}
                        className="h-8 text-[12px]"
                        aria-label={field.name}
                      >
                        <option value="">{field.name}: {t("common.all")}</option>
                        {field.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() =>
                    update((p) => {
                      for (const key of [...p.keys()]) {
                        if (key !== "group" && key !== "sort") p.delete(key);
                      }
                    })
                  }
                  className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {t("common.reset")}
                </button>
                <button type="button" onClick={() => setFiltersOpen(false)} className="cursor-pointer text-[11px] font-semibold text-primary">
                  {t("common.close")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface px-1.5">
          <ArrowsDownUp size={12} className="text-muted-foreground" />
          <Select value={filters.sort} onChange={(e) => set("sort", e.target.value)} className="h-6 border-0 bg-transparent px-1 pl-0 pr-6 text-[11.5px] shadow-none" aria-label={t("common.sort")}>
            <option value="due">{t("view.sortDue")}</option>
            <option value="priority">{t("view.sortPriority")}</option>
            <option value="status">{t("view.sortStatus")}</option>
            <option value="created">{t("view.sortCreated")}</option>
            <option value="alpha">{t("view.sortAlpha")}</option>
          </Select>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface px-1.5">
          <Rows size={12} className="text-muted-foreground" />
          <Select value={filters.group} onChange={(e) => set("group", e.target.value)} className="h-6 border-0 bg-transparent px-1 pl-0 pr-6 text-[11.5px] shadow-none" aria-label={t("common.group")}>
            <option value="status">{t("view.groupStatus")}</option>
            <option value="assignee">{t("view.groupAssignee")}</option>
            <option value="priority">{t("view.groupPriority")}</option>
            <option value="none">{t("view.groupNone")}</option>
          </Select>
        </div>
      </div>
    </div>
  );
}
