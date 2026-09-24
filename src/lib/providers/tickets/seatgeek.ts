import type { TicketListing } from "@/lib/domain/types";
import { getEvent, getEventContext, getVenue } from "@/lib/repositories";
import { isValidMoney } from "@/lib/money";
import {
  bestMatch,
  expectedFor,
  searchKeyword,
  ResolutionCache,
  type EventCandidate,
} from "@/lib/providers/tickets/matching";
import type {
  ProviderResult,
  TicketProvider,
  TicketQuery,
} from "@/lib/providers/types";

/**
 * SeatGeek adapter.
 *
 * Enabled by `SEATGEEK_CLIENT_ID` (register at seatgeek.com/account/develop).
 *
 * SeatGeek is a genuine step up from Ticketmaster Discovery for our purposes:
 * its `stats` block reports the lowest *and* average price plus a live listing
 * count, which is real market depth rather than a static min/max range. It's
 * still not seat-level — no "section 112, row 8" — and full inventory access is
 * a partner agreement, not a signup.
 *
 * Matching reuses `matching.ts`, so SeatGeek inherits the same hard gates that
 * stop a wrong-date or wrong-teams result being priced as this fixture.
 */

const API_ROOT = "https://api.seatgeek.com/2";

/**
 * SeatGeek's `stats.*_price` fields exclude fees on the standard API tier, and
 * their checkout fees land around a quarter of face value. This is an estimate
 * and the UI labels it as one — never present it as a quote.
 *
 * If your account is provisioned for all-in pricing, set this to 0 rather than
 * double-charging the user in the comparison.
 */
const ESTIMATED_FEE_RATE = 0.25;

interface SgApiEvent {
  id: number;
  title: string;
  short_title?: string;
  url?: string;
  /** SeatGeek omits the trailing Z; it is nonetheless UTC. */
  datetime_utc?: string;
  venue?: { name?: string };
  stats?: {
    lowest_price?: number | null;
    average_price?: number | null;
    highest_price?: number | null;
    listing_count?: number | null;
    visible_listings_count?: number | null;
  };
}

interface SgCandidate extends EventCandidate {
  stats?: SgApiEvent["stats"];
}

export interface SgResolution {
  candidate: SgCandidate | null;
  confidence: number;
  reason: string;
  failed: boolean;
}

/** `2026-10-23T19:00:00` → a parseable UTC instant. */
function toUtcIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
}

/** SeatGeek's date filters use the same naive-UTC format it returns. */
function toSgDate(date: Date): string {
  return date.toISOString().split(".")[0];
}

const CACHE = new ResolutionCache<SgResolution>();

export class SeatGeekProvider implements TicketProvider {
  readonly name = "seatgeek";
  readonly synthetic = false;

