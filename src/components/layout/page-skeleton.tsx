export function PageSkeleton({
  rows = 6,
  cards = 3,
  variant = "list",
}: {
  rows?: number;
  cards?: number;
  variant?: "list" | "cards" | "form" | "board";
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat…</span>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded-md bg-surface-muted" />
          <div className="h-3 w-64 animate-pulse rounded bg-surface-muted/70" />
        </div>
        <div className="h-8 w-28 animate-pulse rounded-lg bg-surface-muted" />
      </div>

      {variant === "cards" && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: Math.max(cards, 3) }).map((_, i) => (
            <div key={i} className="h-[172px] animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      )}

      {variant === "form" && (
        <div className="mt-5 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      )}

      {variant === "board" && (
        <div className="mt-4 flex gap-2.5 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[286px] shrink-0 space-y-2 rounded-xl border border-border bg-surface p-2">
              <div className="h-6 w-28 animate-pulse rounded bg-surface-muted" />
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className="h-20 animate-pulse rounded-lg bg-surface-muted/80" />
              ))}
            </div>
          ))}
        </div>
      )}

      {(variant === "list" || variant === "form") && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="h-8 animate-pulse border-b border-border bg-surface-muted/60" />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-0">
              <div className="h-4 w-4 animate-pulse rounded-full bg-surface-muted" />
              <div className="h-3.5 animate-pulse rounded bg-surface-muted" style={{ width: `${28 + ((i * 13) % 34)}%` }} />
              <div className="ml-auto h-5 w-16 animate-pulse rounded bg-surface-muted/70" />
              <div className="h-5 w-5 animate-pulse rounded-full bg-surface-muted/70" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
