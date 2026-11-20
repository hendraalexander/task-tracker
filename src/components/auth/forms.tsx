"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeSlash, ArrowRight, Sparkle } from "@phosphor-icons/react";
import { Button, Input, Field } from "@/components/ui/primitives";
import { useLocale, useT } from "@/components/providers";
import { loginAction, signupAction, requestResetAction, resetPasswordAction, type AuthState } from "@/actions/auth";

function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-snug text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
    </div>
  );
}

function SuccessBanner({ message, link }: { message?: string; link?: string }) {
  if (!message) return null;
  return (
    <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] leading-snug text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
      <p>{message}</p>
      {link && (
        <a href={link} className="mt-2 block break-all rounded-md bg-white/60 px-2 py-1 font-mono text-[11px] underline dark:bg-black/20">
          {link}
        </a>
      )}
    </div>
  );
}

function PasswordInput({
  name,
  placeholder,
  autoComplete,
  inputRef,
}: {
  name: string;
  placeholder?: string;
  autoComplete?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={inputRef}
        name={name}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1 top-1 grid h-7 w-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
      >
        {show ? <EyeSlash size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  return (
    <div className={`inline-flex items-center gap-1 text-xs ${className ?? ""}`}>
      {(["id", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => {
            setLocale(l);
            router.refresh();
          }}
          className={
            locale === l
              ? "rounded-md bg-primary-soft px-2 py-1 font-semibold text-primary"
              : "rounded-md px-2 py-1 text-muted-foreground transition hover:bg-surface-muted"
          }
          aria-pressed={locale === l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const { locale } = useLocale();

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <ErrorBanner message={state?.error} />

      <Field label={t("auth.email")}>
        <Input ref={emailRef} name="email" type="email" autoComplete="email" required placeholder="nama@perusahaan.com" />
      </Field>

      <Field
        label={t("auth.password")}
        hint={undefined}
      >
        <PasswordInput name="password" autoComplete="current-password" placeholder="••••••••" inputRef={passwordRef} />
      </Field>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <input type="checkbox" name="remember" defaultChecked className="h-3.5 w-3.5 accent-[var(--primary)]" />
          {t("auth.remember")}
        </label>
        <Link href="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">
          {t("auth.forgot")}
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("auth.login")}
        {!pending && <ArrowRight size={16} weight="bold" />}
      </Button>

      <div className="rounded-xl border border-dashed border-border bg-surface-muted/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold">
              <Sparkle size={13} weight="fill" className="text-amber-500" />
              {t("auth.demoTitle")}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t("auth.demoHint")}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => {
              if (emailRef.current) emailRef.current.value = "rina@atracker.test";
              if (passwordRef.current) passwordRef.current.value = "Password123!";
            }}
          >
            Isi demo
          </Button>
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">rina@atracker.test · Password123!</p>
      </div>

      <p className="text-center text-[13px] text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          {t("auth.signup")}
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const t = useT();
  const [state, action, pending] = useActionState<AuthState, FormData>(signupAction, null);
  const { locale } = useLocale();

  return (
    <form action={action} className="space-y-4">
      <ErrorBanner message={state?.error} />
      <Field label={t("auth.name")}>
        <Input name="name" autoComplete="name" required placeholder={locale === "id" ? "Nama lengkap" : "Full name"} />
      </Field>
      <Field label={t("auth.email")}>
        <Input name="email" type="email" autoComplete="email" required placeholder="nama@perusahaan.com" />
      </Field>
      <Field label={t("auth.password")} hint={locale === "id" ? "Minimal 8 karakter, bukan password umum." : "At least 8 characters, not a common password."}>
        <PasswordInput name="password" autoComplete="new-password" placeholder="••••••••" />
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("auth.createAccount")}
        {!pending && <ArrowRight size={16} weight="bold" />}
      </Button>

      <p className="text-[11px] leading-relaxed text-muted-foreground">{t("auth.terms")}</p>
      <p className="text-center text-[13px] text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const t = useT();
  const [state, action, pending] = useActionState<AuthState, FormData>(requestResetAction, null);

  return (
    <form action={action} className="space-y-4">
      <SuccessBanner message={state?.message} link={state?.devLink} />
      <ErrorBanner message={state?.error} />
      <Field label={t("auth.email")}>
        <Input name="email" type="email" autoComplete="email" required placeholder="nama@perusahaan.com" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("auth.sendLink")}
      </Button>
      <p className="text-center text-[13px]">
        <Link href="/login" className="font-medium text-muted-foreground hover:text-foreground">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPasswordAction, null);
  const { locale } = useLocale();

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <ErrorBanner message={state?.error} />
      <Field label={t("auth.newPassword")} hint={locale === "id" ? "Minimal 8 karakter." : "At least 8 characters."}>
        <PasswordInput name="password" autoComplete="new-password" placeholder="••••••••" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("auth.savePassword")}
      </Button>
      <p className="text-center text-[13px]">
        <Link href="/login" className="font-medium text-muted-foreground hover:text-foreground">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </form>
  );
}
