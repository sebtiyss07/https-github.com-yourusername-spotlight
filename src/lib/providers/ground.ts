/**
 * Train, coach and driving links for fans travelling within Great Britain.
 * Every link format below was opened on 2026-09-28 and landed on the right
 * search or page:
 * - National Rail's journey planner, pre-filled with stations and dates, which
 *   shows real fares (e.g. London Euston → Manchester from £61.50).
 * - FlixBus route pages, only for the city pairs that exist (checked each one).
 * - National Express city pages (every host city except Hull, which has none).
 * - Google Maps driving directions to the stadium itself.
 * None of these sites share prices openly, so these are links, not totals.
 */

import type { TravelLink } from "./travelLinks";

/** Main station (CRS code) for each UK origin city we can resolve. */
const ORIGIN_STATION: Record<string, string> = {
  Manchester: "MAN",
  Birmingham: "BHM",
  Liverpool: "LIV",
  Leeds: "LDS",
  Newcastle: "NCL",
  Nottingham: "NOT",
  Edinburgh: "EDB",
  Bournemouth: "BMH",
};

/** The station nearest each club's ground (London clubs use a London terminal). */
const GROUND_STATION: Record<string, string> = {
  "aston-villa": "BHM",
  bournemouth: "BMH",
  brighton: "FMR", // Falmer, next to the Amex
  coventry: "COV",
  everton: "LIV",
  liverpool: "LIV",
  hull: "HUL",
  ipswich: "IPS",
  leeds: "LDS",
  "man-city": "MAN",
  "man-united": "MAN",
  newcastle: "NCL",
  "nottingham-forest": "NOT",
  sunderland: "SUN",
};

/** Which London terminal serves each station. */
const LONDON_TERMINAL: Record<string, string> = {
  MAN: "EUS", LIV: "EUS", BHM: "EUS", COV: "EUS",
  LDS: "KGX", NCL: "KGX", SUN: "KGX", HUL: "KGX", EDB: "KGX",
  NOT: "STP", FMR: "VIC", BMH: "WAT", IPS: "LST",
};

/** FlixBus route pages that exist (others redirect away). */
const FLIX_ROUTES = new Set(
  "london-birmingham london-bournemouth london-brighton london-coventry london-liverpool london-ipswich london-leeds london-manchester london-nottingham london-sunderland manchester-birmingham manchester-bournemouth manchester-brighton manchester-coventry manchester-liverpool manchester-leeds manchester-nottingham manchester-sunderland manchester-london birmingham-bournemouth birmingham-brighton birmingham-coventry birmingham-liverpool birmingham-leeds birmingham-manchester birmingham-nottingham birmingham-sunderland birmingham-london liverpool-birmingham liverpool-coventry liverpool-leeds liverpool-manchester liverpool-nottingham liverpool-sunderland liverpool-london leeds-birmingham leeds-bournemouth leeds-brighton leeds-coventry leeds-liverpool leeds-manchester leeds-nottingham leeds-sunderland leeds-london nottingham-birmingham nottingham-bournemouth nottingham-brighton nottingham-coventry nottingham-liverpool nottingham-leeds nottingham-manchester nottingham-sunderland nottingham-london edinburgh-birmingham edinburgh-bournemouth edinburgh-brighton edinburgh-coventry edinburgh-liverpool edinburgh-leeds edinburgh-manchester edinburgh-nottingham edinburgh-sunderland edinburgh-london bournemouth-birmingham bournemouth-coventry bournemouth-leeds bournemouth-manchester bournemouth-nottingham bournemouth-sunderland bournemouth-london".split(" "),
);

/** National Express has a page for each of these cities. */
const NX_CITIES = new Set([
  "birmingham", "bournemouth", "brighton", "coventry", "liverpool", "ipswich",
  "leeds", "manchester", "newcastle", "nottingham", "sunderland", "london",
]);

const slug = (city: string) => city.toLowerCase().replace(/\s+/g, "-");

/** `2026-10-09` → `091026`, National Rail's date format. */
function nrDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}${m}${y.slice(2)}`;
}

/** Stations for a trip, or null when either end isn't on our UK map. */
function stations(fromCity: string, homeTeamId: string, venueCity: string) {
  const ground = GROUND_STATION[homeTeamId] ?? (venueCity === "London" ? "LONDON" : null);
  if (!ground) return null;
  if (fromCity === "London") {
    if (ground === "LONDON") return null; // already there
    return { from: LONDON_TERMINAL[ground], to: ground };
  }
  const from = ORIGIN_STATION[fromCity];
  if (!from) return null;
  const to = ground === "LONDON" ? LONDON_TERMINAL[from] : ground;
  return from === to ? null : { from, to };
}

export function trainLink(trip: {
  fromCity: string;
  homeTeamId: string;
  venueCity: string;
  departOn: string;
  returnOn: string;
  adults: number;
}): TravelLink | null {
  const s = stations(trip.fromCity, trip.homeTeamId, trip.venueCity);
  if (!s) return null;
  const params = new URLSearchParams({
    type: "return",
    origin: s.from,
    destination: s.to,
    leavingType: "departing",
    leavingDate: nrDate(trip.departOn),
    leavingHour: "09",
    leavingMin: "00",
    returnType: "departing",
    returnDate: nrDate(trip.returnOn),
    returnHour: "12",
    returnMin: "00",
    adults: String(Math.max(1, trip.adults)),
    extendedSearch: "false",
  });
  return { site: "National Rail", url: `https://www.nationalrail.co.uk/journey-planner/?${params}` };
}

export function coachLinks(fromCity: string, venueCity: string): TravelLink[] {
  const from = slug(fromCity);
  const to = slug(venueCity);
  if (from === to) return [];
  const links: TravelLink[] = [];
  if (FLIX_ROUTES.has(`${from}-${to}`)) {
    links.push({ site: "FlixBus", url: `https://www.flixbus.co.uk/bus-routes/${from}-${to}` });
  }
  if (NX_CITIES.has(to)) {
    links.push({ site: "National Express", url: `https://www.nationalexpress.com/en/destinations/${to}` });
  }
  return links;
}

export function driveLink(fromCity: string, lat: number, lon: number): TravelLink {
  const params = new URLSearchParams({
    api: "1",
    origin: fromCity,
    destination: `${lat},${lon}`,
    travelmode: "driving",
  });
  return { site: "Google Maps", url: `https://www.google.com/maps/dir/?${params}` };
}

/** Train and coach only make sense within Great Britain. */
export function groundTravelPossible(originCountry: string | undefined, venueCountry: string | undefined) {
  return originCountry === "GB" && venueCountry === "GB";
}
