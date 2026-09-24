import type { SportEvent, SportId, Team, Venue } from "@/lib/domain/types";
import {
  bestMatch,
  expectedFor,
  searchKeyword,
  ResolutionCache,
  type EventCandidate,
} from "@/lib/providers/tickets/matching";

/**
 * Ticketmaster event resolution.
 *
 * All the matching *judgement* lives in `matching.ts` and is shared with every
 * other marketplace. This file handles only what's Ticketmaster-specific: their
 * query parameters, their response shape, and their taxonomy.
 */

const API_ROOT = "https://app.ticketmaster.com/discovery/v2";

/**
 * Ticketmaster's classification taxonomy — their vocabulary, not ours, and the
 * values their `classificationName` filter expects.
 *
 * Unverified against a live key. `npm run check:providers` prints the
 * classifications actually returned so these can be corrected against reality.
 */
const CLASSIFICATION: Partial<Record<SportId, string>> = {
  basketball: "Basketball",
  "american-football": "Football",
  soccer: "Soccer",
  baseball: "Baseball",
  "ice-hockey": "Hockey",
  tennis: "Tennis",
  golf: "Golf",
  motorsport: "Motorsports/Racing",
  cricket: "Cricket",
  "combat-sports": "Fighting",
};

export interface TmCandidate extends EventCandidate {
  priceRanges?: { currency?: string; min?: number; max?: number }[];
}

export interface ResolutionResult {
  candidate: TmCandidate | null;
  confidence: number;
  reason: string;
  /**
   * Separates "the API failed" from "this event genuinely isn't listed".
   *
   * Both yield no candidate but need opposite handling: an unlisted event is
   * the normal case for most of our catalogue and must stay silent, while a 401
   * or timeout is an operational problem someone needs told about. Collapsing
   * them would let an expired key downgrade the site in total silence.
   */
  failed: boolean;
}

export interface ResolverDeps {
  apiKey: string;
  /** Injected so the resolver is testable without hitting the network. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Discovery wants `YYYY-MM-DDTHH:mm:ssZ` — it rejects millisecond precision. */
export function toTmDate(date: Date): string {
  return `${date.toISOString().split(".")[0]}Z`;
}

interface TmApiEvent {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { dateTime?: string } };
  priceRanges?: { currency?: string; min?: number; max?: number }[];
  _embedded?: { venues?: { name?: string }[] };
}

export async function resolveEvent(
  event: SportEvent,
  context: { homeTeam: Team | null; awayTeam: Team | null; venue: Venue },
  deps: ResolverDeps,
): Promise<ResolutionResult> {
  const doFetch = deps.fetchImpl ?? fetch;

  const start = Date.parse(event.startsAt);
  const url = new URL(`${API_ROOT}/events.json`);
  url.searchParams.set("apikey", deps.apiKey);
  url.searchParams.set("keyword", searchKeyword(event, context));
  // ±2 days. Wider than the 48h match gate on purpose — better to fetch a
  // candidate and reject it than to never see it because of a timezone slip.
  url.searchParams.set("startDateTime", toTmDate(new Date(start - 2 * 86_400_000)));
  url.searchParams.set("endDateTime", toTmDate(new Date(start + 2 * 86_400_000)));
  url.searchParams.set("size", "25");

  const classification = CLASSIFICATION[event.sportId];
  if (classification) url.searchParams.set("classificationName", classification);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? 6_000);

  try {
    const response = await doFetch(url, {
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

    const body = (await response.json()) as {
      _embedded?: { events?: TmApiEvent[] };
    };

    const candidates: TmCandidate[] = (body._embedded?.events ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      url: e.url,
      startsAt: e.dates?.start?.dateTime,
      venueName: e._embedded?.venues?.[0]?.name,
      priceRanges: e.priceRanges,
    }));

    const match = bestMatch(candidates, expectedFor(event, context));

    return {
      candidate: (match.candidate as TmCandidate) ?? null,
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

const CACHE = new ResolutionCache<ResolutionResult>();

export async function resolveEventCached(
  event: SportEvent,
  context: { homeTeam: Team | null; awayTeam: Team | null; venue: Venue },
  deps: ResolverDeps,
): Promise<ResolutionResult> {
  const cached = CACHE.get(event.id);
  // Never cache a failure — a transient 500 would otherwise suppress the
  // provider for six hours.
  if (cached && !cached.failed) return cached;

  const result = await resolveEvent(event, context, deps);
  if (!result.failed) CACHE.set(event.id, result);
  return result;
}
