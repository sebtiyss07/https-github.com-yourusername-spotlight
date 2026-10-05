import Link from "next/link";
import type { Metadata } from "next";
import { convertUsd, getEventContexts, getUpcomingEvents } from "@/lib/repositories";
import { savedHotelFor } from "@/lib/providers/livePrices";
import { getCurrency } from "@/lib/currency";
import { dateParts, formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Trips under your budget",
  description: "Games where the cheapest ticket plus a hotel for the stay fit your budget, cheapest first.",
};

const BUDGETS = [200, 300, 500, 800, 1200];
const LEAGUES = [
  { id: "", label: "All" },
  { id: "nfl", label: "NFL" },
  { id: "nba", label: "NBA" },
  { id: "mls", label: "MLS" },
  { id: "premier-league", label: "Premier League" },
  { id: "champions-league", label: "Champions League" },
];

/**
 * "What can I do for $300?": every upcoming game whose cheapest ticket plus
 * the cheapest hotel for its stay (Booking.com, one person) fits the budget.
 * Travel isn't included; it depends on where you start (see each game).
 */
export default async function TripsPage({ searchParams }: { searchParams: Promise<{ budget?: string; league?: string }> }) {
  const q = await searchParams;
  const budget = BUDGETS.includes(Number(q.budget)) ? Number(q.budget) : 300;
  const league = LEAGUES.some((l) => l.id === q.league) ? (q.league as string) : "";
  const currency = await getCurrency();
  const events = (await getUpcomingEvents()).filter((e) => e.sportId !== "motorsport" && (!league || e.leagueId === league));
  const contexts = await getEventContexts(events);

  const trips = contexts
    .flatMap((c) => {
      const ticket = c.prices.cheapest?.amount;
      // A price with fees still to come can't promise a budget.
      if (ticket == null || !c.venue || c.prices.cheapest?.fees.included === "no") return [];
      const hotel = savedHotelFor(c.event.id, c.venue.country);
      if (!hotel) return [];
      const hotelPrice = convertUsd(hotel.total, c.prices.currency);
      const total = Math.round((ticket + hotelPrice) * 100) / 100;
      return total <= budget ? [{ c, ticket, hotel, hotelPrice, total }] : [];
    })
    .sort((a, b) => a.total - b.total);
  const money = (n: number) => formatPrice(n, currency);
  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
      on ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-2 hover:border-accent hover:text-accent"
    }`;
  const href = (b: number, l: string) => `/trips?${new URLSearchParams({ budget: String(b), ...(l ? { league: l } : {}) })}`;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <h1 className="text-[30px] font-extrabold leading-tight sm:text-[38px]">What can I do for {money(budget)}?</h1>
      <p className="mt-2 text-ink-3">
        Games where the cheapest ticket plus a hotel near the stadium fit your budget, for one person, cheapest
        first. Getting there isn&apos;t included: add your flight or train on the game&apos;s page.
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className="text-ink-3">Budget</span>
          {BUDGETS.map((b) => (
            <Link key={b} href={href(b, league)} className={chip(b === budget)} aria-current={b === budget ? "true" : undefined}>
              {money(b)}
            </Link>
          ))}
        </div>
        <div className="no-scrollbar mt-2 flex items-center gap-2 overflow-x-auto text-[14px]">
          <span className="shrink-0 text-ink-3">League</span>
          {LEAGUES.map((l) => (
            <Link key={l.id || "all"} href={href(budget, l.id)} className={chip(l.id === league)}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-5 text-[15px] text-ink-2">
        <span className="font-semibold text-ink">{trips.length.toLocaleString("en-US")} trips</span> under {money(budget)}
        {trips[0] && <>, from {money(trips[0].total)}</>}.
      </p>

      {trips.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line-bright bg-surface px-5 py-8 text-center text-ink-2">
          Nothing fits yet. Try a bigger budget or another league.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {trips.slice(0, 40).map(({ c, ticket, hotel, hotelPrice, total }) => {
            const { weekday, day, month } = dateParts(c.event.startsAt, c.venue?.timeZone ?? "UTC");
            return (
              <li key={c.event.id}>
                <Link
                  href={`/events/${c.event.id}#trip`}
                  className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-line text-center">
                    <span className="w-full bg-accent py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{month}</span>
                    <span className="font-display text-[19px] font-semibold leading-tight">{day}</span>
                    <span className="pb-0.5 text-[10px] font-medium text-ink-3">{weekday}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-accent">{c.title}</p>
                    <p className="truncate text-[13px] text-ink-3">
                      {c.venue?.name}, {c.venue?.city}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-2">
                      Ticket {money(ticket)} on {c.prices.cheapest?.label} + hotel {money(hotelPrice)} ({hotel.nights}{" "}
                      {hotel.nights === 1 ? "night" : "nights"}, {hotel.name})
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-ink-3">trip from</p>
                    <p className="tabular text-[18px] font-extrabold leading-tight text-positive">{money(total)}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-[13px] text-ink-3">
        Ticket prices are each site&apos;s cheapest single ticket; hotel prices are Booking.com&apos;s cheapest for the
        stay, before local taxes, from our latest check. Confirm on the booking sites before you pay.
      </p>
    </div>
  );
}
