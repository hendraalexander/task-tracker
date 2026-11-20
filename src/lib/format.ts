import { makeT, normalizeLocale, type Locale } from "@/lib/i18n";

export const enFormat = (date: Date, timezone: string, format = "dd/MM/yyyy") => {
  const opts: Intl.DateTimeFormatOptions = { timeZone: timezone };
  if (format.includes("MMM")) {
    opts.day = "numeric";
    opts.month = "short";
    opts.year = "numeric";
  } else if (format === "yyyy-MM-dd") {
    opts.year = "numeric";
    opts.month = "2-digit";
    opts.day = "2-digit";
  } else if (format === "MM/dd/yyyy") {
    opts.year = "numeric";
    opts.month = "2-digit";
    opts.day = "2-digit";
  } else {
    opts.day = "2-digit";
    opts.month = "2-digit";
    opts.year = "numeric";
  }
  const locale = format === "MM/dd/yyyy" ? "en-US" : "id-ID";
  return new Intl.DateTimeFormat(locale, opts).format(date);
};

export function formatDate(
  date: Date | string | null | undefined,
  locale: Locale = "id",
  timezone = "Asia/Jakarta",
  dateFormat = "dd/MM/yyyy",
) {
  if (!date) return "";
  return enFormat(typeof date === "string" ? new Date(date) : date, timezone, dateFormat);
}

export function formatDateTime(date: Date | string, locale: Locale = "id", timezone = "Asia/Jakarta") {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function relativeTime(date: Date | string, locale: Locale = "id") {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale === "en" ? "en" : "id", { numeric: "auto" });
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return formatDate(d, locale);
}

export function dayKey(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isOverdue(dueDate: Date | string | null | undefined, status: string) {
  if (!dueDate || status === "DONE") return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function isToday(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

export function makeTranslator(locale?: string | null) {
  return makeT(normalizeLocale(locale));
}

export function dueLabel(dateText: string, locale: Locale = "id") {
  const t = makeT(locale);
  const d = new Date(dateText);
  if (isToday(d)) return t("common.today");
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  if (diff === 1) return locale === "en" ? "Tomorrow" : "Besok";
  if (diff === -1) return locale === "en" ? "Yesterday" : "Kemarin";
  return enFormat(d, "Asia/Jakarta", "dd MMM");
}
