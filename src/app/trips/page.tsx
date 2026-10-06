import { localDate } from "@/lib/dates";
import Link from "next/link";
import type { Metadata } from "next";
import { convertUsd, getEventContexts, getTeam, getUpcomingEvents } from "@/lib/repositories";
import { cheapestFlight, savedHotelFor } from "@/lib/providers/livePrices";
import { AIRPORTS_BY_IATA, flightSearchCode, resolveOrigin } from "@/lib/providers/geo";
import { flightLinks } from "@/lib/providers/travelLinks";
import { CityInput } from "@/components/CityInput";
import { getCurrency } from "@/lib/currency";
import { dateParts, formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Plan your trip",
  description: "Games where the cheapest ticket, a hotel for the stay and the flight from your city fit your budget, cheapest first.",
};

/** 0 = any budget. */
const BUDGETS = [0, 200, 300, 500, 800, 1200];
const LEAGUES = [
  { id: "", label: "All" },
  { id: "nfl", label: "NFL" },
  { id: "nba", label: "NBA" },
  { id: "mls", label: "MLS" },
  { id: "premier-league", label: "Premier League" },
  { id: "champions-league", label: "Champions League" },
  { id: "formula-1", label: "Formula 1" },
];

/** How many of the cheapest ticket + hotel trips get a flight looked up. */
const FLIGHT_CANDIDATES = 40;

/**
 * "What can I do for $300?": every upcoming game whose cheapest ticket plus
 * the cheapest hotel for its stay (Booking.com, one person) fits the budget.
 * With a home city, the round-trip flight for the same nights is added too,
 * and only trips whose whole total is known and fits are listed.
 */
