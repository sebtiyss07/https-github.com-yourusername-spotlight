/**
 * Expedia search links, pre-filled with the exact trip.
 *
 * Expedia's data API (Rapid) is only open to approved partners, so we can't
 * show their prices inside the page yet. What we can do is send people to a
 * real Expedia search for precisely this trip — same airports, dates, people
 * and rooms — so the prices they land on are real and bookable.
 *
 * Both formats were checked against expedia.com by hand. If Expedia changes
 * them, the link still opens Expedia, just without some fields filled in.
 */

const BASE = "https://www.expedia.com";

/** Two adults to a room; an odd one out gets their own. */
export function adultsPerRoom(people: number): number[] {
  const rooms: number[] = [];
  for (let left = Math.max(1, people); left > 0; left -= 2) {
    rooms.push(Math.min(2, left));
  }
  return rooms;
}

/** `2026-09-30` → `09/30/2026`, the format Expedia's flight legs use. */
function usDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${m}/${d}/${y}`;
}

export function expediaFlightsUrl(trip: {
  from: string;
  to: string;
  departOn: string;
  returnOn: string;
  adults: number;
}): string {
  const params = new URLSearchParams({
    trip: "roundtrip",
    leg1: `from:${trip.from},to:${trip.to},departure:${usDate(trip.departOn)}TANYT`,
    leg2: `from:${trip.to},to:${trip.from},departure:${usDate(trip.returnOn)}TANYT`,
    passengers: `adults:${Math.max(1, trip.adults)},children:0,seniors:0,infantinlap:Y`,
    options: "cabinclass:economy",
    mode: "search",
    // Opens on "Price: low to high" (checked on expedia.com).
    sortOrder: "INCREASING",
    sortType: "PRICE",
  });
  return `${BASE}/Flights-Search?${params}`;
}

export function expediaHotelsUrl(stay: {
  /** Shown in Expedia's "Where to?" box, e.g. "AT&T Stadium, Arlington". */
  destination: string;
  lat: number;
  lon: number;
  checkIn: string;
  checkOut: string;
  adults: number;
}): string {
  const rooms = adultsPerRoom(stay.adults);
  const params = new URLSearchParams({
    destination: stay.destination,
    // Anchors the search on the venue itself. Without it, a bare place name
    // can fall back to hotels near wherever the visitor happens to be.
    latLong: `${stay.lat},${stay.lon}`,
    startDate: stay.checkIn,
    endDate: stay.checkOut,
    adults: rooms.join(","),
    rooms: String(rooms.length),
    // Cheapest first.
    sort: "PRICE_LOW_TO_HIGH",
  });
  return `${BASE}/Hotel-Search?${params}`;
}
