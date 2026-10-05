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
      <ul className="no-scrollbar mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 sm:px-6">
        {NAV_LEAGUES.map((l) => {
          const active = path === l.href || path.startsWith(`${l.href}/`);
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`block py-2.5 text-[14px] transition-colors ${
                  active ? "text-ink shadow-[inset_0_-1.5px_0_var(--color-ink)]" : "text-ink-3 hover:text-ink"
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
