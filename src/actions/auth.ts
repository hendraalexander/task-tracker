"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  getSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { sendEmail, appUrl } from "@/lib/email";
import { makeT } from "@/lib/i18n";
import { normalizeLocale } from "@/lib/i18n";

export type AuthState = { error?: string; message?: string; devLink?: string } | null;

const emailSchema = z.string().trim().toLowerCase().email();
const COMMON_PASSWORDS = new Set([
  "password", "password1", "12345678", "123456789", "qwerty123", "iloveyou",
  "admin123", "welcome1", "letmein1", "abc12345", "password123", "sunshine",
]);

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get("at_locale")?.value);
  const t = makeT(locale);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { error: locale === "en" ? "Enter your full name." : "Masukkan nama lengkap." };
  if (!emailSchema.safeParse(email).success) {
    return { error: locale === "en" ? "Enter a valid email address." : "Masukkan email yang valid." };
  }
  if (password.length < 8) {
    return { error: locale === "en" ? "Password must be at least 8 characters." : "Password minimal 8 karakter." };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { error: locale === "en" ? "That password is too common. Choose another." : "Password terlalu umum. Pilih yang lain." };
  }

  const ip = await clientIp();
  if (!rateLimit(`signup:${ip}`, 20, 3_600_000).allowed) {
    return { error: locale === "en" ? "Too many attempts. Try again later." : "Terlalu banyak percobaan. Coba lagi nanti." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error:
        locale === "en"
          ? "We could not create an account with those details. Try logging in or resetting your password."
          : "Kami tidak dapat membuat akun dengan detail tersebut. Coba masuk atau atur ulang password.",
    };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      locale,
      notificationPreference: { create: {} },
    },
  });

  const token = randomUUID();
  await prisma.verificationToken.create({
    data: { userId: user.id, token, purpose: "verify_email", expiresAt: new Date(Date.now() + 86_400_000) },
  });
  const link = appUrl(`/verify-email?token=${token}`);
  await sendEmail({
    to: email,
    subject: locale === "en" ? "Verify your A Tracker email" : "Verifikasi email A Tracker",
    text: `${t("auth.verifyBody")}\n${link}`,
  });

  await createSession(user.id);
  jar.set("at_locale", locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  redirect(`/onboarding?verify=1`);
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get("at_locale")?.value ?? String(formData.get("locale") ?? ""));
  const t = makeT(locale);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const ip = await clientIp();

  const ipLimit = rateLimit(`login-ip:${ip}`, 10, 60_000);
  if (!ipLimit.allowed) {
    const mins = Math.max(1, Math.ceil((ipLimit.resetAt - Date.now()) / 60_000));
    return { error: locale === "en" ? `Too many attempts. Try again in ${mins} minute(s).` : `Terlalu banyak percobaan. Coba lagi dalam ${mins} menit.` };
  }
  const accountLimit = rateLimit(`login-account:${email}`, 10, 900_000);
  if (!accountLimit.allowed) {
    return {
      error:
        locale === "en"
          ? "This account is temporarily locked for 15 minutes after repeated failures."
          : "Akun ini terkunci sementara 15 menit setelah beberapa kali gagal.",
    };
  }

  if (!emailSchema.safeParse(email).success || !password) {
    return { error: t("common.error") };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt || !(await verifyPassword(user.passwordHash, password))) {
    return {
      error: locale === "en" ? "Email or password is incorrect." : "Email atau password salah.",
    };
  }

  resetRateLimit(`login-account:${email}`);
  await createSession(user.id);
  jar.set("at_locale", user.locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  jar.set("at_theme", user.theme, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  jar.set("at_motion", user.animations ? "on" : "off", { path: "/", maxAge: 31_536_000, sameSite: "lax" });

  if (next && next.startsWith("/") && !next.startsWith("//")) redirect(next);

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  redirect(membership ? `/w/${membership.workspace.slug}/home` : "/welcome");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function requestResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get("at_locale")?.value);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const generic =
    locale === "en"
      ? "If that email is registered, a reset link is on its way."
      : "Jika email tersebut terdaftar, tautan reset sedang dikirim.";

  if (!emailSchema.safeParse(email).success) {
    return { error: locale === "en" ? "Enter a valid email address." : "Masukkan email yang valid." };
  }
  if (!rateLimit(`reset:${email}`, 5, 900_000).allowed) return { message: generic };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = randomUUID();
    await prisma.verificationToken.create({
      data: { userId: user.id, token, purpose: "reset_password", expiresAt: new Date(Date.now() + 3_600_000) },
    });
    const link = appUrl(`/reset-password?token=${token}`);
    await sendEmail({
      to: email,
      subject: locale === "en" ? "Reset your A Tracker password" : "Atur ulang password A Tracker",
      text: link,
    });
    return {
      message: generic,
      devLink: process.env.RESEND_API_KEY ? undefined : link,
    };
  }
  return { message: generic };
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get("at_locale")?.value);
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: locale === "en" ? "Password must be at least 8 characters." : "Password minimal 8 karakter." };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { error: locale === "en" ? "That password is too common. Choose another." : "Password terlalu umum. Pilih yang lain." };
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.purpose !== "reset_password" || record.usedAt || record.expiresAt < new Date()) {
    return { error: locale === "en" ? "This reset link is invalid or expired." : "Tautan reset tidak valid atau sudah kedaluwarsa." };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  redirect("/login?reset=1");
}

export async function verifyEmailToken(token: string) {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.purpose !== "verify_email" || record.usedAt || record.expiresAt < new Date()) {
    return false;
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return true;
}

export async function verifyEmailAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const ok = token ? await verifyEmailToken(token) : false;
  redirect(ok ? "/verify-email?status=ok" : "/verify-email?status=invalid");
}

export async function resendVerificationAction() {
  const user = await getSession();
  if (!user) redirect("/login");
  const token = randomUUID();
  await prisma.verificationToken.create({
    data: { userId: user.id, token, purpose: "verify_email", expiresAt: new Date(Date.now() + 86_400_000) },
  });
  const link = appUrl(`/verify-email?token=${token}`);
  await sendEmail({ to: user.email, subject: "Verifikasi email A Tracker", text: link });
  return { ok: true, devLink: process.env.RESEND_API_KEY ? undefined : link };
}
