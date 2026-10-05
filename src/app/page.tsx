import Link from "next/link";
import type { ReactNode } from "react";
import {
  getEventContexts,
  getEventsByLeague,
  type EventContext,
} from "@/lib/repositories";
import { SiteSearch } from "@/components/SiteSearch";
import { GameCard } from "@/components/GameCard";
import { formatPrice } from "@/lib/format";

/**
 * Home: one clear path, top to bottom.
 * 1. Search a team, or tap a popular one.
 * 2. Pick a league (with its lowest real price).
 * 3. How it works, the cheapest game this month per league, the next F1 races.
 * 4. Plain answers to the questions people ask first.
 */
export default async function HomePage() {
  const [pl, ucl, races, nfl, nba, mls] = await Promise.all([
    getEventsByLeague("premier-league").then(getEventContexts),
    getEventsByLeague("champions-league").then(getEventContexts),
    getEventsByLeague("formula-1").then(getEventContexts),
    getEventsByLeague("nfl").then(getEventContexts),
    getEventsByLeague("nba").then(getEventContexts),
    getEventsByLeague("mls").then(getEventContexts),
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
      <section className="border-b border-line">
        <div className="mx-auto max-w-3xl px-5 pb-16 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24">
          <p className="text-[13px] text-ink-3">Sports ticket price comparison</p>
          <h1 className="mt-4 text-[38px] font-medium leading-[1.05] tracking-[-0.04em] text-ink sm:text-[60px]">
            The cheapest ticket to any game.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-ink-3 sm:text-[17px]">
            NFL, NBA, MLS, Premier League, Champions League and Formula&nbsp;1. Every
            ticket site&apos;s price in one list, cheapest first.
          </p>
          <div className="mx-auto mt-9 max-w-xl text-left">
            <SiteSearch large />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[14px]">
            <span className="text-ink-3">Popular</span>
            {POPULAR.map(([q, href]) => (
              <Link key={q} href={href} className="text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline">
                {q}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Leagues */}
      <section className="mx-auto max-w-6xl px-5 pt-12 sm:px-6">
        <h2 className="text-[22px] font-medium sm:text-[26px]">Choose a league</h2>
        <p className="mt-1 text-ink-3">Every game this season, with the cheapest ticket on each.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((c) => (
            <LeagueCard key={c.id} choice={c} />
          ))}
        </div>
      </section>

      {/* 3. How it works */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-6">
        <h2 className="text-[22px] font-medium sm:text-[26px]">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          <Step n={1} title="Find your game">
            Search a team or pick a league, then filter by month or budget.
          </Step>
          <Step n={2} title="See every price">
            Every ticket site that sells it, side by side, cheapest at the top.
          </Step>
          <Step n={3} title="Buy where it's cheapest">
            Tap through and buy on that site. Add a hotel and flight if you&apos;re travelling.
          </Step>
        </ol>
      </section>

      {/* 4. Cheapest game this month in each league */}
      {deals.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-6">
          <h2 className="text-[22px] font-medium sm:text-[26px]">Cheapest game this month</h2>
          <p className="mt-1 text-ink-3">One per league, in the next 30 days.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((c) => (
              <GameCard key={c.event.id} context={c} />
            ))}
          </div>
        </section>
      )}

      {/* 5. Next F1 races */}
      {races.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-medium sm:text-[26px]">Next Formula 1 weekends</h2>
              <p className="mt-1 text-ink-3">The cheapest full-weekend pass for each race.</p>
            </div>
            <Link href="/leagues/formula-1" className="font-medium text-accent hover:underline">
              All races →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {races.slice(0, 3).map((c) => (
              <GameCard key={c.event.id} context={c} race />
            ))}
          </div>
        </section>
      )}

      {/* 6. Questions */}
      <section className="mx-auto max-w-3xl px-5 pt-16 sm:px-6">
        <h2 className="text-[22px] font-medium sm:text-[26px]">Questions</h2>
        <div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-medium">
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
      className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-ink"
    >
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
        <SportIcon sport={c.sport} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium leading-tight">{c.title}</span>
        <span className="mt-0.5 block text-[13px] text-ink-3">
          {c.detail}
          {c.price && <> · from <span className="text-positive">{c.price}</span></>}
        </span>
      </span>
      <Arrow />
    </Link>
  );
}

function Arrow() {
  return (
    <span
      aria-hidden
      className="shrink-0 text-ink-3 transition-colors group-hover:text-ink lg:hidden"
    >
      →
    </span>
  );
}

/** Simple line icons, one per sport (no league logos). */
function SportIcon({ sport }: { sport: Sport }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
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
    <li className="flex gap-4 border-t border-line pt-5 sm:block">
      <span className="shrink-0 text-[13px] tabular text-ink-3">0{n}</span>
      <span className="block">
        <span className="block text-[16px] font-medium sm:mt-3">{title}</span>
        <span className="mt-1 block text-[14px] text-ink-3">{children}</span>
      </span>
    </li>
  );
}
