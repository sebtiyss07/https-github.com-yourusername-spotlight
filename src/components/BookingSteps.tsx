"use client";

import { useEffect, useState } from "react";

export interface BookingStep {
  key: string;
  title: string;
  why: string;
  href: string | null;
  cta: string;
}

/**
 * The trip in the order that avoids costly mistakes: seats first, then a
 * refundable room, then the flight. Each step opens the right page already
 * set to this game's dates; ticks are kept on this device, per game.
 */
export function BookingSteps({ eventId, steps }: { eventId: string; steps: BookingStep[] }) {
  const storageKey = `spotlight-steps-${eventId}`;
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
    } catch {
      setDone([]);
    }
  }, [storageKey]);

  const toggle = (key: string) => {
    const next = done.includes(key) ? done.filter((k) => k !== key) : [...done, key];
    setDone(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Private mode: the ticks just won't be remembered.
    }
  };

  const left = steps.filter((s) => !done.includes(s.key)).length;

  return (
    <section aria-labelledby="book-order" className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="book-order" className="text-[17px] font-bold">
          Book in this order
        </h3>
        <p className="text-[13px] text-ink-3">{left === 0 ? "All booked. Enjoy the game!" : `${steps.length - left} of ${steps.length} done`}</p>
      </div>
      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((s, i) => {
          const isDone = done.includes(s.key);
          return (
            <li key={s.key} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isDone ? "border-positive/30 bg-positive/[0.05]" : "border-line"}`}>
              <button
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={isDone}
                aria-label={isDone ? `Mark "${s.title}" as not done` : `Mark "${s.title}" as done`}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[13px] font-bold transition-colors ${
                  isDone ? "border-positive bg-positive text-white" : "border-line-bright text-ink-3 hover:border-accent hover:text-accent"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] font-semibold leading-snug ${isDone ? "text-ink-3 line-through" : ""}`}>{s.title}</p>
                <p className="text-[13px] text-ink-3">{s.why}</p>
              </div>
              {s.href && (
                <a
                  href={s.href}
                  target={s.href.startsWith("#") ? undefined : "_blank"}
                  rel={s.href.startsWith("#") ? undefined : "noopener noreferrer"}
                  className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-accent"
                >
                  {s.cta}
                  {!s.href.startsWith("#") && <span aria-hidden> ↗</span>}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
