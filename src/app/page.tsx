import Link from "next/link";
import {
  allInPrice,
  convertUsd,
  getEventContexts,
  getEventsByLeague,
  getLeaguePhoto,
  type EventContext,
} from "@/lib/repositories";
import { savedHotelFor } from "@/lib/providers/livePrices";
import { getCurrency } from "@/lib/currency";
import { PhotoCredit } from "@/components/ui";
import { TripPlanner } from "@/components/TripPlanner";
import { LEAGUE_COLORS } from "@/components/GameCard";
import { dateParts, formatPrice } from "@/lib/format";

/**
 * Home, organised top to bottom, one job per section:
 * 1. Plan a trip (who, from where, budget) or tap a popular one.
 * 2. Why trust it, in one line.
 * 3. Trips this month: the best-value whole trip in each league.
 * 4. Browse by league.
 * 5. More ways to plan (budget, two games, near me).
 * 6. Short answers.
 */
export default async function HomePage() {
  const [pl, ucl, races, nfl, nba, mls, photo, currency] = await Promise.all([
    getEventsByLeague("premier-league").then(getEventContexts),
    getEventsByLeague("champions-league").then(getEventContexts),
    getEventsByLeague("formula-1").then(getEventContexts),
    getEventsByLeague("nfl").then(getEventContexts),
    getEventsByLeague("nba").then(getEventContexts),
    getEventsByLeague("mls").then(getEventContexts),
    getLeaguePhoto("premier-league"),
    getCurrency(),
  ]);
  const money = (n: number) => formatPrice(n, currency);

  // The cheapest ticket (fees included) in each league, for the league tiles.
  const lowest = (list: EventContext[]) =>
    list.reduce<number | null>((min, c) => {
      const p = allInPrice(c);
      return p != null && (min === null || p < min) ? p : min;
    }, null);

  // The best-value whole trip (ticket + hotel, one person) in each league,
  // in the next 30 days.
  const soon = Date.now() + 30 * 864e5;
  const bestTrip = (list: EventContext[]): Trip | null => {
    let best: Trip | null = null;
    for (const c of list) {
      if (!c.venue || Date.parse(c.event.startsAt) > soon) continue;
      const ticket = allInPrice(c);
      const hotel = savedHotelFor(c.event.id, c.venue.country);
      if (ticket === null || !hotel) continue;
      const hotelPrice = convertUsd(hotel.total, c.prices.currency);
      const total = Math.round((ticket + hotelPrice) * 100) / 100;
      if (!best || total < best.total) best = { c, ticket, hotel: hotelPrice, nights: hotel.nights, total };
    }
    return best;
  };
  const trips = [nfl, nba, pl, ucl, mls, races].map(bestTrip).filter((t): t is Trip => t !== null);

  const leagues: LeagueChoice[] = [
    { id: "nfl", title: "NFL", sport: "american-football", price: lowest(nfl) },
    { id: "nba", title: "NBA", sport: "basketball", price: lowest(nba) },
    { id: "premier-league", title: "Premier League", sport: "soccer", price: lowest(pl) },
    { id: "champions-league", title: "Champions League", sport: "soccer", price: lowest(ucl) },
    { id: "mls", title: "MLS", sport: "soccer", price: lowest(mls) },
    { id: "formula-1", title: "Formula 1", sport: "racing", price: lowest(races) },
  ];

  return (
    <>
      {/* 1. Plan a trip */}
      <section className="relative bg-night text-white">
        {photo?.large && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.large} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-night/90 via-night/80 to-night" />
            <PhotoCredit photo={photo} className="absolute bottom-3 right-3 z-10" />
          </>
        )}
        <div className="relative mx-auto max-w-4xl px-5 pb-14 pt-12 text-center sm:px-6 sm:pb-16 sm:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white/90 ring-1 ring-white/20">
            <span className="h-2 w-2 rounded-full bg-sun" aria-hidden />
            Sports trips, priced in one place
          </p>
          <h1 className="mt-5 text-[38px] font-extrabold leading-[1.05] sm:text-[58px]">
            <span className="inline-block">The game.</span> <span className="inline-block">The trip.</span>{" "}
            <span className="inline-block text-sun">For less.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/80 sm:text-[19px]">
            Tell us who you want to see and where you&apos;re coming from. We price the ticket, the hotel and the
            flight in one total.
          </p>
          <div className="mx-auto mt-8 max-w-3xl">
            <TripPlanner currencySymbol={currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$"} />
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

      {/* 2. Why trust it */}
      <section className="border-b border-line bg-surface">
        <ul className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-4 text-[14px] font-semibold text-ink-2 sm:flex-row sm:justify-center sm:gap-10 sm:px-6">
          {["Ticket prices from up to 9 sites, checked daily", "Fees shown, never hidden", "Free · no sign-up · you book direct"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-positive text-[11px] text-white">
                ✓
              </span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Trips this month */}
      {trips.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-12 sm:px-6">
          <SectionTitle title="Trips this month" text="The best-value trip in each league: ticket and hotel for one person, before flights." />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t) => (
              <TripCard key={t.c.event.id} trip={t} money={money} />
            ))}
          </div>
          <p className="mt-4 text-center">
            <Link href="/trips" className="text-[15px] font-bold text-accent hover:underline">
              See every trip →
            </Link>
          </p>
        </section>
      )}

      {/* 4. Browse by league */}
      <section className="mx-auto max-w-6xl px-5 pt-14 sm:px-6">
        <SectionTitle title="Browse by league" text="Every game this season, with the cheapest ticket on each." />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {leagues.map((l) => (
            <Link
              key={l.id}
              href={`/leagues/${l.id}`}
              className="group flex flex-col items-center gap-2 rounded-xl border border-line bg-surface p-4 text-center transition-colors hover:border-accent"
            >
              <span aria-hidden className="grid h-11 w-11 place-items-center rounded-lg text-white" style={{ backgroundColor: LEAGUE_COLORS[l.id] }}>
                <SportIcon sport={l.sport} />
              </span>
              <span className="font-display text-[15px] font-semibold leading-tight group-hover:text-accent">{l.title}</span>
              {l.price !== null && <span className="text-[13px] font-semibold text-positive">Tickets from {money(l.price)}</span>}
            </Link>
          ))}
        </div>
      </section>

      {/* 5. More ways to plan */}
      <section className="mx-auto max-w-6xl px-5 pt-14 sm:px-6">
        <SectionTitle title="More ways to plan" text="No game in mind yet? Start here." />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {IDEAS.map(([href, icon, title, text]) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent"
            >
              <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-[22px]">
                {icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[16px] font-semibold leading-snug group-hover:text-accent">{title}</span>
                <span className="mt-0.5 block text-[14px] text-ink-3">{text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 6. Questions */}
      <section className="mx-auto max-w-3xl px-5 pt-14 sm:px-6">
        <SectionTitle title="Questions" />
        <div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
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

interface Trip {
  c: EventContext;
  ticket: number;
  hotel: number;
  nights: number;
  total: number;
}

function SectionTitle({ title, text }: { title: string; text?: string }) {
  return (
    <div>
      <h2 className="text-[24px] font-bold tracking-tight sm:text-[28px]">{title}</h2>
      {text && <p className="mt-1 text-[15px] text-ink-3">{text}</p>}
    </div>
  );
}

/** One ready-made trip: the game, and what it costs with a hotel. */
function TripCard({ trip: t, money }: { trip: Trip; money: (n: number) => string }) {
  const { c } = t;
  const { weekday, day, month } = dateParts(c.event.startsAt, c.venue?.timeZone ?? "UTC");
  const color = LEAGUE_COLORS[c.event.leagueId] ?? "#1d4ed8";
  // A ticket stub: the game on top, a tear line, the trip price on the stub.
  return (
    <Link href={`/events/${c.event.id}#trip`} className="group flex flex-col drop-shadow-sm transition-[filter] hover:drop-shadow-md">
      <span className="pass-top flex flex-1 flex-col rounded-t-xl bg-surface">
        <span className="h-1.5 rounded-t-xl" style={{ backgroundColor: color }} />
        <span className="flex items-center justify-between px-4 pt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {c.league?.shortName ?? c.league?.name}
          </span>
          <span>
            {weekday} {day} {month}
          </span>
        </span>
        <span className="flex flex-1 flex-col px-4 pb-4 pt-2">
          <span className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight group-hover:text-accent">{c.title}</span>
          <span className="mt-0.5 truncate text-[13px] text-ink-3">
            📍 {c.venue?.name}, {c.venue?.city}
          </span>
          <span className="mt-auto pt-3 text-[12px] text-ink-3">
            🎟️ {money(t.ticket)} · 🏨 {money(t.hotel)} ({t.nights} {t.nights === 1 ? "night" : "nights"})
          </span>
        </span>
      </span>
      <span className="bg-surface">
        <span className="pass-tear block" />
      </span>
      <span className="pass-stub flex items-center justify-between gap-3 rounded-b-xl bg-surface px-4 pb-4 pt-3">
        <span>
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">Trip from</span>
          <span className="tabular block text-[26px] font-bold leading-none tracking-tight text-ink">{money(t.total)}</span>
        </span>
        <span className="shrink-0 rounded-lg bg-accent px-3 py-2 text-[14px] font-semibold text-white transition-colors group-hover:bg-accent-2">
          Plan trip <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </span>
    </Link>
  );
}

const IDEAS: [string, string, string, string][] = [
  ["/trips", "💸", "Trips under your budget", "Every game where the ticket and hotel fit what you want to spend."],
  ["/two-games", "🎟️", "Two games, one trip", "Two games close together on back-to-back days."],
  ["/near-me", "📍", "Games near me", "Everything within driving distance, cheapest first."],
];

// Straight to priced trips.
const POPULAR: [string, string][] = [
  ["Lakers", "/trips?team=nba-lal"],
  ["Chiefs", "/trips?team=nfl-kc"],
  ["Arsenal", "/trips?team=arsenal"],
  ["Knicks", "/trips?team=nba-ny"],
  ["Formula 1", "/trips?league=formula-1"],
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
  price: number | null;
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