export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ budget?: string; league?: string; from?: string; team?: string }>;
}) {
  const q = await searchParams;
  const team = q.team ? await getTeam(q.team.slice(0, 80)) : null;
  const from = q.from?.slice(0, 60).trim() ?? "";
  const origin = from ? resolveOrigin(from) : null;
  // A team or a city without a budget: show every trip, cheapest first.
  const budget = q.budget !== undefined && BUDGETS.includes(Number(q.budget)) ? Number(q.budget) : team || from ? 0 : 300;
  const cap = budget || Infinity;
  const league = LEAGUES.some((l) => l.id === q.league) ? (q.league as string) : "";
  const currency = await getCurrency();
  const events = (await getUpcomingEvents()).filter(
    (e) =>
      (!league || e.leagueId === league) &&
      (!team || e.homeTeamId === team.id || e.awayTeamId === team.id),
  );
  const contexts = await getEventContexts(events);

  const groundTrips = contexts
    .flatMap((c) => {
      const ticket = c.prices.cheapest?.amount;
      // A price with fees still to come can't promise a budget.
      if (ticket == null || !c.venue || c.prices.cheapest?.fees.included !== "yes") return [];
      const hotel = savedHotelFor(c.event.id, c.venue.country);
      if (!hotel) return [];
      const hotelPrice = convertUsd(hotel.total, c.prices.currency);
      const total = Math.round((ticket + hotelPrice) * 100) / 100;
      return total <= cap ? [{ c, ticket, hotel, hotelPrice, total, flight: null as null | { price: number; label: string } }] : [];
    })
    .sort((a, b) => a.total - b.total);

  // With a home city: the exact-date round-trip fare for the same nights as
  // the hotel, looked up for the cheapest candidates. Where a fare is known
  // it's added and the trip must still fit; where none has been found yet the
  // trip stays listed (ticket + hotel), marked, after the whole-trip ones.
  const lookedUp = !origin
    ? groundTrips
    : [...await Promise.all(
        groundTrips.slice(0, FLIGHT_CANDIDATES).map(async (t, i) => {
          const dest = AIRPORTS_BY_IATA.get(t.c.venue!.nearestAirport);
          if (!dest) return t;
          const fromCode = flightSearchCode(origin);
          const toCode = flightSearchCode(dest);
          if (fromCode === toCode) return { ...t, flight: { price: 0, label: "no flight needed" } };
          // Leaving today is too late to fly in: no fare for that trip.
          if (t.hotel.checkIn <= localDate(new Date().toISOString(), t.c.venue!.timeZone)) return t;
          const trip = { from: fromCode, to: toCode, departOn: t.hotel.checkIn, returnOn: t.hotel.checkOut, adults: 1 };
          // Live Google Flights fares for the cheapest few only, to stay within the search plan.
          const fare = await cheapestFlight({ ...trip, bookUrl: flightLinks(trip)[0]?.url ?? "https://www.expedia.com/Flights", live: i < 5 });
          if (fare.status !== "ok") return t;
          const price = convertUsd(fare.quote.perPerson, currency);
          return { ...t, flight: { price, label: `${fromCode} → ${toCode}, ${fare.quote.airline}` }, total: Math.round((t.total + price) * 100) / 100 };
        }),
      ), ...groundTrips.slice(FLIGHT_CANDIDATES)];
  const trips = lookedUp
    .filter((t) => t.total <= cap)
    .sort((a, b) => (origin ? Number(!a.flight) - Number(!b.flight) : 0) || a.total - b.total);
  const whole = trips.filter((t) => t.flight).length;
  const money = (n: number) => formatPrice(n, currency);
  const budgetLabel = (b: number) => (b ? `Under ${money(b)}` : "Any budget");
  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
      on ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-2 hover:border-accent hover:text-accent"
    }`;
  const href = (b: number, l: string, withFrom = true, withTeam = true) =>
    `/trips?${new URLSearchParams({
      budget: String(b),
      ...(l ? { league: l } : {}),
      ...(origin && withFrom ? { from } : {}),
      ...(team && withTeam ? { team: team.id } : {}),
    })}`;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <h1 className="text-[30px] font-extrabold leading-tight sm:text-[38px]">
        {team ? `Trips to see ${team.name}` : budget ? `What can I do for ${money(budget)}?` : "Plan your trip"}
      </h1>
      <p className="mt-2 text-ink-3">
        The whole trip for one person, cheapest first: the cheapest ticket, a hotel near the stadium and, with
        your city, the round-trip flight for the same nights.
      </p>
      {team && (
        <p className="mt-3 text-[14px]">
          <Link href={href(budget, league, true, false)} className="font-semibold text-accent hover:underline">
            ← Every team
          </Link>
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <form method="get" action="/trips" className="mb-3 flex items-center gap-2 text-[14px]">
          <input type="hidden" name="budget" value={budget} />
          {league && <input type="hidden" name="league" value={league} />}
          {team && <input type="hidden" name="team" value={team.id} />}
          <span className="w-14 shrink-0 text-ink-3">From</span>
          <CityInput
            name="from"
            defaultValue={origin ? from : ""}
            placeholder="Your city (adds the flight)"
            ariaLabel="Travelling from"
            submitOnPick
            className="min-w-0 flex-1"
            inputClassName="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-[15px] outline-none placeholder:text-ink-3 focus:border-accent focus:bg-surface"
          />
          {origin && (
            <Link href={href(budget, league, false)} className="shrink-0 text-ink-3 hover:text-accent">
              Clear
            </Link>
          )}
        </form>
        {from && !origin && (
          <p className="mb-3 text-[13px] text-hot">We couldn&apos;t find an airport for &ldquo;{from}&rdquo;. Pick a city from the list.</p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className="text-ink-3">Budget</span>
          {BUDGETS.map((b) => (
            <Link key={b} href={href(b, league)} className={chip(b === budget)} aria-current={b === budget ? "true" : undefined}>
              {budgetLabel(b)}
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
        {origin ? (
          <>
            <span className="font-semibold text-ink">
              {whole.toLocaleString("en-US")} whole {whole === 1 ? "trip" : "trips"}
            </span>{" "}
            from {origin.city}{" "}
            {budget ? <>under {money(budget)}, </> : null}flight included{whole > 0 && <>, from {money(trips[0].total)}</>}.
            <span className="block text-[13px] text-ink-3">
              Below them, {(trips.length - whole).toLocaleString("en-US")} more where the ticket and hotel fit but we
              don&apos;t have a flight fare for those dates: tap one to see live fares from {origin.city}.
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold text-ink">{trips.length.toLocaleString("en-US")} trips</span>
            {budget ? <> under {money(budget)}</> : null}
            {trips[0] && <>, from {money(trips[0].total)}</>}.
          </>
        )}
      </p>

      {trips.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line-bright bg-surface px-5 py-8 text-center text-ink-2">
          Nothing fits yet. Try a bigger budget or another league.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {trips.slice(0, 40).map(({ c, ticket, hotel, hotelPrice, total, flight }) => {
            const { weekday, day, month } = dateParts(c.event.startsAt, c.venue?.timeZone ?? "UTC");
            return (
              <li key={c.event.id}>
                <Link
                  href={`/events/${c.event.id}${origin ? `?${new URLSearchParams({ origin: origin.city })}` : ""}#trip`}
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
                      {origin &&
                        (flight ? (
                          flight.price === 0 ? <> · {flight.label}</> : <> + flight {money(flight.price)} ({flight.label})</>
                        ) : (
                          <span className="text-ink-3"> · flight: see live fares</span>
                        ))}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-ink-3">{origin && !flight ? "before flight" : "trip from"}</p>
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
        stay, before taxes, from our latest check{origin ? "; flights are the cheapest round-trip fare found for those exact dates, per person" : ""}. Confirm on the booking sites before you pay.
      </p>
    </div>
  );
}
