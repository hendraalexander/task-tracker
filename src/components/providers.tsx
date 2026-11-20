"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle, WarningCircle, Info, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { DEFAULT_LOCALE, makeT, normalizeLocale, type Locale } from "@/lib/i18n";

/* ------------------------------ locale ------------------------------ */

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

export function LocaleProvider({ initial, children }: { initial: string; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(normalizeLocale(initial));
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `at_locale=${l}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  const { locale } = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}

/* ------------------------------ theme ------------------------------ */

export function ThemeSync() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const pref = root.dataset.themePref ?? "system";
      const dark = pref === "dark" || (pref === "system" && media.matches);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme-pref"] });
    media.addEventListener("change", apply);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", apply);
    };
  }, []);
  return null;
}

/* ------------------------------ toast ------------------------------ */

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };
const ToastContext = createContext<{ toast: (message: string, kind?: ToastKind) => void }>({
  toast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const icons = {
    success: <CheckCircle size={18} weight="fill" className="text-emerald-500" />,
    error: <WarningCircle size={18} weight="fill" className="text-red-500" />,
    info: <Info size={18} weight="fill" className="text-blue-500" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 text-sm shadow-lg shadow-slate-900/5",
            )}
          >
            <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="rounded-md p-0.5 text-muted-foreground hover:bg-surface-muted"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ------------------------------ copy ------------------------------ */

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-surface-muted"
      title={label}
    >
      {copied ? t("common.copied") : label}
    </button>
  );
}
