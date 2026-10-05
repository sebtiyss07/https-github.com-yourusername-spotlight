import Link from "next/link";
import type { ReactNode } from "react";
import {
  getEventContexts,
  getEventsByLeague,
  getLeaguePhoto,
  type EventContext,
} from "@/lib/repositories";
import { PhotoCredit } from "@/components/ui";
import { SiteSearch } from "@/components/SiteSearch";
import { GameCard, LEAGUE_COLORS } from "@/components/GameCard";
import { formatPrice } from "@/lib/format";
import { toFinderRow } from "@/lib/finderRow";
import { UpcomingGames, type UpcomingTab } from "@/components/UpcomingGames";

/**
 * Home: one clear path, top to bottom.
 * 1. Search a team, or tap a popular one.
 * 2. How it works, in three short steps.
 * 3. Pick a league (with its lowest real price).
 * 4. The next games in each league, then the cheapest game this month per league.
 * 5. Plain answers to the questions people ask first.
 */
export default async function HomePage() {
  const [pl, ucl, races, nfl, nba, mls, photo] = await Promise.all([
    getEventsByLeague("premier-league").then(getEventContexts),
    getEventsByLeague("champions-league").then(getEventContexts),
    getEventsByLeague("formula-1").then(getEventContexts),
    getEventsByLeague("nfl").then(getEventContexts),
    getEventsByLeague("nba").then(getEventContexts),
    getEventsByLeague("mls").then(getEventContexts),
    getLeaguePhoto("premier-league"),
  ]);

  const currency = nfl[0]?.prices.currency ?? pl[0]?.prices.currency ?? "USD";
  const lowest = (list: EventContext[]) =>
    list.reduce<number | null>((min, c) => {
      const p = c.prices.cheapest?.amount;
      return p != null && (min === null || p < min) ? p : min;
    }, null);
  const from = (list: EventContext[]) => {
    const p = lowest(list);
    return p !== null ? formatPrice(p, currency) : null;
  };


  // The cheapest priced game in the next 30 days, one per league.
  const soon = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const cheapestSoon = (list: EventContext[]) =>
    list
      .filter((c) => c.prices.cheapest && new Date(c.event.startsAt).getTime() < soon)
      .sort((a, b) => a.prices.cheapest!.amount! - b.prices.cheapest!.amount!)[0];
  const deals = [nfl, nba, mls, pl, ucl]
    .map(cheapestSoon)
    .filter((c): c is EventContext => Boolean(c));

  const count = (n: number, noun: string) => `${n.toLocaleString("en-US")} ${noun}`;
  // The next six games in each league, for the tabs under the search.
  const next = (list: EventContext[]) => list.slice(0, 6).map(toFinderRow);
  const upcomingTabs: UpcomingTab[] = [
    { id: "nfl", label: "NFL", noun: "games", rows: next(nfl) },
    { id: "nba", label: "NBA", noun: "games", rows: next(nba) },
    { id: "mls", label: "MLS", noun: "games", rows: next(mls) },
    { id: "premier-league", label: "Premier League", noun: "matches", rows: next(pl) },
    { id: "champions-league", label: "Champions League", noun: "matches", rows: next(ucl) },
    { id: "formula-1", label: "Formula 1", noun: "races", rows: next(races) },
  ];

  const leagues: LeagueChoice[] = [
    { id: "nfl", title: "NFL", sport: "american-football", detail: count(nfl.length, "games"), price: from(nfl) },
    { id: "nba", title: "NBA", sport: "basketball", detail: count(nba.length, "games"), price: from(nba) },
    { id: "mls", title: "MLS", sport: "soccer", detail: count(mls.length, "games"), price: from(mls) },
    { id: "premier-league", title: "Premier League", sport: "soccer", detail: count(pl.length, "matches"), price: from(pl) },
    { id: "champions-league", title: "Champions League", sport: "soccer", detail: count(ucl.length, "matches"), price: from(ucl) },
    { id: "formula-1", title: "Formula 1", sport: "racing", detail: count(races.length, "race weekends"), price: from(races) },
  ];

  return (
    <>
      {/* 1. Search */}
      <section className="relative bg-night text-white">
        {photo?.large && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.large} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-night/90 via-night/80 to-night" />
            <PhotoCredit photo={photo} className="absolute bottom-3 right-3 z-10" />
          </>
        )}
        <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-12 text-center sm:px-6 sm:pb-20 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white/90 ring-1 ring-white/20">
            <span className="h-2 w-2 rounded-full bg-sun" aria-hidden />
            Tickets · Hotels · Flights
          </p>
          <h1 className="mt-5 text-[36px] font-extrabold leading-[1.05] sm:text-[56px]">
            <span className="inline-block">The game.</span>{" "}
            <span className="inline-block">The trip.</span>{" "}
            <span className="inline-block text-sun">For less.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/80 sm:text-[18px]">
            Compare every ticket site for the NFL, NBA, MLS, Premier League, Champions League
            and Formula&nbsp;1, then add the cheapest hotel and flight for the same dates. Your
            whole trip, priced in one place.
          </p>
          <div className="mx-auto mt-8 max-w-xl text-left">
            <SiteSearch large />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[14px]">
            <span className="text-white/60">Popular:</span>
            {POPULAR.map(([q, href]) => (
              <Link
                key={q}
                href={href}
                className="rounded-full bg-white/10 px-3.5 py-1.5 font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white hover:text-ink"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* 2. How it works, at a glance */}
      <section className="border-b border-line bg-surface">
        <h2 className="sr-only">How it works</h2>
        <ol className="mx-auto grid max-w-6xl gap-5 px-5 py-6 sm:grid-cols-3 sm:px-6">
          <Step n={1} title="Find your game">
            Search a team, or pick a league below.
          </Step>
          <Step n={2} title="Compare every ticket site">
            Every site&apos;s price side by side, cheapest first.
          </Step>
          <Step n={3} title="Add the trip">
            The cheapest hotel and flight for the same dates, all added up.
          </Step>
        </ol>
      </section>

      {/* 3. Leagues */}
      <section className="mx-auto max-w-6xl px-5 pt-12 sm:px-6">
        <h2 className="text-[26px] font-extrabold sm:text-[30px]">Choose a league</h2>
        <p className="mt-1 text-ink-3">Every game this season, with the cheapest ticket on each.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((c) => (
            <LeagueCard key={c.id} choice={c} />
          ))}
        </div>
      </section>

      {/* 4. The next games, one tab per league */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-6">
        <h2 className="text-[26px] font-extrabold sm:text-[30px]">Coming up</h2>
        <p className="mt-1 text-ink-3">The next games in each league, with the cheapest ticket on each.</p>
        <div className="mt-5">
          <UpcomingGames tabs={upcomingTabs} currency={currency} />
        </div>
      </section>

      {/* 5. Cheapest game this month in each league */}
      {deals.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-6">
          <h2 className="text-[26px] font-extrabold sm:text-[30px]">Cheapest game this month</h2>
          <p className="mt-1 text-ink-3">One per league, in the next 30 days.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((c) => (
              <GameCard key={c.event.id} context={c} />
            ))}
          </div>
        </section>
      )}

      {/* 6. Questions */}
      <section className="mx-auto max-w-3xl px-5 pt-16 sm:px-6">
        <h2 className="text-[26px] font-extrabold sm:text-[30px]">Questions</h2>
        <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-semibold">
                {q}
                <span aria-hidden className="text-[20px] text-ink-3 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

