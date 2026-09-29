import type { SportId, Team, Venue } from "@/lib/domain/types";
import { logoFor } from "@/lib/data/logos";
import { timeZoneFor } from "@/lib/data/timezones";
import { US_TEAMS, US_VENUES } from "@/lib/data/us-sports";

/**
 * Team and venue seed data for the three leagues with full depth.
 *
 * Teams and venues are authored together in one compact row because they're
 * one-to-one for club sport, and keeping them adjacent is what stops the
 * coordinates from drifting away from the club that plays there. `expand()`
 * splits them into the two normalised tables the rest of the app reads —
 * which is also the shape the eventual `teams` / `venues` SQL tables take.
 *
 * Coordinates are the stadium itself, not the city centre: walking distance to
 * the gate is the number that decides whether a hotel is worth booking.
 */
type Row = [
  id: string,
  shortName: string,
  fullName: string,
  city: string,
  country: string,
  venueName: string,
  lat: number,
  lon: number,
  capacity: number,
  airport: string,
  opened: number,
  founded: number,
  primary: string,
  secondary: string,
  titles: number,
];

/**
 * Crest codes in order of preference. The first that isn't already taken in the
 * league wins, so the common case stays short and only genuine collisions get
 * longer. Nickname-derived fallbacks are preferred over city-derived ones —
 * "LRA" reads as the Rams; "LOS" reads as nothing.
 */
function candidateCodes(name: string): string[] {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter((w) => w.length > 0 && !/^(FC|AFC|CF|SC|AC)$/i.test(w));

  const source = words.length > 0 ? words : [name.replace(/[^A-Za-z0-9]/g, "")];
  const first = source[0];
  const last = source[source.length - 1];

  const codes =
    source.length === 1
      ? [first.slice(0, 2), first.slice(0, 3)]
      : [
          first[0] + last[0],
          first[0] + last.slice(0, 2),
          first.slice(0, 3),
          first.slice(0, 2) + last[0],
        ];

  return codes.map((c) => c.toUpperCase());
}

function assignAbbreviations(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    for (const code of candidateCodes(name)) {
      if (!used.has(code)) {
        used.add(code);
        return code;
      }
    }
    // Every candidate taken — suffix until unique rather than ever duplicating.
    const base = candidateCodes(name)[0];
    let n = 2;
    while (used.has(`${base}${n}`)) n++;
    used.add(`${base}${n}`);
    return `${base}${n}`;
  });
}

function expand(
  rows: Row[],
  leagueId: string,
  sportId: SportId,
): { teams: Team[]; venues: Venue[] } {
  const teams: Team[] = [];
  const venues: Venue[] = [];
  const abbreviations = assignAbbreviations(rows.map((r) => r[2]));

  for (const [index, r] of rows.entries()) {
    const venueId = `${r[0]}-venue`;
    venues.push({
      id: venueId,
      name: r[5],
      city: r[3],
      country: r[4],
      lat: r[6],
      lon: r[7],
      capacity: r[8],
      nearestAirport: r[9],
      opened: r[10],
      timeZone: timeZoneFor(r[4], r[3]),
    });
    teams.push({
      id: r[0],
      leagueId,
      sportId,
      name: r[2],
      shortName: r[1],
      city: r[3],
      country: r[4],
      venueId,
      founded: r[11],
      primaryColor: r[12],
      secondaryColor: r[13],
      titles: r[14],
      abbreviation: abbreviations[index],
      // Undefined until a licensed crest is configured — see data/logos.ts.
      logoUrl: logoFor(r[0]),
    });
  }
  return { teams, venues };
}

