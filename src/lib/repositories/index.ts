import type {
  League,
  Sport,
  SportEvent,
  Team,
  Venue,
} from "@/lib/domain/types";
import { SPORTS, SPORTS_BY_ID } from "@/lib/data/sports";
import { LEAGUES, LEAGUES_BY_ID, leaguesForSport } from "@/lib/data/leagues";
import {
  TEAMS,
  TEAMS_BY_ID,
  VENUES_BY_ID,
  teamsForLeague,
} from "@/lib/data/teams";
import {
  EVENTS,
  EVENTS_BY_ID,
  eventTitle,
  eventsForLeague,
  eventsForSport,
  eventsForTeam,
} from "@/lib/data/events";

/**
 * Repository layer — the seam between the app and its storage.
 *
 * Every function is async even though the seed data is synchronous and in
 * memory. That's deliberate: when this moves to Postgres, the call signatures
 * don't change, so no page or component needs touching. The cost today is one
 * microtask; the saving later is a rewrite.
 *
 * Nothing outside this directory should import from `lib/data`.
 */

export async function getSports(): Promise<Sport[]> {
  return SPORTS;
}

export async function getSport(id: string): Promise<Sport | null> {
  return SPORTS_BY_ID.get(id as Sport["id"]) ?? null;
}

export async function getLeagues(): Promise<League[]> {
  return LEAGUES;
}

export async function getLeague(id: string): Promise<League | null> {
  return LEAGUES_BY_ID.get(id) ?? null;
}

export async function getLeaguesBySport(sportId: string): Promise<League[]> {
  // Domestic leagues first, then continental, then international tours —
  // matches how people actually navigate a sport.
  const order: Record<League["tier"], number> = {
    domestic: 0,
    continental: 1,
    international: 2,
    tour: 3,
  };
  return leaguesForSport(sportId).sort(
    (a, b) => order[a.tier] - order[b.tier] || a.name.localeCompare(b.name),
  );
}

export async function getTeams(): Promise<Team[]> {
  return TEAMS;
}

export async function getTeam(id: string): Promise<Team | null> {
  return TEAMS_BY_ID.get(id) ?? null;
}

export async function getTeamsByLeague(leagueId: string): Promise<Team[]> {
  return teamsForLeague(leagueId);
}

export async function getVenue(id: string): Promise<Venue | null> {
  return VENUES_BY_ID.get(id) ?? null;
}

export async function getEvent(id: string): Promise<SportEvent | null> {
  return EVENTS_BY_ID.get(id) ?? null;
}

