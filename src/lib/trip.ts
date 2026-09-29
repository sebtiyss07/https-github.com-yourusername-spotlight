import type {
  SportEvent,
  StayOption,
  TicketListing,
  TravelOption,
  TripEstimate,
  Venue,
} from "@/lib/domain/types";
import { searchStays, searchTickets, searchTravel } from "@/lib/providers";
import type { ProviderResult } from "@/lib/providers/types";
import { displayBreakdown, multiplyMoney, sumMoney } from "@/lib/money";
import { addDays, localDate } from "@/lib/dates";
import { adultsPerRoom } from "@/lib/providers/expedia";

/**
 * Trip assembly — the product's actual thesis.
 *
 * Every existing site answers one third of the question. This puts the ticket,
 * the journey, and the bed on one line and gives you the number that decides
 * whether you go: what it costs to be in that seat.
 */

export interface TripOptions {
  event: SportEvent;
  venue: Venue;
  /** Free-text origin. Empty means "tickets only" — no travel leg is priced. */
  origin: string;
  travellers: number;
  nights: number;
}

export interface TripResult {
  estimate: TripEstimate;
  tickets: TicketListing[];
  travel: TravelOption[];
  stays: StayOption[];
  ticketSources: string[];
  /** Non-fatal provider failures, surfaced quietly rather than thrown. */
  notices: string[];
  /** How much the priciest listing exceeds the cheapest, as a percentage. */
  spreadPct: number;
  /** Saving vs. buying the same seat quality at the most expensive marketplace. */
  savingVsWorst: number;
  /**
   * True when the ticket prices are modelled rather than fetched from a real
   * marketplace. The UI must say so — quoting a seeded price as if it were a
   * live quote is the one thing this product cannot do.
   */
  ticketsSynthetic: boolean;
  /** Same, for the flight and hotel prices. */
  travelSynthetic: boolean;
  staysSynthetic: boolean;
  /** Local calendar dates: fly out and check in; fly home and check out. */
  dates: { checkIn: string; checkOut: string };
  rooms: number;
}

/**
 * The cost breakdown exactly as the UI renders it.
 *
 * Shared by the event page and the `/dev-audit` reconciliation so the two can't
 * disagree about what "the total" means. Every part is rounded to whole units
 * first and the total is their sum, which guarantees the visible column adds up
 * — see `displayBreakdown`.
 */
export function tripBreakdown(estimate: TripEstimate, travellers: number) {
  return displayBreakdown([
    {
      label: "Tickets",
      value: estimate.ticket
        ? multiplyMoney(estimate.ticket.total, travellers)
        : null,
    },
    { label: "Flight", value: estimate.travel?.price ?? null },
    {
      label: "Hotel",
      value: estimate.stay
        ? multiplyMoney(estimate.stay.pricePerNight, estimate.nights * roomsFor(travellers))
        : null,
    },
  ]);
}

/** Two people to a room; an odd one out gets their own. */
export function roomsFor(travellers: number): number {
  return adultsPerRoom(travellers).length;
}

/**
 * The trip's calendar, in the venue's own time zone.
 *
 * The last night booked is the night of the game — you sleep there after it —
 * so you check out, and fly home, the morning after. Check-in (and the flight
 * out) is `nights` before that. With one night, that's game day itself.
 *
 * The previous version checked in the day *before* the game and counted
 * forward, so a one-night stay checked out on the morning of an evening game.
 *
 * Check-in never lands in the past: for a game in two days, "3 nights"
 * becomes 2, and `nights` in the result is the number actually booked.
 */