// ---------------------------------------------------------------------------
// Premier League
// ---------------------------------------------------------------------------
// The 2026–27 season's 20 clubs.
const EPL_ROWS: Row[] = [
  ["arsenal","Arsenal","Arsenal FC","London","GB","Emirates Stadium",51.5549,-0.1084,60704,"LHR",2006,1886,"#EF0107","#FFFFFF",3],
  ["aston-villa","Aston Villa","Aston Villa FC","Birmingham","GB","Villa Park",52.5092,-1.8848,42657,"BHX",1897,1874,"#95BFE5","#670E36",1],
  ["bournemouth","Bournemouth","AFC Bournemouth","Bournemouth","GB","Vitality Stadium",50.7348,-1.8383,11307,"BOH",1910,1899,"#DA291C","#000000",0],
  ["brentford","Brentford","Brentford FC","London","GB","Gtech Community Stadium",51.4907,-0.2887,17250,"LHR",2020,1889,"#E30613","#FBB800",0],
  ["brighton","Brighton","Brighton & Hove Albion","Brighton","GB","Amex Stadium",50.8616,-0.0837,31800,"LGW",2011,1901,"#0057B8","#FFCD00",0],
  ["chelsea","Chelsea","Chelsea FC","London","GB","Stamford Bridge",51.4817,-0.1910,40343,"LHR",1877,1905,"#034694","#FFFFFF",6],
  ["coventry","Coventry","Coventry City FC","Coventry","GB","Coventry Building Society Arena",52.4481,-1.4956,32609,"BHX",2005,1883,"#59CBE8","#FFFFFF",0],
  ["crystal-palace","Crystal Palace","Crystal Palace FC","London","GB","Selhurst Park",51.3983,-0.0855,25486,"LGW",1924,1905,"#1B458F","#C4122E",0],
  ["everton","Everton","Everton FC","Liverpool","GB","Hill Dickinson Stadium",53.4074,-2.9917,52888,"LPL",2025,1878,"#003399","#FFFFFF",9],
  ["fulham","Fulham","Fulham FC","London","GB","Craven Cottage",51.4750,-0.2217,29600,"LHR",1896,1879,"#FFFFFF","#000000",0],
  ["hull","Hull","Hull City AFC","Hull","GB","MKM Stadium",53.7462,-0.3678,25586,"MAN",2002,1904,"#F5A12D","#000000",0],
  ["ipswich","Ipswich","Ipswich Town FC","Ipswich","GB","Portman Road",52.0550,1.1447,29673,"STN",1884,1878,"#0044A9","#FFFFFF",1],
  ["leeds","Leeds","Leeds United","Leeds","GB","Elland Road",53.7778,-1.5722,37792,"LBA",1897,1919,"#FFFFFF","#1D428A",3],
  ["liverpool","Liverpool","Liverpool FC","Liverpool","GB","Anfield",53.4308,-2.9608,61276,"LPL",1884,1892,"#C8102E","#00B2A9",20],
  ["man-city","Man City","Manchester City","Manchester","GB","Etihad Stadium",53.4831,-2.2004,53400,"MAN",2003,1880,"#6CABDD","#1C2C5B",10],
  ["man-united","Man United","Manchester United","Manchester","GB","Old Trafford",53.4631,-2.2913,74310,"MAN",1910,1878,"#DA291C","#FBE122",20],
  ["newcastle","Newcastle","Newcastle United","Newcastle","GB","St James' Park",54.9756,-1.6217,52305,"NCL",1892,1892,"#241F20","#FFFFFF",4],
  ["nottingham-forest","Forest","Nottingham Forest","Nottingham","GB","City Ground",52.9400,-1.1329,30404,"EMA",1898,1865,"#DD0000","#FFFFFF",1],
  ["sunderland","Sunderland","Sunderland AFC","Sunderland","GB","Stadium of Light",54.9145,-1.3882,49000,"NCL",1997,1879,"#EB172B","#FFFFFF",6],
  ["tottenham","Spurs","Tottenham Hotspur","London","GB","Tottenham Hotspur Stadium",51.6043,-0.0665,62850,"LHR",2019,1882,"#132257","#FFFFFF",2],
];

const epl = expand(EPL_ROWS, "premier-league", "soccer");

// NFL, NBA and MLS clubs come from ESPN (see us-sports.ts).
export const TEAMS: Team[] = [...epl.teams, ...US_TEAMS];

/**
 * Venues used by marquee events that aren't any club's home ground — neutral
 * finals, tournament sites, and circuits.
 */
