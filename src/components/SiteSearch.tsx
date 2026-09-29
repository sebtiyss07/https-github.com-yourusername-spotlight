"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Header search. Submits to the server-rendered results page. */
export function SiteSearch() {
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
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search a team or city"
        aria-label="Search for a team, league or city"
        className="w-full rounded-full border border-line bg-surface-2 py-2 pl-10 pr-4 text-[14px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent focus:bg-surface"
      />
    </form>
  );
}
