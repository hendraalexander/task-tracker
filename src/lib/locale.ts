import "server-only";
import { cookies, headers } from "next/headers";
import { normalizeLocale, type Locale } from "@/lib/i18n";

/** Locale for unauthenticated pages: cookie → Accept-Language → default. */
export async function getRequestLocale(): Promise<Locale> {
  const jar = await cookies();
  const fromCookie = jar.get("at_locale")?.value;
  if (fromCookie) return normalizeLocale(fromCookie);

  const h = await headers();
  const accept = h.get("accept-language") ?? "";
  return accept.toLowerCase().split(",")[0]?.startsWith("en") ? "en" : "id";
}

export function localeFromUser(user: { locale: string } | null | undefined): Locale {
  return normalizeLocale(user?.locale);
}