  constructor(
    private readonly clientId = process.env.SEATGEEK_CLIENT_ID,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get enabled(): boolean {
    return Boolean(this.clientId && this.clientId.trim().length > 0);
  }

  async search(query: TicketQuery): Promise<ProviderResult<TicketListing>> {
    const fetchedAt = new Date().toISOString();
    const clientId = this.clientId;

    if (!clientId) {
      return {
        items: [],
        sources: [],
        errors: [
          {
            provider: this.name,
            message: "SEATGEEK_CLIENT_ID is not set",
            retryable: false,
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

    const resolution = await this.resolve(event.id, async () =>
      this.lookup(
        clientId,
        searchKeyword(event, context),
        event.startsAt,
        expectedFor(event, {
          homeTeam: context.homeTeam,
          awayTeam: context.awayTeam,
          venue,
        }),
      ),
    );

    if (!resolution.candidate) {
      // "Not listed" is the normal case for most of our catalogue and stays
      // quiet. A transport failure is an operational problem and must not.
      return {
        items: [],
        sources: [],
        errors: resolution.failed
          ? [
              {
                provider: this.name,
                message: `lookup failed — ${resolution.reason}`,
                retryable: !resolution.reason.includes("403"),
              },
            ]
          : [],
        fetchedAt,
      };
    }

    const items = this.toListings(resolution.candidate, query);

    return {
      items:
        query.maxTotal === undefined
          ? items
          : items.filter((l) => l.total.amount <= query.maxTotal!),
      sources: ["SeatGeek"],
      errors: [],
      fetchedAt,
    };
  }

  /** Caches successful resolutions only — a transient failure must not stick. */
  private async resolve(
    eventId: string,
    compute: () => Promise<SgResolution>,
  ): Promise<SgResolution> {
    const cached = CACHE.get(eventId);
    if (cached && !cached.failed) return cached;

    const result = await compute();
    if (!result.failed) CACHE.set(eventId, result);
    return result;
  }

  private async lookup(
    clientId: string,
    keyword: string,
    startsAt: string,
    expected: ReturnType<typeof expectedFor>,
  ): Promise<SgResolution> {
    const start = Date.parse(startsAt);

    const url = new URL(`${API_ROOT}/events`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("q", keyword);
    // ±2 days, deliberately wider than the 48h match gate: better to fetch a
    // candidate and reject it than to miss it over a timezone slip.
    url.searchParams.set(
      "datetime_utc.gte",
      toSgDate(new Date(start - 2 * 86_400_000)),
    );
    url.searchParams.set(
      "datetime_utc.lte",
      toSgDate(new Date(start + 2 * 86_400_000)),
    );
    url.searchParams.set("per_page", "25");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);

    try {
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        next: { revalidate: 900 },
      } as RequestInit);

      if (!response.ok) {
        return {
          candidate: null,
          confidence: 0,
          reason: `HTTP ${response.status}`,
          failed: true,
        };
      }

      const body = (await response.json()) as { events?: SgApiEvent[] };

      const candidates: SgCandidate[] = (body.events ?? []).map((e) => ({
        id: String(e.id),
        name: e.title,
        url: e.url,
        startsAt: toUtcIso(e.datetime_utc),
        venueName: e.venue?.name,
        stats: e.stats,
      }));

      const match = bestMatch(candidates, expected);

      return {
        candidate: (match.candidate as SgCandidate) ?? null,
        confidence: match.confidence,
        reason: match.reason,
        failed: false,
      };
    } catch (error) {
      return {
        candidate: null,
        confidence: 0,
        reason: error instanceof Error ? error.message : "request failed",
        failed: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Maps SeatGeek's price statistics into listings.
   *
   * Emits the cheapest and the typical seat. The `highest_price` is skipped
   * deliberately — it's routinely a suite or a single mispriced outlier, and
   * carrying it would distort the "spread across sites" figure the event page
   * leads with.
   *
   * Sections are named for what the number *is*, because inventing "Lower Bowl,
   * Row 12" from an aggregate statistic would be fabricating detail the API
   * never returned.
   */
  private toListings(
    candidate: SgCandidate,
    query: TicketQuery,
  ): TicketListing[] {
    const stats = candidate.stats;
    const lowest = stats?.lowest_price;
    if (!lowest || lowest <= 0) return [];

    // SeatGeek reports USD for its US/CA inventory.
    const currency = "USD";
    const available =
      stats?.visible_listings_count ?? stats?.listing_count ?? null;

    const build = (value: number, section: string): TicketListing | null => {
      const price = Math.round(value * 100);
      const priceMoney = { amount: price, currency };
      if (!isValidMoney(priceMoney)) return null;

      const fees = Math.round(price * ESTIMATED_FEE_RATE);
      return {
        id: `sg-${candidate.id}-${section.replace(/\s+/g, "-").toLowerCase()}`,
        eventId: query.eventId,
        marketplace: "seatgeek",
        section,
        // Report the requested quantity when SeatGeek gives no count, so this
        // isn't filtered out on invented availability.
        quantityAvailable: available ?? Math.max(query.quantity, 1),
        price: { amount: price, currency },
        fees: { amount: fees, currency },
        total: { amount: price + fees, currency },
        // Standard-tier stats are pre-fee, so this total is an estimate.
        feesEstimated: ESTIMATED_FEE_RATE > 0,
        // These are aggregate statistics across the whole listing pool, not
        // specific seats — there is no view quality to report.
        seatQuality: null,
        isResale: true,
        deepLink: candidate.url ?? "https://seatgeek.com",
      };
    };

    const listings = [build(lowest, "Cheapest listed")];

    const average = stats?.average_price;
    if (average && average > lowest) {
      listings.push(build(average, "Typical seat"));
    }

    return listings.filter((l): l is TicketListing => l !== null);
  }
}
