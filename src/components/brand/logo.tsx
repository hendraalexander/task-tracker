import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A Tracker brand lockup.
 * tone="auto"   transparent mark on light, white tile on dark
 * tone="light"  transparent mark + dark text
 * tone="dark"   white tile + white text (always-dark surfaces)
 */
export function BrandLogo({
  href = "/",
  size = 30,
  tone = "auto",
  showText = true,
  className,
  textClassName,
}: {
  href?: string;
  size?: number;
  tone?: "auto" | "light" | "dark";
  showText?: boolean;
  className?: string;
  textClassName?: string;
}) {
  const onDark = tone === "dark";

  return (
    <Link
      href={href}
      aria-label="A Tracker"
      className={cn("inline-flex items-center gap-2.5 rounded-lg", className)}
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          onDark
            ? "rounded-[9px] bg-white p-[3px] shadow-sm shadow-black/10"
            : "rounded-[9px] p-[3px] dark:bg-white dark:shadow-sm dark:shadow-black/10",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-mark.png"
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className="object-contain"
          draggable={false}
        />
      </span>
      {showText && (
        <span
          className={cn(
            "text-[15px] font-bold tracking-tight",
            onDark ? "text-white" : "text-foreground",
            textClassName,
          )}
        >
          A Tracker
        </span>
      )}
    </Link>
  );
}
