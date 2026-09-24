import type { TravelOption } from "@/lib/domain/types";
import { resolveOrigin } from "@/lib/providers/geo";
import { isValidMoney, money } from "@/lib/money";
import type {
  ProviderResult,
  TravelProvider,
  TravelQuery,
} from "@/lib/providers/types";

/**
 * Amadeus Flight Offers Search adapter.
 *
 * Enabled by `AMADEUS_CLIENT_ID` + `AMADEUS_CLIENT_SECRET` (free self-serve
 * sandbox at developers.amadeus.com).
 *
 * The thing this adapter does that a generic flight search doesn't: **filter on
 * arriving before kick-off**. Amadeus searches by departure date, so a naive
 * integration happily returns the cheapest flight that lands two hours after
 * the match started. Every offer here is checked against the event's start time
 * and discarded if it doesn't get you there in time — with a buffer, because
 * landing fifteen minutes before kick-off is not getting there in time.
 *
 * Sandbox caveat: `test.api.amadeus.com` serves a cached subset of real data.
 * Sparse or missing results for a route are expected there and not a bug. Point
 * `AMADEUS_ENV=production` at the live host once you have production access.
 */

const HOSTS = {
  test: "https://test.api.amadeus.com",
  production: "https://api.amadeus.com",
} as const;

/** Land at least this long before the event, allowing for immigration and transit. */
const MIN_BUFFER_HOURS = 3;

/** Don't offer flights landing absurdly early — that's a different trip. */
const MAX_BUFFER_HOURS = 36;

interface TokenState {
  token: string;
  /** Epoch ms. */
  expiresAt: number;
}

/**
 * Amadeus tokens last ~30 minutes and re-authenticating per request would
 * burn the rate limit for nothing. Process-local: each serverless instance
 * holds its own, which is fine — worst case is one extra auth call per cold
 * start. Move to a shared cache if that ever gets expensive.
 */
let tokenState: TokenState | null = null;

/** ISO 8601 duration (`PT11H30M`) → minutes. */
export function parseIsoDuration(value: string | undefined): number {
  if (!value) return 0;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(value);
  if (!match) return 0;
  const [, days, hours, minutes] = match;
  return (
    Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0)
  );
}

