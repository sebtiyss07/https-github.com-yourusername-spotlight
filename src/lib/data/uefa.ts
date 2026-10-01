import type { SportEvent, Venue } from "@/lib/domain/types";
import savedUefa from "@/lib/data/fixtures/uefa.json";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import europeAirports from "./europe-airports.json";

/**
 * Champions League and Europa League fixtures, from UEFA's own public match
 * data (the feed uefa.com's fixture pages use; no login needed). Kick-off
 * times are UTC. Stadiums, cities and coordinates come from the same feed.
 *
 * Matches at a Premier League ground reuse that club's venue, so photos,
 * hotels and UK train links work as for league games. Every other stadium
 * becomes a venue here, with its country's time zone and the nearest large
 * airport (OurAirports, public domain).
 */

const REFRESH_SECONDS = 6 * 60 * 60;
const SEASON_YEAR = 2027; // UEFA names seasons by the year they end: 2026–27.

export const UEFA_COMPETITIONS = [
  { competitionId: 1, leagueId: "champions-league", prefix: "ucl" },
  { competitionId: 14, leagueId: "europa-league", prefix: "uel" },
] as const;

/** UEFA's names for Premier League clubs → our team ids. */
const ENGLISH_CLUBS: Record<string, string> = {
  Arsenal: "arsenal",
  "Aston Villa": "aston-villa",
  Bournemouth: "bournemouth",
  Brentford: "brentford",
  Brighton: "brighton",
  Chelsea: "chelsea",
  "Crystal Palace": "crystal-palace",
  Everton: "everton",
  Fulham: "fulham",
  Liverpool: "liverpool",
  "Man City": "man-city",
  "Man Utd": "man-united",
  Newcastle: "newcastle",
  "Nottm Forest": "nottingham-forest",
  Sunderland: "sunderland",
  Tottenham: "tottenham",
};

/** UEFA country codes → ISO country and the stadium's time zone. */
const COUNTRIES: Record<string, { iso: string; timeZone: string }> = {
  ENG: { iso: "GB", timeZone: "Europe/London" },
  SCO: { iso: "GB", timeZone: "Europe/London" },
  WAL: { iso: "GB", timeZone: "Europe/London" },
  NIR: { iso: "GB", timeZone: "Europe/London" },
  IRL: { iso: "IE", timeZone: "Europe/Dublin" },
  FRA: { iso: "FR", timeZone: "Europe/Paris" },
  ESP: { iso: "ES", timeZone: "Europe/Madrid" },
  POR: { iso: "PT", timeZone: "Europe/Lisbon" },
  ITA: { iso: "IT", timeZone: "Europe/Rome" },
  GER: { iso: "DE", timeZone: "Europe/Berlin" },
  NED: { iso: "NL", timeZone: "Europe/Amsterdam" },
  BEL: { iso: "BE", timeZone: "Europe/Brussels" },
  AUT: { iso: "AT", timeZone: "Europe/Vienna" },
  SUI: { iso: "CH", timeZone: "Europe/Zurich" },
  CZE: { iso: "CZ", timeZone: "Europe/Prague" },
  SVK: { iso: "SK", timeZone: "Europe/Bratislava" },
  POL: { iso: "PL", timeZone: "Europe/Warsaw" },
  HUN: { iso: "HU", timeZone: "Europe/Budapest" },
  SVN: { iso: "SI", timeZone: "Europe/Ljubljana" },
  CRO: { iso: "HR", timeZone: "Europe/Zagreb" },
  SRB: { iso: "RS", timeZone: "Europe/Belgrade" },
  BIH: { iso: "BA", timeZone: "Europe/Sarajevo" },
  ROU: { iso: "RO", timeZone: "Europe/Bucharest" },
  BUL: { iso: "BG", timeZone: "Europe/Sofia" },
  GRE: { iso: "GR", timeZone: "Europe/Athens" },
  CYP: { iso: "CY", timeZone: "Asia/Nicosia" },
  TUR: { iso: "TR", timeZone: "Europe/Istanbul" },
  UKR: { iso: "UA", timeZone: "Europe/Kyiv" },
  DEN: { iso: "DK", timeZone: "Europe/Copenhagen" },
  NOR: { iso: "NO", timeZone: "Europe/Oslo" },
  SWE: { iso: "SE", timeZone: "Europe/Stockholm" },
  FIN: { iso: "FI", timeZone: "Europe/Helsinki" },
  ISR: { iso: "IL", timeZone: "Asia/Jerusalem" },
  AZE: { iso: "AZ", timeZone: "Asia/Baku" },
  ARM: { iso: "AM", timeZone: "Asia/Yerevan" },
  GEO: { iso: "GE", timeZone: "Asia/Tbilisi" },
  KAZ: { iso: "KZ", timeZone: "Asia/Almaty" },
};

