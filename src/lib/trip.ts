import type {
  SportEvent,
  StayOption,
  TicketListing,
  TravelOption,
  TripEstimate,
  Venue,
} from "@/lib/domain/types";
import { searchStays, searchTickets, searchTravel } from "@/lib/providers";
import { transportSurchargePerNight } from "@/lib/providers/stays/seeded";
import { displayBreakdown, money, multiplyMoney, sumMoney } from "@/lib/money";

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
}

/**
 * The cost breakdown exactly as the UI renders it.
 *
 * Shared by the event page and the `/dev-audit` reconciliation so the two can't
 * disagree about what "the total" means. Every part is rounded to whole units
 * first and the total is their sum, which guarantees the visible column adds up
 * — see `displayBreakdown`.
 */
export function tripBreakdown(
  estimate: TripEstimate,
  travellers: number,
  nights: number,
) {
  return displayBreakdown([
    {
      label: "Tickets",
      value: estimate.ticket
        ? multiplyMoney(estimate.ticket.total, travellers)
        : null,
    },
    { label: "Getting there", value: estimate.travel?.price ?? null },
    {
      label: "Stay",
      value: estimate.stay
        ? multiplyMoney(estimate.stay.pricePerNight, nights)
        : null,
    },
    { label: "Local transport", value: estimate.localTransport },
  ]);
}

/** Check in the day before an evening event; check out `nights` later. */
function stayWindow(event: SportEvent, nights: number) {
  const start = Date.parse(event.startsAt);
  const checkIn = new Date(start - 86_400_000);
  const checkOut = new Date(checkIn.getTime() + nights * 86_400_000);
  return { checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString() };
}

/**
 * Best value ≠ cheapest. A ticket that's 20% more for materially better seats
 * is usually the right answer, so rank by quality per dollar and let the raw
 * cheapest option stand on its own.
 */
export function bestValue(listings: TicketListing[]): TicketListing | null {
  // Only listings whose seat quality is actually known can be ranked this way.
  // Live marketplaces mostly report aggregate prices with no seat detail, so
  // rather than treat "unknown" as zero — which would bury every real listing —
  // we simply don't claim a best-value pick when nobody reports quality.
  const rankable = listings.filter(
    (l): l is TicketListing & { seatQuality: number } => l.seatQuality !== null,
  );
  if (rankable.length === 0) return null;

  return [...rankable].sort(
    (a, b) => b.seatQuality / b.total.amount - a.seatQuality / a.total.amount,
  )[0];
}

export async function buildTrip(options: TripOptions): Promise<TripResult> {
  const { event, venue, origin, travellers, nights } = options;
  const window = stayWindow(event, nights);

  const wantsTravel = origin.trim().length > 0;

  const [ticketResult, travelResult, stayResult] = await Promise.all([
    searchTickets({ eventId: event.id, quantity: travellers }),
    wantsTravel
      ? searchTravel({
          origin,
          destinationAirport: venue.nearestAirport,
          arriveBy: event.startsAt,
          passengers: travellers,
        })
      : Promise.resolve({ items: [], sources: [], errors: [], fetchedAt: "" }),
    searchStays({
      lat: venue.lat,
      lon: venue.lon,
      checkIn: window.checkIn,
      checkOut: window.checkOut,
      guests: travellers,
    }),
  ]);

  const tickets = ticketResult.items;
  const travel = travelResult.items;
  const stays = stayResult.items;

  const cheapestTicket = tickets[0] ?? null;
  const cheapestTravel = travel[0] ?? null;
  const cheapestStay = stays[0] ?? null;

  // Local transport is part of the cost of being there, so it belongs in a
  // total that claims to be everything. It's zero for a walkable stay, which is
  // the point of ranking stays the way we do. Priced in the stay's currency,
  // since that's the market it's incurred in.
  const localTransport = cheapestStay
    ? money(
        transportSurchargePerNight(cheapestStay.distanceToVenueM) * nights,
        cheapestStay.pricePerNight.currency,
      )
    : null;

  // Deliberately not coerced. If the ticket is priced in GBP and the flight in
  // USD, there is no honest single figure, and `sumMoney` returns null rather
  // than inventing one. See `lib/money.ts`.
  const { total, currencies } = sumMoney([
    cheapestTicket ? multiplyMoney(cheapestTicket.total, travellers) : null,
    cheapestTravel?.price ?? null,
    cheapestStay ? multiplyMoney(cheapestStay.pricePerNight, nights) : null,
    localTransport,
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
      nights,
      total,
      totalCurrencies: currencies,
      localTransport,
    },
    tickets,
    travel,
    stays,
    ticketSources: ticketResult.sources,
    notices,
    spreadPct,
    savingVsWorst: dearestComparable - cheapestComparable,
    ticketsSynthetic: ticketResult.synthetic !== false,
  };
}
