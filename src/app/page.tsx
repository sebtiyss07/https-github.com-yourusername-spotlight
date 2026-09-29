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
import { GameCard as EventCard, LEAGUE_COLORS } from "@/components/GameCard";
import { formatPrice } from "@/lib/format";

/**
 * Home: one clear path, top to bottom.
 * 1. Search a team, or pick a competition (with its lowest real price).
 * 2. How it works, in three steps.
 * 3. The cheapest game this month in each league.
 * 4. The next F1 races.
 */
export default async function HomePage() {
  const [pl, ucl, uel, races, nfl, nba, mls, photo] = await Promise.all([
    getEventsByLeague("premier-league").then(getEventContexts),
    getEventsByLeague("champions-league").then(getEventContexts),
    getEventsByLeague("europa-league").then(getEventContexts),
    getEventsByLeague("formula-1").then(getEventContexts),
    getEventsByLeague("nfl").then(getEventContexts),
    getEventsByLeague("nba").then(getEventContexts),
    getEventsByLeague("mls").then(getEventContexts),
    getLeaguePhoto("premier-league"),
  ]);

  const currency = pl[0]?.prices.currency ?? nfl[0]?.prices.currency ?? "USD";
  const lowest = (list: EventContext[]) =>
    list.reduce<number | null>((min, c) => {
      const p = c.prices.cheapest?.amount;
      return p != null && (min === null || p < min) ? p : min;
    }, null);
  const from = (list: EventContext[], noun = "Tickets") => {
    const p = lowest(list);
    return p !== null ? `${noun} from ${formatPrice(p, currency)}` : null;
  };

  // The cheapest priced game in the next 30 days, one per league.
  const soon = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const cheapestSoon = (list: EventContext[]) =>
    list
      .filter((c) => c.prices.cheapest && new Date(c.event.startsAt).getTime() < soon)
      .sort((a, b) => a.prices.cheapest!.amount! - b.prices.cheapest!.amount!)[0];
  const deals = [nfl, nba, mls, pl, ucl, uel]
    .map(cheapestSoon)
    .filter((c): c is EventContext => Boolean(c));

  const us: LeagueChoice[] = [
    { href: "/leagues/nfl", title: "NFL", sport: "american-football", color: LEAGUE_COLORS["nfl"], detail: `${nfl.length} games left`, price: from(nfl) },
    { href: "/leagues/nba", title: "NBA", sport: "basketball", color: LEAGUE_COLORS["nba"], detail: `${nba.length} games left`, price: from(nba) },
    { href: "/leagues/mls", title: "MLS", sport: "soccer", color: LEAGUE_COLORS["mls"], detail: `${mls.length} games left`, price: from(mls) },
  ];
  const world: LeagueChoice[] = [
    { href: "/leagues/premier-league", title: "Premier League", sport: "soccer", color: LEAGUE_COLORS["premier-league"], detail: `${pl.length} matches left`, price: from(pl) },
    { href: "/leagues/champions-league", title: "Champions League", sport: "soccer", color: LEAGUE_COLORS["champions-league"], detail: `${ucl.length} matches left`, price: from(ucl) },
    { href: "/leagues/europa-league", title: "Europa League", sport: "soccer", color: LEAGUE_COLORS["europa-league"], detail: `${uel.length} matches left`, price: from(uel) },
    { href: "/leagues/formula-1", title: "Formula 1", sport: "racing", color: LEAGUE_COLORS["formula-1"], detail: `${races.length} races left`, price: from(races, "Weekend passes") },
  ];

  return (
    <>
      {/* 1. Search, or pick a competition */}
      <section className="relative overflow-hidden bg-[#0b0d1a] text-white">
        {photo?.large && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.large} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0b0d1a]/85 via-[#0b0d1a]/75 to-[#0b0d1a]" />
            <PhotoCredit photo={photo} className="absolute right-4 top-4 z-10" />
          </>
        )}
        <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
          <div className="text-center">
            <h1 className="mx-auto max-w-3xl text-[36px] font-semibold leading-[1.05] sm:text-[54px]">
              See the game for less.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/80">
              Every ticket site compared, cheapest first, plus the hotel and flight for the
              same dates.
            </p>
            <div className="mx-auto mt-8 max-w-xl text-left">
              <SiteSearch large />
            </div>
          </div>

          <LeagueGroup title="US sports" choices={us} columns="sm:grid-cols-3" />
          <LeagueGroup title="Football and Formula 1" choices={world} columns="sm:grid-cols-2 xl:grid-cols-4" />
        </div>
      </section>

      {/* 2. How it works */}
      <section className="border-b border-line bg-surface">
        <ol className="mx-auto grid max-w-5xl gap-6 px-5 py-10 sm:grid-cols-3 sm:px-8">
          <Step n={1} title="Pick a game or race">
            Search a team, or filter by month or budget.
          </Step>
          <Step n={2} title="Compare ticket sites">
            Every site that sells it, cheapest first.
          </Step>
          <Step n={3} title="See the whole trip">
            Ticket, flight and hotel added up for you.
          </Step>
        </ol>
      </section>

      {/* 3. Cheapest game this month in each league */}
      {deals.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <div>
            <p className="text-[13px] font-semibold text-accent">Deals</p>
            <h2 className="mt-1 text-[24px] font-semibold sm:text-[28px]">
              Cheapest game this month in each league
            </h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((c) => (
              <EventCard key={c.event.id} context={c} />
            ))}
          </div>
        </section>
      )}

      {/* 4. Next F1 races */}
      {races.length > 0 && (
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-accent">Formula 1</p>
                <h2 className="mt-1 text-[24px] font-semibold sm:text-[28px]">Next race weekends</h2>
              </div>
              <Link href="/leagues/formula-1" className="text-[14px] font-semibold text-accent hover:underline">
                All races →
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {races.slice(0, 3).map((c) => (
                <EventCard key={c.event.id} context={c} race />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

type Sport = "american-football" | "basketball" | "soccer" | "racing";



interface LeagueChoice {
  href: string;
  title: string;
  sport: Sport;
  /** The competition's colour, for its icon tile. */
  color: string;
  detail: string;
  price: string | null;
}

function LeagueGroup({ title, choices, columns }: { title: string; choices: LeagueChoice[]; columns: string }) {
  return (
    <div className="mt-10">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-white/60">{title}</h2>
      <div className={`mt-3 grid gap-3 ${columns}`}>
        {choices.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex items-center gap-3.5 rounded-2xl bg-white p-4 text-ink shadow-lg transition-transform hover:-translate-y-1"
          >
            <span
              aria-hidden
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white"
              style={{ backgroundColor: c.color }}
            >
              <SportIcon sport={c.sport} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[19px] font-semibold leading-tight">{c.title}</span>
              <span className="block text-[13px] text-ink-3">{c.detail}</span>
              {c.price && (
                <span className="mt-1 block text-[13px] font-semibold text-positive">{c.price}</span>
              )}
            </span>
            <span aria-hidden className="text-[20px] text-ink-3 transition-colors group-hover:text-accent">
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
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
    <li className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-semibold text-white">
        {n}
      </span>
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[14px] text-ink-3">{children}</span>
      </span>
    </li>
  );
}
