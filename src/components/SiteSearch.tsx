"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/**
 * Header search. A plain form navigation rather than a live-query combobox:
 * results are a server-rendered page, which keeps the whole search path
 * cacheable and works without JavaScript.
 */
export function SiteSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q.length < 2) return;
        router.push(`/search?q=${encodeURIComponent(q)}`);
        inputRef.current?.blur();
      }}
      className="relative"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Teams, leagues, events…"
        aria-label="Search sports, teams, and events"
        className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent/60 focus:bg-surface-2"
      />
    </form>
  );
}
