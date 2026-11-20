import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_ORDER = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
export type StatusValue = (typeof STATUS_ORDER)[number];

export const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type PriorityValue = (typeof PRIORITY_ORDER)[number];

export const STATUS_STYLES: Record<string, { dot: string; chip: string; bar: string }> = {
  TODO: {
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    bar: "#94A3B8",
  },
  IN_PROGRESS: {
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900",
    bar: "#2563EB",
  },
  IN_REVIEW: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
    bar: "#F59E0B",
  },
  DONE: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
    bar: "#059669",
  },
};

export const PRIORITY_STYLES: Record<string, { chip: string; icon: string }> = {
  LOW: { chip: "text-slate-500", icon: "text-slate-400" },
  MEDIUM: { chip: "text-blue-600 dark:text-blue-400", icon: "text-blue-500" },
  HIGH: { chip: "text-amber-600 dark:text-amber-400", icon: "text-amber-500" },
  URGENT: { chip: "text-red-600 dark:text-red-400", icon: "text-red-500" },
};

export const PROJECT_COLORS = [
  "#2563EB",
  "#059669",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#0891B2",
  "#DC2626",
  "#64748B",
];

export const TAG_COLORS = ["#2563EB", "#059669", "#F59E0B", "#8B5CF6", "#EC4899", "#DC2626", "#64748B"];

export const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-sky-600",
];

export function avatarGradient(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) n = (n + seed.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[n];
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function textFromHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export const MAX_FILE_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024;
export const MAX_FILES_PER_TASK = 10;
