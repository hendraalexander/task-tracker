"use client";

import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn, avatarGradient, initials } from "@/lib/utils";

/* ------------------------------ button ------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "subtle";
type Size = "xs" | "sm" | "md" | "lg" | "icon";

export function buttonStyles(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform] duration-150 cursor-pointer select-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
    "disabled:pointer-events-none disabled:opacity-50",
    {
      primary:
        "bg-primary text-on-primary shadow-sm shadow-blue-600/20 hover:bg-primary-hover active:scale-[0.99]",
      secondary:
        "border border-border bg-surface text-foreground shadow-xs hover:bg-surface-muted active:scale-[0.99]",
      outline:
        "border border-border-strong bg-transparent text-foreground hover:bg-surface-muted",
      ghost: "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
      subtle: "bg-primary-soft text-primary hover:brightness-95 dark:hover:brightness-110",
      danger: "bg-destructive text-white shadow-sm hover:brightness-95 active:scale-[0.99]",
    }[variant],
    {
      xs: "h-7 px-2 text-xs",
      sm: "h-8 px-2.5 text-[13px]",
      md: "h-9 px-3.5 text-sm",
      lg: "h-11 px-5 text-[15px]",
      icon: "h-8 w-8",
    }[size],
    className,
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }
>(function Button({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonStyles(variant, size, className)}
      {...props}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------ fields ------------------------------ */

export const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-xs transition placeholder:text-muted-foreground hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export const textareaClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-xs transition placeholder:text-muted-foreground hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export const selectClass =
  "h-9 w-full appearance-none rounded-lg border border-border bg-surface px-3 pr-8 text-sm text-foreground shadow-xs transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%2364748b%22%20viewBox%3D%220%200%20256%20256%22%3E%3Cpath%20d%3D%22M213.66%2C101.66l-80%2C80a8%2C8%2C0%2C0%2C1-11.32%2C0l-80-80a8%2C8%2C0%2C0%2C1%2C11.32-11.32L128%2C164.69l74.34-74.35a8%2C8%2C0%2C0%2C1%2C11.32%2C11.32Z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px] bg-[right_0.65rem_center] bg-no-repeat";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(textareaClass, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(selectClass, className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ className, children, ...props }: ComponentProps<"label">) {
  return (
    <label className={cn("mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground", className)} {...props}>
      {children}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

/* ------------------------------ display ------------------------------ */

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        {
          neutral: "bg-surface-muted text-muted-foreground ring-border",
          primary: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900",
          success: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
          warning: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
          danger: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
        }[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = 28,
  className,
  ring,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-white",
        avatarGradient(name),
        ring && "ring-2 ring-surface",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-border bg-surface shadow-xs", className)}>{children}</div>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary">{icon}</div>
      )}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-muted", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full bg-primary transition-[width] duration-300", barClassName)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
