import type { SportEvent, Team, Venue } from "@/lib/domain/types";

/**
 * Event matching — shared by every ticket marketplace adapter.
 *
 * No marketplace shares an id with us. Our events are internal slugs
 * (`nba-3-lakers-celtics`); Ticketmaster's are `vvG1zZ9pFrNfXJ`, SeatGeek's are
 * integers. So every integration faces the same problem: given a search result,
 * is this the same fixture? And every one of them can get it wrong in the same
 * way.
 *
 * That's why this lives in one file. The gate logic below is the difference
 * between showing someone the right price and showing them prices for a game
 * they aren't attending — duplicating it per provider would duplicate its bugs.
 */

/** The normalised shape every provider maps its search results into. */
export interface EventCandidate {
  /** Provider-native id. */
  id: string;
  /** Display title, e.g. "Boston Celtics vs. Los Angeles Lakers". */
  name: string;
  /** ISO 8601. Required — an unverifiable date means no match. */
  startsAt?: string;
  venueName?: string;
  url?: string;
}

/** What we expect a genuine match to look like. */
export interface ExpectedEvent {
  teamNames: string[];
  venueName: string;
  startsAt: string;
}

/**
 * Minimum combined score to accept a match. Set high on purpose: a missing
 * price is a gap in the UI, a wrong price is a broken promise.
 */
export const MIN_CONFIDENCE = 0.62;

/** Beyond this the candidate is a different fixture, whatever else matches. */
export const MAX_HOURS_APART = 48;

/** Below this the participants don't match, whatever else matches. */
export const MIN_NAME_OVERLAP = 0.5;

/**
 * Words that appear in club names without identifying anything. Dropped before
 * comparison so "Arsenal FC" and "Arsenal" score as identical, and so shared
 * filler can't manufacture overlap between two different clubs.
 */
const STOPWORDS = new Set([
  "fc", "afc", "cf", "sc", "ac", "the", "at", "vs", "v", "and",
  "club", "united", "city", "team", "nba", "nfl", "nhl", "mlb",
]);

export function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

/** Overlap relative to the smaller set, so a verbose title isn't penalised. */
export function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / Math.min(a.size, b.size);
}

/**
 * A fixture's identity is *who* and *when*. Both must hold independently.
 *
 * A weighted sum across name/date/venue is the obvious design and it is wrong,
 * because it lets two strong signals outvote a fatal mismatch. Two cases prove
 * it, and both are in the `/dev-check` harness:
 *
 *   - Celtics vs Lakers at TD Garden, but 18 days out — name 1.00, venue 1.00,
 *     date 0.00 still sums to 0.65 and passes.
 *   - Bruins vs Canadiens at TD Garden on the right night — date 1.00, venue
 *     1.00 carries a 0.25 name score to 0.625 and passes.
 *
 * Both shipped prices for the wrong game. So date and participants are hard
 * gates; only once both clear does the weighted score rank the survivors. Venue
 * is a tiebreaker and can never carry a match alone — sponsors rename buildings
 * constantly, and neutral-site games reuse names.
 */
export function scoreCandidate(
  candidate: EventCandidate,
  expected: ExpectedEvent,
): { score: number; reason: string } {
  // Gate 1 — the right day? Fail closed when there's no date to check: an
  // unverifiable match is not a match.
  if (!candidate.startsAt) {
    return { score: 0, reason: "rejected: candidate has no start time" };
  }

  const hoursApart =
    Math.abs(Date.parse(candidate.startsAt) - Date.parse(expected.startsAt)) /
    3_600_000;

  if (!Number.isFinite(hoursApart) || hoursApart > MAX_HOURS_APART) {
    return {
      score: 0,
      reason: `rejected: ${hoursApart.toFixed(0)}h apart (max ${MAX_HOURS_APART}h)`,
    };
  }

  // Gate 2 — the same participants?
  const nameScore = overlap(
    tokenize(expected.teamNames.join(" ")),
    tokenize(candidate.name),
  );

  if (nameScore < MIN_NAME_OVERLAP) {
    return {
      score: 0,
      reason: `rejected: name overlap ${nameScore.toFixed(2)} (min ${MIN_NAME_OVERLAP})`,
    };
  }

  // Both gates cleared — rank the survivors.
  const dateScore = hoursApart <= 6 ? 1 : hoursApart <= 24 ? 0.75 : 0.35;

  const venueScore = candidate.venueName
    ? overlap(tokenize(expected.venueName), tokenize(candidate.venueName))
    : 0;

  const score = nameScore * 0.5 + dateScore * 0.35 + venueScore * 0.15;

  return {
    score,
    reason: `name ${nameScore.toFixed(2)}, date ${hoursApart.toFixed(0)}h, venue ${venueScore.toFixed(2)}`,
  };
}

export interface MatchResult {
  candidate: EventCandidate | null;
  confidence: number;
  reason: string;
}

/** Picks the best candidate, or none if nothing clears the bar. */
export function bestMatch(
  candidates: EventCandidate[],
  expected: ExpectedEvent,
): MatchResult {
  if (candidates.length === 0) {
    return { candidate: null, confidence: 0, reason: "no candidates" };
  }

  let best: MatchResult | null = null;
  for (const candidate of candidates) {
    const { score, reason } = scoreCandidate(candidate, expected);
    if (!best || score > best.confidence) {
      best = { candidate, confidence: score, reason };
    }
  }

  if (!best || best.confidence < MIN_CONFIDENCE) {
    return {
      candidate: null,
      confidence: best?.confidence ?? 0,
      reason: `below threshold (${best?.reason ?? "none"})`,
    };
  }

  return best;
}

/** Builds the expected-match description for one of our events. */
export function expectedFor(
  event: SportEvent,
  context: { homeTeam: Team | null; awayTeam: Team | null; venue: Venue },
): ExpectedEvent {
  const teamNames = [context.homeTeam?.name, context.awayTeam?.name].filter(
    (n): n is string => Boolean(n),
  );
  return {
    // Team-less events (a Grand Prix, a Grand Slam) match on their own title.
    teamNames: teamNames.length > 0 ? teamNames : [event.name],
    venueName: context.venue.name,
    startsAt: event.startsAt,
  };
}

/** The strongest single search term for a provider's keyword parameter. */
export function searchKeyword(
  event: SportEvent,
  context: { homeTeam: Team | null },
): string {
  return context.homeTeam?.name ?? event.name;
}

/**
 * Generic TTL cache for resolutions.
 *
 * Resolution is stable and costs a request; pricing is volatile and must not be
 * cached alongside it. Process-local — swap for Redis when you run more than
 * one instance.
 */
export class ResolutionCache<T> {
  private readonly store = new Map<string, { value: T; cachedAt: number }>();

  constructor(private readonly ttlMs = 6 * 60 * 60 * 1000) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.cachedAt > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, cachedAt: Date.now() });
  }
}
