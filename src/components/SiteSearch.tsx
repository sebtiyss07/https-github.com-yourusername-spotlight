"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

interface Suggestion {
  kind: "league" | "team" | "event";
  title: string;
  subtitle: string;
  href: string;
  price?: string | null;
}

/**
 * Search box with instant suggestions: leagues, teams and the next matching
 * games with their cheapest price, shown as you type. Arrow keys move through
 * them, Enter opens one; Enter with nothing picked opens the full results.
 * `large` is the home page's main search, with a visible button.
 */
export function SiteSearch({ large = false }: { large?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLFormElement>(null);
  const listId = useId();

  // Fetch suggestions shortly after typing stops.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { items: Suggestion[] };
        setItems(data.items);
        setActive(-1);
        setOpen(true);
      } catch {
        // Typing again cancels the previous request; nothing to show.
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value]);

  // Close when clicking anywhere else.
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setValue("");
    router.push(href);
  };
  const showList = open && items.length > 0;

  return (
    <form
      ref={box}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (showList && active >= 0) return go(items[active].href);
        const q = value.trim();
        if (q.length < 2) return;
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
      className="relative"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-ink-3 ${large ? "left-4 h-5 w-5 sm:left-5" : "left-3.5 h-4 w-4"}`}
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        name="q"
        value={value}
        autoComplete="off"
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Team, league or city"
        aria-label="Search for a team, league or city"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        className={
          large
            ? "w-full rounded-2xl border-0 bg-white py-[18px] pl-12 pr-28 text-[17px] text-ink shadow-lg outline-none ring-sun placeholder:text-ink-3 focus:ring-4 sm:pl-14 sm:pr-36"
            : "w-full rounded-full border border-line bg-surface-2 py-2.5 pl-10 pr-4 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent focus:bg-surface"
        }
      />
      {large && (
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-accent px-4 py-3 text-[15px] font-bold text-white transition-colors hover:bg-accent-2 sm:px-6 sm:text-[16px]"
        >
          Search
        </button>
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 text-left text-ink shadow-lg"
        >
          {items.map((s, i) => (
            <li key={s.href} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <Link
                href={s.href}
                onClick={(e) => {
                  e.preventDefault();
                  go(s.href);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i === active ? "bg-surface-2" : ""}`}
              >
                <span
                  aria-hidden
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    s.kind === "event" ? "bg-accent/10 text-accent" : "bg-surface-2 text-ink-2"
                  }`}
                >
                  <KindIcon kind={s.kind} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{s.title}</span>
                  <span className="block truncate text-[13px] text-ink-3">{s.subtitle}</span>
                </span>
                {s.price && (
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] text-ink-3">from</span>
                    <span className="tabular block text-[15px] font-bold text-positive">{s.price}</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="submit"
              className="w-full rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-accent hover:bg-surface-2"
            >
              See all results for &ldquo;{value.trim()}&rdquo; →
            </button>
          </li>
        </ul>
      )}
    </form>
  );
}

/** A ticket for a game, a shield for a team, a trophy for a league. */
function KindIcon({ kind }: { kind: Suggestion["kind"] }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" width={16} height={16}>
      {kind === "event" ? (
        <path d="M3.5 9.5a2 2 0 0 0 0 5V17a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-2.5a2 2 0 0 1 0-5V7A1.5 1.5 0 0 0 19 5.5H5A1.5 1.5 0 0 0 3.5 7z" {...p} />
      ) : kind === "team" ? (
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" {...p} />
      ) : (
        <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" {...p} />
      )}
    </svg>
  );
}
