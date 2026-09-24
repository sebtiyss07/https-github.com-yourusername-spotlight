import type { TicketListing } from "@/lib/domain/types";
import { getEvent, getEventContext, getVenue } from "@/lib/repositories";
import { isValidMoney } from "@/lib/money";
import {
  resolveEventCached,
  type TmCandidate,
} from "@/lib/providers/tickets/ticketmasterResolver";
import type {
  ProviderResult,
  TicketProvider,
  TicketQuery,
} from "@/lib/providers/types";

/**
 * Ticketmaster Discovery API adapter.
 *
 * Enabled by setting `TICKETMASTER_API_KEY` (free, self-serve, at
 * developer.ticketmaster.com). Without it `enabled` is false and the registry
 * skips it silently — the app keeps running on seeded data.
 *
 * Two things worth understanding before you build on this:
 *
 * 1. **Matching is the hard part**, not fetching. See `ticketmasterResolver.ts`
 *    — our event ids and theirs share no key, so events are matched on
 *    participants, date, and venue, and a weak match is discarded rather than
 *    guessed at.
 *
 * 2. **Discovery returns price *ranges*, not seat listings.** You get a floor
 *    and a ceiling per event — never "section 112, row 8". This adapter is
 *    honest about that: it emits two clearly-labelled listings rather than
 *    fabricating sections and rows it doesn't have. Seat-level inventory needs
 *    the Ticketmaster partner programme or a resale API, all of which are
 *    commercial agreements rather than engineering work.
 */

/** Discovery quotes major units (dollars); we store minor units (cents). */
function toMinorUnits(value: number): number {
  return Math.round(value * 100);
}

/**
 * Published Ticketmaster service fees sit around a quarter of face value, and
 * Discovery's figures are pre-fee. This is an estimate, and it is labelled as
 * one in the UI rather than presented as a quote.
 */
const ESTIMATED_FEE_RATE = 0.27;

export class TicketmasterProvider implements TicketProvider {
  readonly name = "ticketmaster";
  /** Real inventory — never suppressed in favour of seeded data. */
  readonly synthetic = false;

  constructor(private readonly apiKey = process.env.TICKETMASTER_API_KEY) {}

  get enabled(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async search(query: TicketQuery): Promise<ProviderResult<TicketListing>> {
    const fetchedAt = new Date().toISOString();
    const apiKey = this.apiKey;

    if (!apiKey) {
      return {
        items: [],
        sources: [],
        errors: [
          {
            provider: this.name,
            message: "TICKETMASTER_API_KEY is not set",
            retryable: false,
            // Expected until someone adds a key — don't nag the user about it.
            silent: true,
          },
        ],
        fetchedAt,
      };
    }

    const event = await getEvent(query.eventId);
    if (!event) return { items: [], sources: [], errors: [], fetchedAt };

    const venue = await getVenue(event.venueId);
    if (!venue) return { items: [], sources: [], errors: [], fetchedAt };

    const context = await getEventContext(event);

    const resolution = await resolveEventCached(
      event,
      { homeTeam: context.homeTeam, awayTeam: context.awayTeam, venue },
      { apiKey },
    );

    if (!resolution.candidate) {
      // An unlisted event and a broken API key both land here, and they need
      // opposite treatment. Most of our catalogue genuinely isn't on
      // Ticketmaster (European football, F1, cricket), so "not found" must stay
      // silent or every page carries a warning. A transport failure is
      // different: without this branch an expired key would quietly downgrade
      // the whole site to modelled prices and nobody would notice.
      return {
        items: [],
        sources: [],
        errors: resolution.failed
          ? [
              {
                provider: this.name,
                message: `lookup failed — ${resolution.reason}`,
                // A 401 needs a human; a timeout may fix itself.
                retryable: !resolution.reason.includes("401"),
              },
            ]
          : [],
        fetchedAt,
      };
    }

    const items = this.toListings(
      resolution.candidate,
      query.eventId,
      query.quantity,
    );

    return {
      items:
        query.maxTotal === undefined
          ? items
          : items.filter((l) => l.total.amount <= query.maxTotal!),
      sources: ["Ticketmaster"],
      errors: [],
      fetchedAt,
    };
  }

  /**
   * Maps a resolved Discovery event into our listing shape.
   *
   * Sections are named for what they are — a price bound — because inventing
   * "Lower Bowl, Row 12" from a price range would be fabricating detail the API
   * never returned.
   */
  private toListings(
    candidate: TmCandidate,
    eventId: string,
    quantity: number,
  ): TicketListing[] {
    const range = candidate.priceRanges?.[0];
    if (!range?.min) return [];

    const currency = range.currency ?? "USD";

    const build = (value: number, section: string): TicketListing | null => {
      const price = toMinorUnits(value);
      const priceMoney = { amount: price, currency };
      // Guard the boundary: a shape change or bad payload surfaces as NaN or a
      // negative, and "$0.00" reads to a user as a bargain, not as broken code.
      if (!isValidMoney(priceMoney)) return null;

      const fees = Math.round(price * ESTIMATED_FEE_RATE);
      return {
        id: `tm-${candidate.id}-${section.replace(/\s+/g, "-").toLowerCase()}`,
        eventId,
        marketplace: "ticketmaster",
        section,
        // Discovery doesn't expose remaining inventory. Reporting the requested
        // quantity keeps it out of the availability filter rather than
        // inventing a count.
        quantityAvailable: Math.max(quantity, 1),
        price: { amount: price, currency },
        fees: { amount: fees, currency },
        total: { amount: price + fees, currency },
        // Discovery quotes pre-fee. This total is an estimate and says so.
        feesEstimated: true,
        // Discovery reports a price range, not seats — there is nothing here to
        // derive a view quality from, so we don't pretend there is.
        seatQuality: null,
        isResale: false,
        deepLink: candidate.url ?? "https://www.ticketmaster.com",
      };
    };

    const listings = [build(range.min, "Cheapest available")];
    if (range.max && range.max > range.min) {
      listings.push(build(range.max, "Best available"));
    }
    return listings.filter((l): l is TicketListing => l !== null);
  }
}