/** Only events that haven't started. Everything user-facing wants this. */
function upcoming(events: SportEvent[]): SportEvent[] {
  const now = Date.now();
  return events
    .filter((e) => Date.parse(e.startsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export async function getUpcomingEvents(limit?: number): Promise<SportEvent[]> {
  const events = upcoming(EVENTS);
  return limit ? events.slice(0, limit) : events;
}

export async function getEventsBySport(
  sportId: string,
  limit?: number,
): Promise<SportEvent[]> {
  const events = upcoming(eventsForSport(sportId));
  return limit ? events.slice(0, limit) : events;
}

/**
 * True counts, deliberately separate from the list queries above.
 *
 * Pages show a capped slice for readability, and reporting `list.length` as
 * the count turns a display limit into a fabricated statistic — every sport
 * claiming "15+ events" because 15 is the limit, not because that's the number.
 */
export async function countEventsBySport(sportId: string): Promise<number> {
  return upcoming(eventsForSport(sportId)).length;
}

export async function countEventsByTeam(teamId: string): Promise<{
  total: number;
  home: number;
  away: number;
}> {
  const events = upcoming(eventsForTeam(teamId));
  return {
    total: events.length,
    home: events.filter((e) => e.homeTeamId === teamId).length,
    away: events.filter((e) => e.awayTeamId === teamId).length,
  };
}

export async function getEventsByLeague(
  leagueId: string,
  limit?: number,
): Promise<SportEvent[]> {
  const events = upcoming(eventsForLeague(leagueId));
  return limit ? events.slice(0, limit) : events;
}

export async function getEventsByTeam(
  teamId: string,
  limit?: number,
): Promise<SportEvent[]> {
  const events = upcoming(eventsForTeam(teamId));
  return limit ? events.slice(0, limit) : events;
}

/** The championships and finals — what the landing page leads with. */
export async function getMarqueeEvents(limit?: number): Promise<SportEvent[]> {
  const events = upcoming(EVENTS.filter((e) => e.isMarquee));
  return limit ? events.slice(0, limit) : events;
}

export async function getMarqueeEventsBySport(
  sportId: string,
): Promise<SportEvent[]> {
  return upcoming(EVENTS.filter((e) => e.isMarquee && e.sportId === sportId));
}

/**
 * Hydrates an event with the records the UI always needs alongside it, so
 * pages don't fan out into four more awaits per row.
 */
export interface EventContext {
  event: SportEvent;
  venue: Venue | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  league: League | null;
  sport: Sport | null;
  title: string;
}

export async function getEventContext(
  event: SportEvent,
): Promise<EventContext> {
  return {
    event,
    venue: VENUES_BY_ID.get(event.venueId) ?? null,
    homeTeam: event.homeTeamId ? (TEAMS_BY_ID.get(event.homeTeamId) ?? null) : null,
    awayTeam: event.awayTeamId ? (TEAMS_BY_ID.get(event.awayTeamId) ?? null) : null,
    league: LEAGUES_BY_ID.get(event.leagueId) ?? null,
    sport: SPORTS_BY_ID.get(event.sportId) ?? null,
    title: eventTitle(event),
  };
}

export async function getEventContexts(
  events: SportEvent[],
): Promise<EventContext[]> {
  return Promise.all(events.map(getEventContext));
}

/** Free-text search across sports, leagues, teams, and events. */
export interface SearchHit {
  kind: "sport" | "league" | "team" | "event";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchResults {
  hits: SearchHit[];
  /** Total matches found, which may exceed `hits.length`. */
  total: number;
  /** True when results were capped for display. */
  truncated: boolean;
}

const SEARCH_LIMIT = 40;

export async function search(query: string): Promise<SearchResults> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return { hits: [], total: 0, truncated: false };

  const hits: SearchHit[] = [];

  for (const s of SPORTS) {
    if (s.name.toLowerCase().includes(q)) {
      hits.push({
        kind: "sport",
        id: s.id,
        title: s.name,
        subtitle: "Sport",
        href: `/sports/${s.id}`,
      });
    }
  }

  for (const l of LEAGUES) {
    if (
      l.name.toLowerCase().includes(q) ||
      l.shortName.toLowerCase().includes(q)
    ) {
      hits.push({
        kind: "league",
        id: l.id,
        title: l.name,
        subtitle: `${l.region} · League`,
        href: `/leagues/${l.id}`,
      });
    }
  }

  for (const t of TEAMS) {
    if (
      t.name.toLowerCase().includes(q) ||
      t.shortName.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q)
    ) {
      hits.push({
        kind: "team",
        id: t.id,
        title: t.name,
        subtitle: `${t.city} · Team`,
        href: `/teams/${t.id}`,
      });
    }
  }

  for (const e of upcoming(EVENTS)) {
    const title = eventTitle(e);
    if (title.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)) {
      hits.push({
        kind: "event",
        id: e.id,
        title,
        subtitle: e.isMarquee ? "Championship event" : "Fixture",
        href: `/events/${e.id}`,
      });
    }
  }

  // Sports and leagues first — they're navigational, events are the long tail.
  const rank: Record<SearchHit["kind"], number> = {
    sport: 0,
    league: 1,
    team: 2,
    event: 3,
  };
  const ordered = hits.sort((a, b) => rank[a.kind] - rank[b.kind]);

  return {
    hits: ordered.slice(0, SEARCH_LIMIT),
    total: ordered.length,
    truncated: ordered.length > SEARCH_LIMIT,
  };
}