export function tripDates(
  event: SportEvent,
  venue: Venue,
  nights: number,
  now: Date = new Date(),
) {
  const gameDay = localDate(event.startsAt, venue.timeZone);
  const today = localDate(now.toISOString(), venue.timeZone);
  const checkOut = addDays(gameDay, 1);
  const wanted = addDays(checkOut, -nights);
  const checkIn = wanted < today ? today : wanted;
  return { checkIn, checkOut, nights: daysBetween(checkIn, checkOut) };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export async function buildTrip(options: TripOptions): Promise<TripResult> {
  const { event, venue, origin, travellers, nights } = options;
  const dates = tripDates(event, venue, nights);
  const rooms = roomsFor(travellers);

  const wantsTravel = origin.trim().length > 0;

  const [ticketResult, travelResult, stayResult] = await Promise.all([
    searchTickets({ eventId: event.id, quantity: travellers }),
    wantsTravel
      ? searchTravel({
          origin,
          destinationAirport: venue.nearestAirport,
          arriveBy: event.startsAt,
          departOn: dates.checkIn,
          returnOn: dates.checkOut,
          passengers: travellers,
        })
      : Promise.resolve<ProviderResult<TravelOption>>({
          items: [],
          sources: [],
          errors: [],
          fetchedAt: "",
        }),
    searchStays({
      destination: `${venue.name}, ${venue.city}`,
      lat: venue.lat,
      lon: venue.lon,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      guests: travellers,
    }),
  ]);

  const tickets = ticketResult.items;
  const travel = travelResult.items;
  const stays = stayResult.items;

  const cheapestTicket = tickets[0] ?? null;
  const cheapestTravel = travel[0] ?? null;
  // The headline stay is an actual hotel. Hostels and private rentals are
  // often cheaper, but pricing "the hotel" off a hostel bunk isn't the trip
  // anyone pictured; they're still listed as alternatives.
  const cheapestStay = stays.find((s) => s.kind === "hotel") ?? stays[0] ?? null;

  // The total is exactly ticket + flight + hotel — the three things shown on
  // the page. An extra "local transport" line was dropped: a fourth, estimated
  // component made the headline number harder to follow than it was worth.
  //
  // Deliberately not coerced. If the ticket is priced in GBP and the flight in
  // USD, there is no honest single figure, and `sumMoney` returns null rather
  // than inventing one. See `lib/money.ts`.
  const { total, currencies } = sumMoney([
    cheapestTicket ? multiplyMoney(cheapestTicket.total, travellers) : null,
    cheapestTravel?.price ?? null,
    cheapestStay
      ? multiplyMoney(cheapestStay.pricePerNight, dates.nights * rooms)
      : null,
  ]);

  // Spread is computed within a comparable seat band, not across the whole
  // range — quoting "prices vary 900%" by comparing the upper deck to
  // courtside would be true and useless.
  // When seat quality is known, compare within a quality band. When it isn't
  // (live providers reporting aggregates), fall back to comparing like-named
  // sections — "cheapest available" against "cheapest available" — which is the
  // same idea expressed with the only signal those providers give us.
  const comparable = !cheapestTicket
    ? []
    : cheapestTicket.seatQuality !== null
      ? tickets.filter(
          (t) =>
            t.seatQuality !== null &&
            Math.abs(t.seatQuality - cheapestTicket.seatQuality!) <= 8,
        )
      : tickets.filter((t) => t.section === cheapestTicket.section);
  const cheapestComparable = comparable[0]?.total.amount ?? 0;
  const dearestComparable =
    comparable.length > 0
      ? Math.max(...comparable.map((t) => t.total.amount))
      : 0;

  const spreadPct =
    cheapestComparable > 0
      ? Math.round(((dearestComparable - cheapestComparable) / cheapestComparable) * 100)
      : 0;

  const notices = [
    ...ticketResult.errors,
    ...travelResult.errors,
    ...stayResult.errors,
  ]
    // Unconfigured providers are the expected steady state and stay quiet.
    // Everything else surfaces — including hard failures like a rejected key,
    // which is the exact case that must never degrade silently.
    .filter((e) => !e.silent)
    .map((e) => `${e.provider}: ${e.message}`);

  return {
    estimate: {
      eventId: event.id,
      ticket: cheapestTicket,
      travel: cheapestTravel,
      stay: cheapestStay,
      nights: dates.nights,
      total,
      totalCurrencies: currencies,
    },
    tickets,
    travel,
    stays,
    ticketSources: ticketResult.sources,
    notices,
    spreadPct,
    savingVsWorst: dearestComparable - cheapestComparable,
    ticketsSynthetic: ticketResult.synthetic !== false,
    travelSynthetic: travelResult.synthetic !== false,
    staysSynthetic: stayResult.synthetic !== false,
    dates,
    rooms,
  };
}
