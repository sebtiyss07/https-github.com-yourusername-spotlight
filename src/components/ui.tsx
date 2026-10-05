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
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-ink-2",
    accent: "bg-accent/10 text-accent",
    positive: "bg-positive/10 text-positive",
    warn: "bg-warn/10 text-warn",
    hot: "bg-hot/10 text-hot",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink-3 transition-colors hover:text-ink"
    >
      <span aria-hidden>←</span> {children}
    </Link>
  );
}

/** "Step 2 of 3" — keeps people oriented on the league → game → trip path. */
export function StepLabel({ step }: { step: 1 | 2 | 3 }) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-semibold text-accent">
      <span className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1.5 rounded-full ${n <= step ? "w-5 bg-accent" : "w-3 bg-surface-3"}`}
          />
        ))}
      </span>
      Step {step} of 3
    </p>
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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[13px] font-semibold text-ink-3">{eyebrow}</p>
        )}
        <h2 className="text-[22px] font-semibold sm:text-[24px]">{title}</h2>
      </div>
      {action}
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
    <div className="rounded-2xl border border-dashed border-line-bright bg-surface px-6 py-12 text-center">
      <p className="text-[16px] font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[14px] text-ink-3">{description}</p>
    </div>
  );
}

/** The credit a Creative Commons photo requires, small and out of the way. */
export function PhotoCredit({
  photo,
  className = "",
}: {
  photo: { credit: string; license: string; page: string };
  className?: string;
}) {
  return (
    <a
      href={photo.page}
      target="_blank"
      rel="noopener noreferrer"
      className={`rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-medium text-white/75 backdrop-blur-sm transition-colors hover:text-white ${className}`}
    >
      Photo: {photo.credit} · {photo.license}
    </a>
  );
}