/** `YYYY-MM-DD` in UTC, which is what the departureDate parameter expects. */
function toDateOnly(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

interface AmadeusSegment {
  departure?: { iataCode?: string; at?: string };
  arrival?: { iataCode?: string; at?: string };
  carrierCode?: string;
  duration?: string;
}

interface AmadeusOffer {
  id: string;
  price?: { grandTotal?: string; total?: string; currency?: string };
  validatingAirlineCodes?: string[];
  itineraries?: { duration?: string; segments?: AmadeusSegment[] }[];
}

interface AmadeusResponse {
  data?: AmadeusOffer[];
  dictionaries?: { carriers?: Record<string, string> };
}

export class AmadeusProvider implements TravelProvider {
  readonly name = "amadeus";
  readonly synthetic = false;

  private readonly host: string;

  constructor(
    private readonly clientId = process.env.AMADEUS_CLIENT_ID,
    private readonly clientSecret = process.env.AMADEUS_CLIENT_SECRET,
    private readonly fetchImpl: typeof fetch = fetch,
    env: keyof typeof HOSTS = (process.env.AMADEUS_ENV as keyof typeof HOSTS) ??
      "test",
  ) {
    this.host = HOSTS[env] ?? HOSTS.test;
  }

  get enabled(): boolean {
    return Boolean(this.clientId?.trim() && this.clientSecret?.trim());
  }

  async search(query: TravelQuery): Promise<ProviderResult<TravelOption>> {
    const fetchedAt = new Date().toISOString();

    if (!this.enabled) {
      return {
        items: [],
        sources: [],
        errors: [
          {
            provider: this.name,
            message: "AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET not set",
            retryable: false,
            silent: true,
          },
        ],
        fetchedAt,
      };
    }

    const origin = resolveOrigin(query.origin);
    if (!origin || origin.iata === query.destinationAirport) {
      // Unresolvable origin, or already local — no leg to price.
      return { items: [], sources: [], errors: [], fetchedAt };
    }

    let token: string;
    try {
      token = await this.getToken();
    } catch (error) {
      return {
        items: [],
        sources: [],
        errors: [
          {
            provider: this.name,
            message: `auth failed — ${error instanceof Error ? error.message : "unknown"}`,
            // Bad credentials need a human; a network blip may not.
            retryable: !(error instanceof Error && error.message.includes("401")),
          },
        ],
        fetchedAt,
      };
    }

    const arriveBy = Date.parse(query.arriveBy);

    // Amadeus searches by departure date, but what matters is arrival. Query
    // both the day before and the day of — a long-haul leg departs the previous
    // day, a short hop the same morning — then filter on arrival time.
    const departureDates = [
      toDateOnly(arriveBy - 86_400_000),
      toDateOnly(arriveBy),
    ];

    const results = await Promise.all(
      departureDates.map((date) =>
        this.fetchOffers(token, origin.iata, query, date),
      ),
    );

    const errors = results.flatMap((r) => r.errors);
    const options = results
      .flatMap((r) => r.options)
      // The constraint the whole product exists for: be there before kick-off.
      .filter((option) => {
        const gapHours = (arriveBy - Date.parse(option.arrivesAt)) / 3_600_000;
        return gapHours >= MIN_BUFFER_HOURS && gapHours <= MAX_BUFFER_HOURS;
      });

    // Both queries can surface the same offer; keep one per itinerary.
    const seen = new Set<string>();
    const deduped = options.filter((option) => {
      const key = `${option.carrier}:${option.departsAt}:${option.arrivesAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      items: deduped.sort((a, b) => a.price.amount - b.price.amount),
      sources: deduped.length > 0 ? ["Amadeus"] : [],
      errors,
      fetchedAt,
    };
  }

  private async getToken(): Promise<string> {
    // 60s of slack so a token can't expire mid-flight.
    if (tokenState && Date.now() < tokenState.expiresAt - 60_000) {
      return tokenState.token;
    }

    const response = await this.fetchImpl(
      `${this.host}/v1/security/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId!,
          client_secret: this.clientSecret!,
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!body.access_token) throw new Error("no access_token in response");

    tokenState = {
      token: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 1799) * 1000,
    };
    return tokenState.token;
  }

  private async fetchOffers(
    token: string,
    originIata: string,
    query: TravelQuery,
    departureDate: string,
  ): Promise<{ options: TravelOption[]; errors: ProviderResult<never>["errors"] }> {
    const url = new URL(`${this.host}/v2/shopping/flight-offers`);
    url.searchParams.set("originLocationCode", originIata);
    url.searchParams.set("destinationLocationCode", query.destinationAirport);
    url.searchParams.set("departureDate", departureDate);
    url.searchParams.set("adults", String(Math.max(1, query.passengers)));
    url.searchParams.set("currencyCode", "USD");
    url.searchParams.set("max", "12");

    try {
      const response = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 1800 },
      } as RequestInit);

      if (!response.ok) {
        // 400 here usually means "no such route", which is data, not a fault.
        if (response.status === 400) return { options: [], errors: [] };
        return {
          options: [],
          errors: [
            {
              provider: this.name,
              message: `flight search — HTTP ${response.status}`,
              retryable: response.status === 429 || response.status >= 500,
            },
          ],
        };
      }

      const body = (await response.json()) as AmadeusResponse;
      const carriers = body.dictionaries?.carriers ?? {};
      const offers = body.data ?? [];

      const options: TravelOption[] = [];
      const rejections: string[] = [];

      for (const offer of offers) {
        const mapped = this.toOption(offer, carriers, originIata, query);
        if ("option" in mapped) options.push(mapped.option);
        else rejections.push(mapped.rejected);
      }

      // Some rejections are normal. *Every* offer failing means the payload
      // shape isn't what this adapter expects — a mapping bug, and one that
      // must be reported rather than presented as "no flights available".
      if (offers.length > 0 && options.length === 0) {
        return {
          options: [],
          errors: [
            {
              provider: this.name,
              message: `could not parse any of ${offers.length} offers (${[...new Set(rejections)].slice(0, 3).join("; ")}) — response shape may have changed`,
              retryable: false,
            },
          ],
        };
      }

      return { options, errors: [] };
    } catch (error) {
      return {
        options: [],
        errors: [
          {
            provider: this.name,
            message: `flight search — ${error instanceof Error ? error.message : "failed"}`,
            retryable: true,
          },
        ],
      };
    }
  }

  /**
   * Maps one Amadeus offer, validating every field before trusting it.
   *
   * This mapping was written against Amadeus's documented shape, not an
   * observed payload. So rather than assume it's right, each offer is checked
   * against what a flight must actually have — a positive price in a real
   * currency, a departure before its arrival, a plausible duration — and
   * anything that fails is *discarded and reported* instead of emitted.
   *
   * The failure mode this prevents is the dangerous one. An unvalidated mapping
   * bug doesn't crash: it quietly produces `$0` or `NaN` or a flight arriving
   * before it departs, and that flows straight into the trip total as a
   * confident wrong number. Better to show no flights and say the provider
   * returned something unexpected.
   */
  private toOption(
    offer: AmadeusOffer,
    carriers: Record<string, string>,
    originIata: string,
    query: TravelQuery,
  ): { option: TravelOption } | { rejected: string } {
    const itinerary = offer.itineraries?.[0];
    const segments = itinerary?.segments ?? [];
    if (segments.length === 0) return { rejected: "no segments" };

    const first = segments[0];
    const last = segments[segments.length - 1];
    const departsRaw = first.departure?.at;
    const arrivesRaw = last.arrival?.at;

    if (!departsRaw || !arrivesRaw) return { rejected: "missing departure/arrival time" };

    const departsMs = Date.parse(departsRaw);
    const arrivesMs = Date.parse(arrivesRaw);
    if (!Number.isFinite(departsMs) || !Number.isFinite(arrivesMs)) {
      return { rejected: `unparseable times (${departsRaw} → ${arrivesRaw})` };
    }
    if (arrivesMs <= departsMs) {
      return { rejected: "arrival is not after departure" };
    }

    const raw = offer.price?.grandTotal ?? offer.price?.total;
    const amount = Number(raw);
    const price = money(amount * 100, offer.price?.currency ?? "USD");
    if (!isValidMoney(price)) {
      return { rejected: `invalid price (${raw} ${offer.price?.currency ?? "?"})` };
    }

    // Trust the stated duration only if it agrees with the timestamps; fall
    // back to the timestamps otherwise. A mismatch means one of them is wrong.
    const elapsedMinutes = Math.round((arrivesMs - departsMs) / 60_000);
    const statedMinutes = parseIsoDuration(itinerary?.duration);
    const durationMinutes =
      statedMinutes > 0 && Math.abs(statedMinutes - elapsedMinutes) <= 120
        ? statedMinutes
        : elapsedMinutes;

    // A commercial flight under 20 minutes or over two days is a parsing bug,
    // not an itinerary.
    if (durationMinutes < 20 || durationMinutes > 2880) {
      return { rejected: `implausible duration (${durationMinutes}min)` };
    }

    const carrierCode =
      offer.validatingAirlineCodes?.[0] ?? first.carrierCode ?? "";

    return {
      option: {
        // Amadeus quotes the total for all travellers, matching our convention.
        id: `amadeus-${offer.id}-${departsRaw}`,
        mode: "flight",
        fromCode: first.departure?.iataCode ?? originIata,
        toCode: last.arrival?.iataCode ?? query.destinationAirport,
        carrier: carriers[carrierCode] || carrierCode || "Airline",
        departsAt: new Date(departsMs).toISOString(),
        arrivesAt: new Date(arrivesMs).toISOString(),
        durationMinutes,
        stops: segments.length - 1,
        price,
        deepLink: `https://www.google.com/travel/flights?q=${first.departure?.iataCode ?? originIata}+to+${query.destinationAirport}`,
      },
    };
  }
}
