import Link from "next/link";
import type { Metadata } from "next";
import { getEventContexts, getUpcomingEvents, type EventContext } from "@/lib/repositories";
import { haversineKm } from "@/lib/providers/geo";
import { getCurrency } from "@/lib/currency";
import { dateParts, formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Two games, one trip",
  description: "Two games close together on back-to-back days, with both cheapest tickets added up.",
};

const MAX_MILES = 75;
const LEAGUES = [
  { id: "", label: "All" },
  { id: "nfl", label: "NFL" },
  { id: "nba", label: "NBA" },
  { id: "mls", label: "MLS" },
  { id: "premier-league", label: "Premier League" },
  { id: "champions-league", label: "Champions League" },
];

/** The game's calendar date where it's played, as a day number (for gaps). */
const localDay = (c: EventContext) => {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: c.venue?.timeZone ?? "UTC" }).format(new Date(c.event.startsAt));
  return Date.parse(`${ymd}T00:00:00Z`) / 864e5;
};

/**
 * Double-headers: two games within 75 miles of each other, the second one
 * or two days after the first, cheapest pair of tickets first. Each game is
 * used once, so the list isn't the same cheap game paired with everything.
 */
export default async function TwoGamesPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const q = await searchParams;
  const league = LEAGUES.some((l) => l.id === q.league) ? (q.league as string) : "";
  const currency = await getCurrency();
  const events = (await getUpcomingEvents()).filter((e) => e.sportId !== "motorsport");
  const games = (await getEventContexts(events))
    // Only prices that include fees, so the pair's total is what you'd pay.
    .filter((c) => c.venue && c.prices.cheapest?.amount != null && c.prices.cheapest.fees.included === "yes")
    .map((c) => ({ c, day: localDay(c), price: c.prices.cheapest!.amount! }))
    .sort((a, b) => a.day - b.day);

  const pairs: { a: (typeof games)[number]; b: (typeof games)[number]; miles: number; gap: number; total: number }[] = [];
  for (let i = 0; i < games.length; i++) {
    const a = games[i];
    for (let j = i + 1; j < games.length && games[j].day - a.day <= 2; j++) {
      const b = games[j];
      const gap = b.day - a.day;
      // The same home team twice isn't much of a trip idea.
      if (gap < 1 || (a.c.homeTeam && a.c.homeTeam.id === b.c.homeTeam?.id)) continue;
      if (league && a.c.event.leagueId !== league && b.c.event.leagueId !== league) continue;
      const miles = haversineKm(a.c.venue!.lat, a.c.venue!.lon, b.c.venue!.lat, b.c.venue!.lon) / 1.609;
      if (miles > MAX_MILES) continue;
      pairs.push({ a, b, miles: Math.round(miles), gap, total: Math.round((a.price + b.price) * 100) / 100 });
    }
  }
  pairs.sort((x, y) => x.total - y.total);
  const used = new Set<string>();
  const shown = pairs.filter((p) => {
    if (used.has(p.a.c.event.id) || used.has(p.b.c.event.id)) return false;
    used.add(p.a.c.event.id);
    used.add(p.b.c.event.id);
    return true;
  });

  const money = (n: number) => formatPrice(n, currency);
  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
      on ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-2 hover:border-accent hover:text-accent"
    }`;

  const Game = ({ g }: { g: (typeof games)[number] }) => {
    const { weekday, day, month } = dateParts(g.c.event.startsAt, g.c.venue!.timeZone);
    return (
      <Link
        href={`/events/${g.c.event.id}`}
        className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2"
      >
        <div className="flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-line text-center">
          <span className="w-full bg-accent py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{month}</span>
          <span className="font-display text-[19px] font-semibold leading-tight">{day}</span>
          <span className="pb-0.5 text-[10px] font-medium text-ink-3">{weekday}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-accent">{g.c.title}</p>
          <p className="truncate text-[13px] text-ink-3">
            {g.c.league?.name} · {g.c.venue!.name}, {g.c.venue!.city}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-[15px] font-bold">{money(g.price)}</p>
          <p className="text-[11px] text-ink-3">on {g.c.prices.cheapest?.label}</p>
        </div>
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <h1 className="text-[30px] font-extrabold leading-tight sm:text-[38px]">Two games, one trip</h1>
      <p className="mt-2 text-ink-3">
        Two games within {MAX_MILES} miles of each other, a day or two apart. One trip, one hotel, twice the sport.
        Cheapest pair of tickets first.
      </p>

      <div className="no-scrollbar mt-6 flex items-center gap-2 overflow-x-auto rounded-2xl border border-line bg-surface p-4 text-[14px] shadow-xs">
        <span className="shrink-0 text-ink-3">League</span>
        {LEAGUES.map((l) => (
          <Link key={l.id || "all"} href={l.id ? `/two-games?league=${l.id}` : "/two-games"} className={chip(l.id === league)}>
            {l.label}
          </Link>
        ))}
      </div>

      <p className="mt-5 text-[15px] text-ink-2">
        <span className="font-semibold text-ink">{shown.length.toLocaleString("en-US")} double-headers</span>
        {shown[0] && <>, both tickets from {money(shown[0].total)}</>}.
      </p>

      {shown.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line-bright bg-surface px-5 py-8 text-center text-ink-2">
          No two games close together right now. Try another league.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {shown.slice(0, 40).map(({ a, b, miles, gap, total }) => (
            <li key={`${a.c.event.id}-${b.c.event.id}`} className="rounded-2xl border border-line bg-surface p-2 shadow-xs">
              <Game g={a} />
              <p className="flex items-center gap-2 px-2 py-1 text-[12px] font-semibold text-ink-3">
                <span aria-hidden className="h-px flex-1 bg-line" />
                {gap === 1 ? "Next day" : "2 days later"} · {miles <= 2 ? "same area" : `${miles} mi away`}
                <span aria-hidden className="h-px flex-1 bg-line" />
              </p>
              <Game g={b} />
              <p className="mt-1 flex items-baseline justify-between rounded-xl bg-surface-2 px-3 py-2 text-[14px]">
                <span className="text-ink-2">Both games</span>
                <span className="tabular text-[18px] font-extrabold text-positive">{money(total)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[13px] text-ink-3">
        Each price is the cheapest single ticket across the sites we compare, from our latest check. Open a game to see
        each site we check, and a hotel and flight for your dates.
      </p>
    </div>
  );
}