const NEUTRAL_VENUE_ROWS: Omit<Venue, "timeZone">[] = [
  { id: "wembley", name: "Wembley Stadium", city: "London", country: "GB", lat: 51.5560, lon: -0.2795, capacity: 90000, nearestAirport: "LHR", opened: 2007 },
  { id: "aewc", name: "All England Club", city: "London", country: "GB", lat: 51.4340, lon: -0.2144, capacity: 42000, nearestAirport: "LHR", opened: 1922 },
  { id: "roland-garros", name: "Stade Roland-Garros", city: "Paris", country: "FR", lat: 48.8470, lon: 2.2500, capacity: 34000, nearestAirport: "CDG", opened: 1928 },
  { id: "flushing-meadows", name: "USTA Billie Jean King Center", city: "New York", country: "US", lat: 40.7500, lon: -73.8458, capacity: 45000, nearestAirport: "JFK", opened: 1978 },
  { id: "melbourne-park", name: "Melbourne Park", city: "Melbourne", country: "AU", lat: -37.8216, lon: 144.9784, capacity: 40000, nearestAirport: "MEL", opened: 1988 },
  { id: "monaco-circuit", name: "Circuit de Monaco", city: "Monte Carlo", country: "MC", lat: 43.7347, lon: 7.4206, capacity: 37000, nearestAirport: "NCE", opened: 1929 },
  { id: "silverstone", name: "Silverstone Circuit", city: "Silverstone", country: "GB", lat: 52.0733, lon: -1.0142, capacity: 164000, nearestAirport: "BHX", opened: 1948 },
  { id: "monza", name: "Autodromo Nazionale Monza", city: "Monza", country: "IT", lat: 45.6156, lon: 9.2811, capacity: 115000, nearestAirport: "MXP", opened: 1922 },
  { id: "suzuka", name: "Suzuka International Circuit", city: "Suzuka", country: "JP", lat: 34.8431, lon: 136.5410, capacity: 155000, nearestAirport: "NGO", opened: 1962 },
  { id: "cota", name: "Circuit of the Americas", city: "Austin", country: "US", lat: 30.1328, lon: -97.6411, capacity: 120000, nearestAirport: "AUS", opened: 2012 },
  { id: "le-mans", name: "Circuit de la Sarthe", city: "Le Mans", country: "FR", lat: 47.9560, lon: 0.2074, capacity: 260000, nearestAirport: "CDG", opened: 1923 },
  { id: "augusta", name: "Augusta National Golf Club", city: "Augusta", country: "US", lat: 33.5021, lon: -82.0227, capacity: 40000, nearestAirport: "AGS", opened: 1933 },
  { id: "st-andrews", name: "Old Course at St Andrews", city: "St Andrews", country: "GB", lat: 56.3433, lon: -2.8025, capacity: 50000, nearestAirport: "EDI", opened: 1552 },
  { id: "t-mobile-arena", name: "T-Mobile Arena", city: "Las Vegas", country: "US", lat: 36.1029, lon: -115.1783, capacity: 20000, nearestAirport: "LAS", opened: 2016 },
  { id: "sphere", name: "Sphere", city: "Las Vegas", country: "US", lat: 36.1207, lon: -115.1620, capacity: 18600, nearestAirport: "LAS", opened: 2023 },
  { id: "lords", name: "Lord's Cricket Ground", city: "London", country: "GB", lat: 51.5297, lon: -0.1727, capacity: 31100, nearestAirport: "LHR", opened: 1814 },
  { id: "mcg", name: "Melbourne Cricket Ground", city: "Melbourne", country: "AU", lat: -37.8200, lon: 144.9834, capacity: 100024, nearestAirport: "MEL", opened: 1853 },
  { id: "narendra-modi", name: "Narendra Modi Stadium", city: "Ahmedabad", country: "IN", lat: 23.0919, lon: 72.5975, capacity: 132000, nearestAirport: "AMD", opened: 1983 },
  { id: "wankhede", name: "Wankhede Stadium", city: "Mumbai", country: "IN", lat: 18.9389, lon: 72.8258, capacity: 33108, nearestAirport: "BOM", opened: 1974 },
  { id: "estadio-azteca", name: "Estadio Azteca", city: "Mexico City", country: "MX", lat: 19.3029, lon: -99.1505, capacity: 87000, nearestAirport: "MEX", opened: 1966 },
  { id: "bernabeu", name: "Santiago Bernabéu", city: "Madrid", country: "ES", lat: 40.4531, lon: -3.6883, capacity: 78297, nearestAirport: "MAD", opened: 1947 },
  { id: "camp-nou", name: "Spotify Camp Nou", city: "Barcelona", country: "ES", lat: 41.3809, lon: 2.1228, capacity: 105000, nearestAirport: "BCN", opened: 1957 },
  { id: "san-siro", name: "San Siro", city: "Milan", country: "IT", lat: 45.4781, lon: 9.1240, capacity: 75923, nearestAirport: "MXP", opened: 1926 },
  { id: "allianz-arena", name: "Allianz Arena", city: "Munich", country: "DE", lat: 48.2188, lon: 11.6247, capacity: 75024, nearestAirport: "MUC", opened: 2005 },
  { id: "maracana", name: "Estádio do Maracanã", city: "Rio de Janeiro", country: "BR", lat: -22.9121, lon: -43.2302, capacity: 78838, nearestAirport: "GIG", opened: 1950 },
  { id: "msg-neutral", name: "Madison Square Garden", city: "New York", country: "US", lat: 40.7505, lon: -73.9934, capacity: 20789, nearestAirport: "JFK", opened: 1968 },
  { id: "bell-centre", name: "Bell Centre", city: "Montreal", country: "CA", lat: 45.4961, lon: -73.5693, capacity: 21105, nearestAirport: "YUL", opened: 1996 },
];

export const NEUTRAL_VENUES: Venue[] = NEUTRAL_VENUE_ROWS.map((v) => ({
  ...v,
  timeZone: timeZoneFor(v.country, v.city),
}));

export const VENUES = [...epl.venues, ...US_VENUES, ...NEUTRAL_VENUES];

export const TEAMS_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));

export const VENUES_BY_ID = new Map(VENUES.map((v) => [v.id, v]));

export function teamsForLeague(leagueId: string): Team[] {
  return TEAMS.filter((t) => t.leagueId === leagueId).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
