"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TeamMark } from "@/components/TeamMark";
import { formatPrice } from "@/lib/format";

export interface Crest {
  name: string;
  abbreviation: string;
  logoUrl?: string;
  primary: string;
  secondary: string;
}

/** One match or race, flattened on the server so it can cross to the client. */
export interface FinderRow {
  id: string;
  title: string;
  /** Team ids playing, for the team filter. */
  teamIds: string[];
  /** "2026-10", for the month filter. */
  month: string;
  day: string;
  weekday: string;
  monthShort: string;
  time: string;
  place: string;
  startsAt: string;
  /** Cheapest price any site listed, or null. */
  price: number | null;
  site: string | null;
  sites: number;
  home?: Crest;
  away?: Crest;
  /** Home ground photo (football only). */
  photo?: string;
}

const PAGE = 20;
const PRICE_CAPS = [100, 150, 250, 400];

/**
 * Find a match by team, month and budget, sorted by date or by price. Every
 * number shown is a real listed price from the snapshot; nothing is computed
 * beyond picking the lowest.
 */
export function MatchFinder({
  rows,
  teams,
  currency,
  initialTeam = "",
  noun = "matches",
}: {
  rows: FinderRow[];
  teams: { id: string; name: string }[];
  currency: string;
  initialTeam?: string;
  noun?: string;
}) {
  const [team, setTeam] = useState(initialTeam);
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<"date" | "price">("date");
  const [cap, setCap] = useState(0);
  const [shown, setShown] = useState(PAGE);

  const months = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (!seen.has(r.month)) {
        seen.set(r.month, new Date(`${r.month}-15T12:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" }));
      }
    }
    return [...seen];
  }, [rows]);

  const filtered = useMemo(() => {
    const list = rows.filter(
      (r) =>
        (!team || r.teamIds.includes(team)) &&
        (!month || r.month === month) &&
        (!cap || (r.price !== null && r.price <= cap)),
    );
    if (sort === "price") {
      list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    }
    return list;
  }, [rows, team, month, sort, cap]);

  const cheapest = filtered.reduce<FinderRow | null>(
    (best, r) => (r.price !== null && (!best || r.price < best.price!) ? r : best),
    null,
  );

  const reset = (fn: () => void) => {
    fn();
    setShown(PAGE);
  };

  return (
    <div>
      {/* Filters */}
      <div className="rounded-xl border border-line bg-surface p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto_auto]">
          {teams.length > 0 && (
            <label className="col-span-2 block sm:col-span-1">
              <span className="mb-1 block text-[12px] font-medium text-ink-3">Team</span>
              <select
                value={team}
                onChange={(e) => reset(() => setTeam(e.target.value))}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-[15px] font-medium outline-none focus:border-accent"
              >
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block min-w-0">
            <span className="mb-1 block text-[12px] font-medium text-ink-3">Budget</span>
            <select
              value={cap}
              onChange={(e) => reset(() => setCap(Number(e.target.value)))}
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-[15px] font-medium outline-none focus:border-accent"
            >
              <option value={0}>Any price</option>
              {PRICE_CAPS.map((c) => (
                <option key={c} value={c}>
                  Under {formatPrice(c, currency)}
                </option>
              ))}
            </select>
          </label>
          <div className="min-w-0">
            <span className="mb-1 block text-[12px] font-medium text-ink-3">Sort</span>
            <div className="flex rounded-xl bg-surface-2 p-1">
              {(
                [
                  ["date", "Soonest"],
                  ["price", "Cheapest"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => reset(() => setSort(key))}
                  aria-pressed={sort === key}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors sm:px-3.5 sm:text-[14px] ${
                    sort === key ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {months.length > 1 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {[["", "All months"] as const, ...months].map(([key, label]) => (
              <button
                key={key || "all"}
                onClick={() => reset(() => setMonth(key))}
                aria-pressed={month === key}
                className={`shrink-0 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${
                  month === key
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-surface text-ink-2 hover:border-accent hover:text-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <p className="mt-4 text-[14px] text-ink-2">
        <span className="font-medium text-ink">
          {filtered.length.toLocaleString("en-US")} {noun}
        </span>
        {cheapest && (
          <>
            {" "}
            · cheapest ticket{" "}
            <Link href={`/events/${cheapest.id}`} className="font-medium text-positive hover:underline">
              {formatPrice(cheapest.price!, currency)} for {cheapest.title}
            </Link>
          </>
        )}
      </p>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line px-5 py-10 text-center text-[14px] text-ink-2">
          Nothing matches those filters.{" "}
          <button
            onClick={() => reset(() => (setTeam(""), setMonth(""), setCap(0)))}
            className="font-medium text-accent hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {filtered.slice(0, shown).map((r) => (
            <li key={r.id}>
              <FinderRowView row={r} currency={currency} />
            </li>
          ))}
        </ul>
      )}

      {filtered.length > shown && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-4 w-full rounded-full border border-line bg-surface py-2.5 text-[14px] font-medium hover:border-accent hover:text-accent"
        >
          Show {Math.min(PAGE, filtered.length - shown)} more
        </button>
      )}
    </div>
  );
}

function FinderRowView({ row, currency }: { row: FinderRow; currency: string }) {
  return (
    <Link
      href={`/events/${row.id}`}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-all hover:border-ink sm:gap-4 sm:p-3.5"
    >
      <div className="flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-line text-center">
        <span className="w-full border-b border-line py-0.5 text-[10px] uppercase tracking-wide text-ink-3">
          {row.monthShort}
        </span>
        <span className="text-[17px] font-medium leading-tight">{row.day}</span>
        <span className="pb-0.5 text-[10px] font-medium text-ink-3">{row.weekday}</span>
      </div>

      {row.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.photo}
          alt=""
          loading="lazy"
          className="hidden h-12 w-20 shrink-0 rounded-lg object-cover md:block"
        />
      )}

      {row.home && row.away && (
        <div className="hidden shrink-0 items-center -space-x-2 sm:flex">
          {[row.home, row.away].map((c) => (
            <TeamMark
              key={c.name}
              name={c.name}
              abbreviation={c.abbreviation}
              logoUrl={c.logoUrl}
              primary={c.primary}
              secondary={c.secondary}
              size={32}
            />
          ))}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-medium leading-snug">{row.title}</p>
        <p className="truncate text-[13px] text-ink-3">
          {row.time} · {row.place}
        </p>
      </div>

      {row.price !== null ? (
        <div className="shrink-0 text-right">
          <p className="tabular text-[16px] font-medium leading-tight text-ink">
            {formatPrice(row.price, currency)}
          </p>
          <p className="text-[11px] text-ink-3">
            {row.sites > 1 ? `cheapest of ${row.sites} sites` : row.site}
          </p>
        </div>
      ) : (
        <p className="shrink-0 text-right text-[12px] text-ink-3">See sites</p>
      )}

      <span aria-hidden className="hidden shrink-0 text-ink-3 transition-colors group-hover:text-ink sm:inline">→</span>
    </Link>
  );
}
