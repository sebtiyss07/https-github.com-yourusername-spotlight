"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Search box. Submits to the server-rendered results page. `large` is the
 * home page's main search, with a visible button.
 */
export function SiteSearch({ large = false }: { large?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q.length < 2) return;
        router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
      className="relative"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-3 ${large ? "left-4 h-5 w-5 sm:left-5" : "left-3.5 h-4 w-4"}`}
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Team, league or city"
        aria-label="Search for a team, league or city"
        className={
          large
            ? "w-full rounded-xl border border-line-bright bg-white py-4 pl-12 pr-28 text-[16px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-ink sm:pl-14 sm:pr-32"
            : "w-full rounded-lg border border-line bg-surface-2 py-2 pl-10 pr-4 text-[14px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-ink focus:bg-surface"
        }
      />
      {large && (
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-accent-2 sm:px-5"
        >
          Search
        </button>
      )}
    </form>
  );
}