interface UefaTeam {
  internationalName: string;
  countryCode: string;
  translations: { displayName: { EN: string } };
}

interface UefaMatch {
  id: string;
  kickOffTime: { dateTime: string };
  homeTeam: UefaTeam;
  awayTeam: UefaTeam;
  status: string;
  stadium?: {
    id: string;
    countryCode: string;
    geolocation: { latitude: number; longitude: number };
    translations: { name: { EN: string } };
    city: { translations: { name: { EN: string } } };
  };
}

const AIRPORTS = europeAirports as { iata: string; lat: number; lon: number }[];

function nearestAirport(lat: number, lon: number): string {
  const r = (d: number) => (d * Math.PI) / 180;
  let best = AIRPORTS[0];
  let bestKm = Infinity;
  for (const a of AIRPORTS) {
    const h =
      Math.sin(r(a.lat - lat) / 2) ** 2 +
      Math.cos(r(lat)) * Math.cos(r(a.lat)) * Math.sin(r(a.lon - lon) / 2) ** 2;
    const km = 12742 * Math.asin(Math.sqrt(h));
    if (km < bestKm) {
      bestKm = km;
      best = a;
    }
  }
  return best.iata;
}

/**
 * The feed is over 1 MB, and a download cut off mid-transfer once got cached
 * and broke every page. An unreadable copy is fetched again, uncached; if the
 * feed still fails, the copy saved in fixtures/uefa.json is used.
 */
async function fetchMatches(url: string, competitionId: number): Promise<UefaMatch[]> {
  const read = async (init: RequestInit) => {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000), ...init });
    if (!res.ok) throw new Error(`UEFA fixtures answered HTTP ${res.status}`);
    return JSON.parse(await res.text()) as UefaMatch[];
  };
  try {
    return await read({ next: { revalidate: REFRESH_SECONDS } });
  } catch {
    try {
      return await read({ cache: "no-store" });
    } catch (e) {
      console.warn(`UEFA fixtures failed (${(e as Error).message}); using the saved copy.`);
      return (savedUefa.competitions as unknown as Record<string, UefaMatch[]>)[String(competitionId)] ?? [];
    }
  }
}

export async function loadUefa(): Promise<{ events: SportEvent[]; venues: Venue[] }> {
  const events: SportEvent[] = [];
  const venues = new Map<string, Venue>();
  const today = new Date().toISOString().slice(0, 10);

  for (const comp of UEFA_COMPETITIONS) {
    const url = `https://match.uefa.com/v5/matches?competitionId=${comp.competitionId}&seasonYear=${SEASON_YEAR}&fromDate=${today}&limit=500&offset=0&order=ASC`;
    const matches = await fetchMatches(url, comp.competitionId);

    for (const m of matches) {
      // The saved copy can be days old, so also drop anything already played.
      if (!m.stadium || m.status !== "UPCOMING" || Date.parse(m.kickOffTime.dateTime) < Date.now()) continue;
      const country = COUNTRIES[m.stadium.countryCode];
      // A country we can't place in a time zone is left out rather than
      // shown at a guessed local time.
      if (!country) continue;

      const homeId = ENGLISH_CLUBS[m.homeTeam.internationalName];
      const awayId = ENGLISH_CLUBS[m.awayTeam.internationalName];
      const home = homeId ? TEAMS_BY_ID.get(homeId) : undefined;
      const away = awayId ? TEAMS_BY_ID.get(awayId) : undefined;

      let venueId: string;
      if (home) {
        venueId = home.venueId;
      } else {
        venueId = `uefa-${m.stadium.id}`;
        if (!venues.has(venueId)) {
          const { latitude: lat, longitude: lon } = m.stadium.geolocation;
          venues.set(venueId, {
            id: venueId,
            name: m.stadium.translations.name.EN,
            city: m.stadium.city.translations.name.EN,
            country: country.iso,
            lat,
            lon,
            nearestAirport: nearestAirport(lat, lon),
            timeZone: country.timeZone,
          });
        }
      }

      const homeName = home?.name ?? m.homeTeam.translations.displayName.EN;
      const awayName = away?.name ?? m.awayTeam.translations.displayName.EN;
      events.push({
        id: `${comp.prefix}-2027-${m.id}`,
        sportId: "soccer",
        leagueId: comp.leagueId,
        kind: "fixture",
        name: `${homeName} vs ${awayName}`,
        startsAt: m.kickOffTime.dateTime,
        venueId,
        homeTeamId: home?.id,
        awayTeamId: away?.id,
        demandScore: 0,
        isMarquee: false,
      });
    }
  }
  return { events, venues: [...venues.values()] };
}
