import type { League, SportId } from "@/lib/domain/types";

/**
 * What the site covers right now: the competitions we have real fixture data
 * and checked venue locations for (see `live.ts`, `uefa.ts`, `us-sports.ts`).
 *
 * Every other sport and league stays in the seed data, switched off here, so
 * bringing one back is an edit to these lines once it has a real source. The
 * repository layer applies this filter, so no page can surface anything else.
 */
export const ACTIVE_SPORTS: readonly SportId[] = ["soccer", "motorsport", "american-football", "basketball"];

const ACTIVE_LEAGUES = new Set([
  "premier-league",
  "champions-league",
  "europa-league",
  "formula-1",
  "nfl",
  "nba",
  "mls",
]);

export function isLeagueActive(league: League): boolean {
  return ACTIVE_LEAGUES.has(league.id);
}