const POPULAR: [string, string][] = [
  ["Lakers", "/teams/nba-lal"],
  ["Knicks", "/teams/nba-ny"],
  ["Chiefs", "/teams/nfl-kc"],
  ["Arsenal", "/teams/arsenal"],
  ["Inter Miami", "/teams/mls-mia"],
];

const FAQ: [string, string][] = [
  [
    "Where do the prices come from?",
    "From each ticket site's own listings for that game. We show the cheapest single ticket each site listed when we checked, and the date we checked. We never estimate a price: if we couldn't read a site's price, we say so and link to it.",
  ],
  [
    "Do the prices include fees?",
    "For NFL, NBA and MLS games, yes: every price shown includes the site's fees (taxes and delivery may be extra). Where a site adds fees at checkout, we label it. Each game page lists what every site charges.",
  ],
  [
    "Do I buy tickets from Spotlight?",
    "No. You tap through and buy directly on the ticket site, under its own guarantee. Spotlight never handles your payment.",
  ],
  [
    "Why can the price change when I click?",
    "Ticket prices move all the time as seats sell. Some sites update on the game page every 15 minutes; others are from our last check. Always confirm the final price before you pay.",
  ],
];

type Sport = "american-football" | "basketball" | "soccer" | "racing";

interface LeagueChoice {
  id: string;
  title: string;
  sport: Sport;
  detail: string;
  price: string | null;
}

function LeagueCard({ choice: c }: { choice: LeagueChoice }) {
  return (
    <Link
      href={`/leagues/${c.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
    >
      <span
        aria-hidden
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white"
        style={{ backgroundColor: LEAGUE_COLORS[c.id] }}
      >
        <SportIcon sport={c.sport} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[18px] font-bold leading-tight">{c.title}</span>
        <span className="block text-[14px] text-ink-3">{c.detail}</span>
        {c.price && (
          <span className="mt-0.5 block text-[14px] font-semibold text-positive">From {c.price}</span>
        )}
      </span>
      <Arrow />
    </Link>
  );
}

function Arrow() {
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 shrink-0 place-items-center lg:hidden rounded-full bg-surface-2 text-ink-2 transition-colors group-hover:bg-accent group-hover:text-white"
    >
      →
    </span>
  );
}

/** Simple line icons, one per sport (no league logos). */
function SportIcon({ sport }: { sport: Sport }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (sport) {
    case "american-football":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="9.5" ry="5.5" transform="rotate(-35 12 12)" />
          <path d="M9.5 14.5l5-5M10.8 11.2l2 2M12.2 9.8l2 2M9.4 12.6l2 2" />
        </svg>
      );
    case "basketball":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8" />
        </svg>
      );
    case "soccer":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8l3 2.2-1.2 3.6h-3.6L9 10.2zM12 8V3.5M15 10.2l4.2-1.4M13.8 13.8l2.6 3.6M10.2 13.8l-2.6 3.6M9 10.2L4.8 8.8" />
        </svg>
      );
    case "racing":
      return (
        <svg {...common}>
          <path d="M5 21V4" />
          <path d="M5 4h13l-2.5 4.5L18 13H5" />
          <path d="M9 4v9M13 4v9M5 8.5h13" />
        </svg>
      );
  }
}


function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent font-display text-[16px] font-extrabold text-white">
        {n}
      </span>
      <span className="block">
        <span className="block font-display text-[16px] font-bold">{title}</span>
        <span className="block text-[14px] text-ink-3">{children}</span>
      </span>
    </li>
  );
}
