"use client";

import Link from "next/link";
import { useState } from "react";
import { FinderRowView, type FinderRow } from "@/components/MatchFinder";

export interface UpcomingTab {
  id: string;
  label: string;
  /** "games", "matches" or "races". */
  noun: string;
  rows: FinderRow[];
}

/**
 * The next games in each league, one tab per league, each with its cheapest
 * price: people can tap a game straight from the home page.
 */
export function UpcomingGames({ tabs, currency }: { tabs: UpcomingTab[]; currency: string }) {
  const usable = tabs.filter((t) => t.rows.length > 0);
  const [active, setActive] = useState(usable[0]?.id);
  const tab = usable.find((t) => t.id === active) ?? usable[0];
  if (!tab) return null;

  return (
    <div>
      <div role="tablist" aria-label="Leagues" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {usable.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab.id}
            onClick={() => setActive(t.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
              t.id === tab.id
                ? "border-accent bg-accent text-white"
                : "border-line bg-surface text-ink-2 hover:border-accent hover:text-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ul role="tabpanel" className="mt-4 flex flex-col gap-2.5">
        {tab.rows.map((r) => (
          <li key={r.id}>
            <FinderRowView row={r} currency={currency} />
          </li>
        ))}
      </ul>
      <Link
        href={`/leagues/${tab.id}`}
        className="mt-4 inline-flex items-center gap-1 font-semibold text-accent hover:underline"
      >
        See all {tab.label} {tab.noun} →
      </Link>
    </div>
  );
}
