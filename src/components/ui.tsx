import Link from "next/link";
import type { ReactNode } from "react";

// Lives in its own file — it carries contrast logic and the licensed-logo hook.
export { TeamMark } from "@/components/TeamMark";

/** Shared primitives. Deliberately small — layout stays in the pages. */

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "positive" | "warn" | "hot";
  className?: string;
}) {
  // Tints are light and the text carries the colour — a saturated fill would
  // shout on a white card and compete with the prices, which are what should
  // draw the eye.
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-ink-2 ring-line",
    accent: "bg-accent/[0.08] text-accent ring-accent/20",
    positive: "bg-positive/[0.08] text-positive ring-positive/20",
    warn: "bg-warn/[0.09] text-warn ring-warn/20",
    hot: "bg-hot/[0.07] text-hot ring-hot/20",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-2 text-[12px] font-medium text-ink-3">{eyebrow}</p>
        )}
        <h2 className="text-[22px] font-bold tracking-[-0.02em] sm:text-[26px]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-[13px]">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-ink-3">/</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="text-ink-3 transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-2">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    // Deliberately chrome-less. Four bordered tiles in a row read as clutter;
    // a label above a number, separated by whitespace, reads as data.
    <div>
      <p className="text-[12.5px] text-ink-3">{label}</p>
      <p className="tabular mt-1.5 text-[22px] font-semibold tracking-[-0.02em]">
        {value}
      </p>
      {hint && <p className="mt-1 text-[12.5px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-bright bg-surface-2/60 px-6 py-14 text-center">
      <p className="text-sm font-semibold text-ink-2">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-3">
        {description}
      </p>
    </div>
  );
}

