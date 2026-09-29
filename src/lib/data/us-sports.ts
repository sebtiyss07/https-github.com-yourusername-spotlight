import type { SportEvent, SportId, Team, Venue } from "@/lib/domain/types";
import schedules from "./us-schedules.json";
import usVenues from "./us-venues.json";

/**
 * NFL, NBA and MLS: every club and every scheduled game, from ESPN's public
 * scoreboard data (snapshot written by scripts/fetch-us-schedules.mjs — re-run
 * it to pick up schedule changes such as NFL flex games).
 *
 * Stadium coordinates come from Wikidata, one checked item per venue, and each
 * venue's airport is the nearest large one in the same country (OurAirports).
 * See us-venues.json. Games whose teams aren't decided yet ("TBD" playoff
 * slots) are left out until they are.
 */

export const US_LEAGUES = {
  nfl: { sportId: "american-football" as SportId, prefix: "nfl" },
  nba: { sportId: "basketball" as SportId, prefix: "nba" },
  mls: { sportId: "soccer" as SportId, prefix: "mls" },
} as const;
type UsLeague = keyof typeof US_LEAGUES;

interface Side {
  id?: string;
  name?: string;
  abbr?: string;
}
interface Game {
  league: UsLeague;
  id: string;
  date: string;
  seasonType?: string;
  neutral: boolean;
  home: Side;
  away: Side;
  venue: { name?: string };
}
interface EspnTeam {
  league: UsLeague;
  id: string;
  abbr: string;
  name: string;
  shortName: string;
  color?: string;
  alternateColor?: string;
}
interface VenueRow {
  name: string;
  /** Current name, where ESPN still uses a former one (e.g. Reliant → NRG Stadium). */
  displayName?: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  timeZone: string;
  nearestAirport: string;
}

const games = (schedules as { games: Game[] }).games;
const espnTeams = (schedules as { teams: EspnTeam[] }).teams;
const venueRows = (usVenues as { venues: Record<string, VenueRow> }).venues;

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const venueId = (name: string) => `us-${slug(name)}`;
const teamId = (league: UsLeague, abbr: string) => `${league}-${abbr.toLowerCase()}`;

export const US_VENUES: Venue[] = Object.values(venueRows).map((v) => ({
  id: venueId(v.name),
  name: v.displayName ?? v.name,
  city: v.city,
  country: v.country,
  lat: v.lat,
  lon: v.lon,
  nearestAirport: v.nearestAirport,
  timeZone: v.timeZone,
}));
// Keyed by ESPN's name, which is what the schedule refers to.
const VENUE_BY_NAME = new Map(
  Object.keys(venueRows).map((key, i) => [key, US_VENUES[i]]),
);

const playable = games.filter(
  (g) => g.home.abbr && g.away.abbr && g.home.abbr !== "TBD" && g.away.abbr !== "TBD" && g.venue.name,
);

/** A club's home ground: where most of its non-neutral home games are played. */
function homeVenue(league: UsLeague, abbr: string): Venue | undefined {
  const counts = new Map<string, number>();
  for (const g of playable) {
    if (g.league !== league || g.home.abbr !== abbr || g.neutral) continue;
    counts.set(g.venue.name!, (counts.get(g.venue.name!) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  return top ? VENUE_BY_NAME.get(top[0].toLowerCase()) : undefined;
}

export const US_TEAMS: Team[] = espnTeams.flatMap((t) => {
  const venue = homeVenue(t.league, t.abbr);
  // A club with no home game left on the schedule has nothing to plan a
  // trip to, so it isn't listed.
  if (!venue) return [];
  return [
    {
      id: teamId(t.league, t.abbr),
      leagueId: t.league,
      sportId: US_LEAGUES[t.league].sportId,
      name: t.name,
      shortName: t.shortName,
      abbreviation: t.abbr,
      city: venue.city,
      country: venue.country,
      venueId: venue.id,
      primaryColor: `#${t.color ?? "333333"}`,
      secondaryColor: `#${t.alternateColor ?? "ffffff"}`,
    },
  ];
});

export const US_EVENTS: SportEvent[] = playable.flatMap((g) => {
  const venue = VENUE_BY_NAME.get(g.venue.name!.toLowerCase());
  if (!venue) return [];
  const { sportId, prefix } = US_LEAGUES[g.league];
  return [
    {
      id: `${prefix}-${g.id}`,
      sportId,
      leagueId: g.league,
      kind: g.seasonType === "post-season" ? "playoff" : "fixture",
      name: `${g.away.name} at ${g.home.name}`,
      startsAt: g.date,
      venueId: venue.id,
      homeTeamId: teamId(g.league, g.home.abbr!),
      awayTeamId: teamId(g.league, g.away.abbr!),
      demandScore: 0,
      isMarquee: false,
    },
  ];
});

export const US_SCHEDULE_FETCHED_AT = (schedules as { fetchedAt: string }).fetchedAt;
