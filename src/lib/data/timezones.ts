/**
 * IANA time zone for every venue city.
 *
 * Event times are stored as UTC instants, and showing them in UTC put a
 * Thursday-night US game on "Friday" — and would have booked the hotel for the
 * wrong night. Dates people read, and dates we send to Expedia, are the venue's
 * local dates.
 *
 * Only the US spans several zones among our venues, so it's looked up by city;
 * everywhere else is one zone per country. An unknown city throws rather than
 * guessing: a wrong zone silently shifts a booking by a day.
 */

const BY_COUNTRY: Record<string, string> = {
  AU: "Australia/Melbourne",
  BR: "America/Sao_Paulo",
  CA: "America/Toronto",
  DE: "Europe/Berlin",
  ES: "Europe/Madrid",
  FR: "Europe/Paris",
  GB: "Europe/London",
  IN: "Asia/Kolkata",
  IT: "Europe/Rome",
  JP: "Asia/Tokyo",
  MC: "Europe/Monaco",
  MX: "America/Mexico_City",
};

const EASTERN = "America/New_York";
const CENTRAL = "America/Chicago";
const MOUNTAIN = "America/Denver";
// Arizona doesn't observe daylight saving, so it can't share Denver's zone.
const ARIZONA = "America/Phoenix";
const PACIFIC = "America/Los_Angeles";

const US_CITIES: Record<string, string> = {
  Atlanta: EASTERN,
  Augusta: EASTERN,
  Baltimore: EASTERN,
  Boston: EASTERN,
  Brooklyn: EASTERN,
  Charlotte: EASTERN,
  Cincinnati: EASTERN,
  Cleveland: EASTERN,
  Detroit: EASTERN,
  "East Rutherford": EASTERN,
  Foxborough: EASTERN,
  Indianapolis: EASTERN,
  Jacksonville: EASTERN,
  Landover: EASTERN,
  Miami: EASTERN,
  "Miami Gardens": EASTERN,
  "New York": EASTERN,
  "Orchard Park": EASTERN,
  Orlando: EASTERN,
  Philadelphia: EASTERN,
  Pittsburgh: EASTERN,
  Tampa: EASTERN,
  Washington: EASTERN,

  Arlington: CENTRAL,
  Austin: CENTRAL,
  Chicago: CENTRAL,
  Dallas: CENTRAL,
  "Green Bay": CENTRAL,
  Houston: CENTRAL,
  "Kansas City": CENTRAL,
  Memphis: CENTRAL,
  Milwaukee: CENTRAL,
  Minneapolis: CENTRAL,
  Nashville: CENTRAL,
  "New Orleans": CENTRAL,
  "Oklahoma City": CENTRAL,
  "San Antonio": CENTRAL,

  Denver: MOUNTAIN,
  "Salt Lake City": MOUNTAIN,

  Glendale: ARIZONA,
  Phoenix: ARIZONA,

  Inglewood: PACIFIC,
  "Las Vegas": PACIFIC,
  "Los Angeles": PACIFIC,
  Portland: PACIFIC,
  Sacramento: PACIFIC,
  "San Francisco": PACIFIC,
  "Santa Clara": PACIFIC,
  Seattle: PACIFIC,
};

export function timeZoneFor(country: string, city: string): string {
  const zone = country === "US" ? US_CITIES[city] : BY_COUNTRY[country];
  if (!zone) {
    throw new Error(
      `No time zone for venue city "${city}, ${country}" — add it to lib/data/timezones.ts`,
    );
  }
  return zone;
}
