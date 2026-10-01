import type { SportEvent, Venue } from "@/lib/domain/types";
import { zonedTimeToIso } from "@/lib/dates";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { F1_CIRCUITS } from "@/lib/data/tickets";
import { loadUefa } from "@/lib/data/uefa";
import { US_EVENTS } from "@/lib/data/us-sports";
import savedPremierLeague from "@/lib/data/fixtures/premier-league.json";
import savedFormula1 from "@/lib/data/fixtures/formula-1.json";

/**
 * Real fixtures, from public sources — nothing here is generated.
 *
 * - Premier League: openfootball (public domain, github.com/openfootball),
 *   2026–27 season. Kick-off times are UK local time.
 * - Formula 1: the Jolpica API (the maintained successor to Ergast),
 *   2026 calendar. Times are UTC.
 * - NFL, NBA and MLS: ESPN's public scoreboard data (us-sports.ts).
 *
 * Both are cached by Next's fetch cache and refreshed every six hours. If a
 * source can't be reached or limits us (the F1 API answered HTTP 429 on
 * 1 Oct 2026 and took every page down with it), the copy of that same source
 * saved in fixtures/ is used instead. It's the real published calendar, only
 * older; past matches are dropped from every list anyway.
 */

const REFRESH_SECONDS = 6 * 60 * 60;

const PREMIER_LEAGUE_URL =
  "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/en.1.json";
const F1_URL = "https://api.jolpi.ca/ergast/f1/2026.json";

/** openfootball's club names → our team ids (2026–27 season). */
const OPENFOOTBALL_CLUBS: Record<string, string> = {
  "AFC Bournemouth": "bournemouth",
  "Arsenal FC": "arsenal",
  "Aston Villa FC": "aston-villa",
  "Brentford FC": "brentford",
  "Brighton & Hove Albion FC": "brighton",
  "Chelsea FC": "chelsea",
  "Coventry City FC": "coventry",
  "Crystal Palace FC": "crystal-palace",
  "Everton FC": "everton",
  "Fulham FC": "fulham",
  "Hull City AFC": "hull",
  "Ipswich Town FC": "ipswich",
  "Leeds United FC": "leeds",
  "Liverpool FC": "liverpool",
  "Manchester City FC": "man-city",
  "Manchester United FC": "man-united",
  "Newcastle United FC": "newcastle",
  "Nottingham Forest FC": "nottingham-forest",
  "Sunderland AFC": "sunderland",
  "Tottenham Hotspur FC": "tottenham",
};

interface OpenFootballMatch {
  date: string;
  time?: string;
  team1: string;
  team2: string;
}

interface JolpicaRace {
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: { lat: string; long: string; locality: string };
  };
}

/** The live source, or the saved copy of it if the source fails. */
async function getJson<T>(url: string, saved: unknown): Promise<T> {
  try {
    const res = await fetch(url, { next: { revalidate: REFRESH_SECONDS }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`Fixture source ${url} failed (${(e as Error).message}); using the saved copy.`);
    return saved as T;
  }
}

async function premierLeague(): Promise<SportEvent[]> {
  const data = await getJson<{ matches: OpenFootballMatch[] }>(PREMIER_LEAGUE_URL, savedPremierLeague);
  const events: SportEvent[] = [];

  for (const m of data.matches) {
    const homeId = OPENFOOTBALL_CLUBS[m.team1];
    const awayId = OPENFOOTBALL_CLUBS[m.team2];
    const home = homeId ? TEAMS_BY_ID.get(homeId) : undefined;
    const away = awayId ? TEAMS_BY_ID.get(awayId) : undefined;
    if (!home || !away) {
      // A club name we don't recognise means the mapping is out of date. Log
      // it loudly, but keep every other page working.
      console.error(`Unknown Premier League club in fixtures: "${m.team1}" / "${m.team2}"`);
      continue;
    }
    // Every published fixture carries a kick-off time. One that doesn't is
    // left out rather than given a time we made up.
    if (!m.time) continue;

    events.push({
      id: `pl-2026-${home.id}-${away.id}`,
      sportId: "soccer",
      leagueId: "premier-league",
      kind: "fixture",
      name: `${home.shortName} vs ${away.shortName}`,
      startsAt: zonedTimeToIso(m.date, m.time, "Europe/London"),
      venueId: home.venueId,
      homeTeamId: home.id,
      awayTeamId: away.id,
      demandScore: 0,
      isMarquee: false,
    });
  }
  return events;
}

async function formula1(): Promise<{ events: SportEvent[]; venues: Venue[] }> {
  const data = await getJson<{ MRData: { RaceTable: { Races: JolpicaRace[] } } }>(F1_URL, savedFormula1);
  const events: SportEvent[] = [];
  const venues: Venue[] = [];

  for (const race of data.MRData.RaceTable.Races) {
    const circuit = F1_CIRCUITS[race.Circuit.circuitId];
    if (!circuit || !race.time) continue;

    const venueId = `f1-${race.Circuit.circuitId}`;
    venues.push({
      id: venueId,
      name: race.Circuit.circuitName,
      city: race.Circuit.Location.locality,
      country: circuit.country,
      lat: Number(race.Circuit.Location.lat),
      lon: Number(race.Circuit.Location.long),
      nearestAirport: circuit.airport,
      timeZone: circuit.timeZone,
    });
    events.push({
      id: `f1-2026-${race.round}`,
      sportId: "motorsport",
      leagueId: "formula-1",
      kind: "race",
      name: race.raceName,
      startsAt: `${race.date}T${race.time}`,
      venueId,
      demandScore: 0,
      isMarquee: true,
    });
  }
  return { events, venues };
}

export interface LiveData {
  events: SportEvent[];
  eventsById: Map<string, SportEvent>;
  venuesById: Map<string, Venue>;
}

export async function loadLiveData(): Promise<LiveData> {
  const [pl, f1, uefa] = await Promise.all([premierLeague(), formula1(), loadUefa()]);
  const events = [...pl, ...f1.events, ...uefa.events, ...US_EVENTS];
  return {
    events,
    eventsById: new Map(events.map((e) => [e.id, e])),
    venuesById: new Map([...f1.venues, ...uefa.venues].map((v) => [v.id, v])),
  };
}
