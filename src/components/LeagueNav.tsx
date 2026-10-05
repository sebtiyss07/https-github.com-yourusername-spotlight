"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LEAGUES } from "@/lib/nav";

/**
 * The league shortcuts under the logo: one scrollable row on phones, the full
 * list on larger screens. The current league is highlighted.
 */
export function LeagueNav() {
  const path = usePathname();
  return (
    <nav aria-label="Leagues" className="border-t border-line">
      <ul className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-1.5 sm:px-6">
        {[...NAV_LEAGUES, { href: "/near-me", label: "📍 Near me" }].map((l) => {
          const active = path === l.href || path.startsWith(`${l.href}/`);
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
                  active ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
