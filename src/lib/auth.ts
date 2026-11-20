import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

const COOKIE = "at_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-only-secret-change-me-0123456789abcdef",
);
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30);

// Argon2id parameters tuned for interactive logins (OWASP baseline).
export const hashPassword = (password: string) =>
  hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

export const verifyPassword = async (passwordHash: string, password: string) => {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  dateFormat: string;
  theme: string;
  sessionId: string;
};

export async function createSession(userId: string) {
  const h = await headers();
  const session = await prisma.session.create({
    data: {
      userId,
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
  });

  const token = await new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_DAYS * 86_400,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      if (payload.sid) {
        await prisma.session.updateMany({
          where: { id: String(payload.sid) },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      /* expired or tampered token: nothing to revoke */
    }
  }
  store.delete(COOKIE);
}

async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || !payload.sid) return null;

    const session = await prisma.session.findUnique({
      where: { id: String(payload.sid) },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, locale: true, timezone: true, dateFormat: true, theme: true, deletedAt: true } } },
    });
    if (!session || session.revokedAt || session.user.deletedAt) return null;
    if (session.userId !== payload.sub) return null;

    return { ...session.user, sessionId: session.id };
  } catch {
    return null;
  }
}

export const getSession = cache(readSession);

export async function requireUser() {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function currentSessionMeta() {
  const user = await getSession();
  if (!user) return null;
  return prisma.session.findUnique({ where: { id: user.sessionId } });
}
