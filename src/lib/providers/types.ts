import type {
  Money,
  StayOption,
  TicketListing,
  TravelOption,
} from "@/lib/domain/types";

/**
 * The integration boundary.
 *
 * Everything above this line (pages, components, repositories) is written
 * against these interfaces only. Everything below it is a swappable adapter.
 * Adding SeatGeek or Amadeus means writing one new file that satisfies one of
 * these interfaces and registering it in `providers/index.ts` — no page,
 * component, or type outside this directory changes.
 *
 * Adapters must never throw. A provider that is down, rate-limited, or missing
 * credentials returns an empty result and reports it via `ProviderResult.errors`,
 * so one bad marketplace can't take down the comparison for the others.
 */

export interface ProviderResult<T> {
  items: T[];
  /** Which adapters answered, for the "prices from N sites" line in the UI. */
  sources: string[];
  /** Non-fatal failures, surfaced as a quiet notice rather than an exception. */
  errors: ProviderError[];
  /** When the underlying data was fetched. Drives cache headers and staleness UI. */
  fetchedAt: string;
  /**
   * True when every item came from a synthetic (seeded) adapter. The UI must
   * label synthetic pricing rather than presenting it as a real quote.
   * Set by the registry, not by individual adapters.
   */
  synthetic?: boolean;
}

export interface ProviderError {
  provider: string;
  message: string;
  /** True when a retry might succeed (timeout, 429) vs. a hard config problem. */
  retryable: boolean;
  /**
   * True only for "this provider isn't configured" — the expected state for
   * every integration you haven't signed up for yet, and not worth showing a
   * user.
   *
   * Everything else is worth surfacing, including non-retryable failures: an
   * *invalid* key is precisely the case that must not pass quietly, or the site
   * downgrades to modelled prices with nobody the wiser.
   */
  silent?: boolean;
}

export interface TicketQuery {
  eventId: string;
  quantity: number;
  /** Cap on total price per ticket, in minor units. */
  maxTotal?: number;
}

export interface TravelQuery {
  /** Free-text origin the user typed, e.g. "Paris" or "JFK". */
  origin: string;
  /** IATA of the airport nearest the venue. */
  destinationAirport: string;
  /** ISO date the traveller needs to arrive by. */
  arriveBy: string;
  returnOn?: string;
  passengers: number;
}

export interface StayQuery {
  /** Venue coordinates — stays are ranked by walking distance to the gate. */
  lat: number;
  lon: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  maxPerNight?: Money;
}

/**
 * Common adapter metadata.
 *
 * `synthetic` is the important one. A seeded adapter always has inventory, so
 * without this flag its invented $92 listing would sit next to a real $180
 * Ticketmaster quote and win the "cheapest" sort — presenting fiction as the
 * best price. The registry uses it to suppress synthetic results for any event
 * a real provider could answer for.
 */
interface ProviderMeta {
  readonly name: string;
  /** False when credentials are absent, so the registry can skip it silently. */
  readonly enabled: boolean;
  /** True for seeded/modelled data, false for a real marketplace. */
  readonly synthetic: boolean;
}

export interface TicketProvider extends ProviderMeta {
  search(query: TicketQuery): Promise<ProviderResult<TicketListing>>;
}

export interface TravelProvider extends ProviderMeta {
  search(query: TravelQuery): Promise<ProviderResult<TravelOption>>;
}

export interface StayProvider extends ProviderMeta {
  search(query: StayQuery): Promise<ProviderResult<StayOption>>;
}

/** Merges results from many adapters, preserving partial success. */
export function mergeResults<T>(
  results: ProviderResult<T>[],
): ProviderResult<T> {
  return {
    items: results.flatMap((r) => r.items),
    sources: [...new Set(results.flatMap((r) => r.sources))],
    errors: results.flatMap((r) => r.errors),
    fetchedAt: new Date().toISOString(),
  };
}

/** Wraps an adapter call so a rejected promise becomes a reported error. */
export async function safely<T>(
  provider: string,
  fn: () => Promise<ProviderResult<T>>,
): Promise<ProviderResult<T>> {
  try {
    return await fn();
  } catch (error) {
    return {
      items: [],
      sources: [],
      errors: [
        {
          provider,
          message: error instanceof Error ? error.message : "Unknown failure",
          retryable: true,
        },
      ],
      fetchedAt: new Date().toISOString(),
    };
  }
}
