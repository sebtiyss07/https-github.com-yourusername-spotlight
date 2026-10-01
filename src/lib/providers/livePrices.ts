/**
 * Live flight and hotel prices for the trip total.
 *
 * Hotels: read from Booking.com's own search results near each venue, for
 * each game's default stay (the nights before and of the game), cheapest
 * first, hotels only, within 5 km. We tried a free rates feed first, but
 * Booking.com itself showed some of its hotels as unavailable at the prices
 * the feed quoted, so we only show what the booking site shows. See
 * hotel-prices.json; other dates get links instead of a guessed price.
 *
 * Flights: the Aviasales / Travelpayouts price API, which returns the cheapest
 * fare real travellers found for a route and dates in the last few days. It
 * needs a free token (TRAVELPAYOUTS_TOKEN). When nobody searched the exact
 * dates, the closest real fare is shown for reference with its own dates,
 * never stretched or estimated to fit the visitor's dates.
 *
 * Every response is cached for a few hours so a busy page doesn't hammer
 * either service.
 */

import expediaFares from "@/lib/data/flight-prices.json";
import hotelSnapshot from "@/lib/data/hotel-prices.json";
import { expediaFlightsUrl } from "./expedia";

const CACHE = { next: { revalidate: 60 * 60 * 6 } };

/**
 * Cheapest round-trip economy fare per traveller, read from Expedia's own
 * search results (sorted by price) on the date recorded. Keyed by
 * "FROM|TO|out|back". Only covers the trips listed; anything else shows the
 * compare links instead.
 */
const EXPEDIA_FARES = expediaFares.fares as Record<
  string,
  { price: number; airline: string; stops: string }
>;

function expediaFareFor(trip: { from: string; to: string; departOn: string; returnOn: string }): FlightQuote | null {
  const f = EXPEDIA_FARES[`${trip.from}|${trip.to}|${trip.departOn}|${trip.returnOn}`];
  if (!f) return null;
  const [, m, d] = expediaFares.checkedOn.split("-");
  const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m) - 1];
  return {
    perPerson: f.price,
    airline: f.airline,
    stopsLabel: f.stops,
    url: expediaFlightsUrl({ ...trip, adults: 1 }),
    source: `Expedia, checked ${Number(d)} ${month}`,
  };
}

export interface HotelQuote {
  name: string;
  /** Distance from the venue as Booking.com words it, e.g. "0.8 miles". */
  distance: string;
  /** The room that price is for, e.g. "Queen Room". */
  room: string;
  /** Nightly rate for one room, in USD, before taxes. */
  perNight: number;
  /** Price for the whole stay for one room, in USD, before taxes. */
  total: number;
  nights: number;
  site: string;
  /** The hotel's own page on the booking site, with the dates filled in. */
  url: string;
  /** The booking site's list of the cheapest hotels near the venue, same dates. */
  searchUrl: string;
  /** How many hotels the booking site listed for that search. */
  found: number | null;
  /** When the price was read (YYYY-MM-DD). */
  checkedOn: string;
  /** The stay this price is for. */
  checkIn: string;
  checkOut: string;
  /**
   * False when the visitor picked other nights than the stay we priced: the
   * price is then shown for reference only, not added to their total.
   */
  forYourDates: boolean;
}

export interface FlightQuote {
  /** Cheapest round-trip fare per person, in USD. */
  perPerson: number;
  airline: string;
  /** e.g. "Nonstop", "1 stop". */
  stopsLabel: string;
  url: string;
  /** Where the fare came from, e.g. "Expedia, checked Mon 28 Sep". */
  source: string;
  /** The dates this fare is for (YYYY-MM-DD). */
  departOn?: string;
  returnOn?: string;
  /** Set when the fare is to a nearby airport instead of the venue's own. */
  viaAirport?: { code: string; name: string; miles: number };
  /** Set when the fare leaves from a nearby airport instead of the traveller's. */
  viaOrigin?: { code: string; name: string; miles: number };
}

export type FlightResult =
  | { status: "ok"; quote: FlightQuote }
  /** No fare for the exact dates: the closest real fare found, for reference. */
  | { status: "nearby"; quote: FlightQuote }
  | { status: "no-key" }
  | { status: "none" };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, CACHE);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type SnapshotHotel = [name: string, perNight: number, total: number, distance: string, room: string, path: string, nights: string];
interface SnapshotSearch {
  found: string | null;
  wide: boolean;
  hotels: SnapshotHotel[];
}
/** One search for 1 adult, and (`pair`) one for 2 adults sharing a room. */
const HOTELS = hotelSnapshot.events as unknown as Record<string, SnapshotSearch & { checkIn: string; checkOut: string; pair?: SnapshotSearch }>;

function bookingSearchUrl(stay: { name: string; lat: number; lon: number; checkIn: string; checkOut: string; adults: number; wide?: boolean }) {
  const q = new URLSearchParams({
    ss: stay.name,
    latitude: String(stay.lat),
    longitude: String(stay.lon),
    checkin: stay.checkIn,
    checkout: stay.checkOut,
    group_adults: String(Math.max(1, stay.adults)),
    no_rooms: "1",
    group_children: "0",
    order: "price",
    nflt: stay.wide ? "ht_id=204" : "ht_id=204;distance=5000",
  });
  return `https://www.booking.com/searchresults.html?${q}`;
}

/**
 * The cheapest hotel Booking.com listed near the venue for this game's stay.
 * The price we read for this game's default stay: 1 adult for one traveller,
 * 2 adults to a room for groups. When the visitor picks other nights,
 * `forYourDates` is false and the page shows it for reference only, beside
 * links for their own dates. The quote is for one room.
 */
export async function cheapestHotelNear(stay: {
  eventId: string;
  venueName: string;
  lat: number;
  lon: number;
  checkIn: string;
  checkOut: string;
  adults: number;
}): Promise<HotelQuote | null> {
  const snap = HOTELS[stay.eventId];
  if (!snap) return null;
  const forYourDates = snap.checkIn === stay.checkIn && snap.checkOut === stay.checkOut;
  // One traveller: a room for 1. Groups: rooms for 2 (an odd one out gets a
  // room for 2 as well, so their price is that room's).
  const search = stay.adults === 1 ? snap : snap.pair;
  const best = search?.hotels[0];
  if (!search || !best) return null;
  const [name, perNight, total, distance, room, path] = best;
  const nights = Math.round((Date.parse(snap.checkOut) - Date.parse(snap.checkIn)) / 86_400_000);
  const perRoom = stay.adults === 1 ? 1 : 2;
  // Links always use the visitor's own dates, so they land on today's price.
  const dates = new URLSearchParams({
    checkin: stay.checkIn,
    checkout: stay.checkOut,
    group_adults: String(perRoom),
    no_rooms: "1",
    group_children: "0",
  });
  return {
    name,
    distance,
    room,
    perNight,
    total,
    nights,
    site: "Booking.com",
    url: `https://www.booking.com${path}?${dates}`,
    searchUrl: bookingSearchUrl({ name: stay.venueName, lat: stay.lat, lon: stay.lon, checkIn: stay.checkIn, checkOut: stay.checkOut, adults: perRoom, wide: search.wide }),
    found: search.found ? Number(search.found.replace(/,/g, "")) : null,
    checkedOn: hotelSnapshot.checkedOn,
    checkIn: snap.checkIn,
    checkOut: snap.checkOut,
    forYourDates,
  };
}

export async function cheapestFlight(trip: {
  from: string;
  to: string;
  departOn: string;
  returnOn: string;
  /** Other airports near the venue, tried when `to` has no fares at all. */
  alternates?: { code: string; name: string; miles: number }[];
  /** Other airports near the traveller, tried after those. */
  originAlternates?: { code: string; name: string; miles: number }[];
}): Promise<FlightResult> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    // No live feed: fall back to fares read from Expedia's own results.
    const saved = expediaFareFor(trip);
    return saved ? { status: "ok", quote: saved } : { status: "no-key" };
  }

  type Fare = { price: number; airline: string; transfers: number; link: string; departure_at: string; return_at: string };
  const days = (a: string, b: string) => Math.abs(Date.parse(a.slice(0, 10)) - Date.parse(b)) / 864e5;
  const stops = (n: number) => (n === 0 ? "Nonstop" : `${n} stop${n > 1 ? "s" : ""}`);
  const future = (iso: string) => Date.parse(iso.slice(0, 10)) > Date.now();

  const fareTo = async (to: string, from = trip.from): Promise<FlightResult> => {
    const search = async (departure_at: string, return_at: string, limit: number) => {
      const params = new URLSearchParams({ origin: from, destination: to, departure_at, return_at, currency: "usd", sorting: "price", one_way: "false", limit: String(limit), token });
      const r = await getJson<{ data?: Fare[] }>(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`);
      return r?.data ?? [];
    };
    const toQuote = (f: Fare): FlightQuote => ({
      perPerson: f.price,
      airline: f.airline,
      stopsLabel: stops(f.transfers),
      url: `https://www.aviasales.com${f.link}`,
      source: "Aviasales, found by travellers in the last few days",
      departOn: f.departure_at.slice(0, 10),
      returnOn: f.return_at.slice(0, 10),
    });

    // 1. The exact dates.
    const [exact] = await search(trip.departOn, trip.returnOn, 1);
    if (exact) return { status: "ok", quote: toQuote(exact) };
    const saved = to === trip.to && from === trip.from ? expediaFareFor(trip) : null;
    if (saved) return { status: "ok", quote: saved };

    // 2. Fares are only known for dates someone searched recently, so otherwise
    // show the closest real fare (same months), labelled with its own dates.
    const fares = await search(trip.departOn.slice(0, 7), trip.returnOn.slice(0, 7), 60);
    const near = fares
      .map((f) => ({ f, gap: days(f.departure_at, trip.departOn) + days(f.return_at, trip.returnOn) }))
      // Only trips you could still take: leaving tomorrow or later.
      .filter((x) => x.gap <= 14 && future(x.f.departure_at))
      .sort((a, b) => a.gap - b.gap || a.f.price - b.f.price)[0];
    if (near) return { status: "nearby", quote: toQuote(near.f) };

    // 3. Still nothing near those dates: the latest fares found on this route
    // over the next year, closest trip first, whatever its dates.
    const latest = await getJson<{
      data?: { depart_date: string; return_date: string; value: number; number_of_changes: number; gate: string }[];
    }>(`https://api.travelpayouts.com/aviasales/v3/get_latest_prices?${new URLSearchParams({ origin: from, destination: to, period_type: "year", one_way: "false", currency: "usd", limit: "100", token })}`);
    const closest = (latest?.data ?? [])
      .filter((f) => f.return_date && future(f.depart_date))
      .map((f) => ({ f, gap: days(f.depart_date, trip.departOn) + days(f.return_date, trip.returnOn) }))
      .sort((a, b) => a.gap - b.gap || a.f.value - b.f.value)[0];
    if (!closest) return { status: "none" };
    const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
    const out = closest.f.depart_date.slice(0, 10), back = closest.f.return_date.slice(0, 10);
    return {
      status: "nearby",
      quote: {
        perPerson: closest.f.value,
        airline: `via ${closest.f.gate}`,
        stopsLabel: stops(closest.f.number_of_changes),
        // Aviasales' own search link for those dates (format as in its API links).
        url: `https://www.aviasales.com/search/${from}${ddmm(out)}${to}${ddmm(back)}1`,
        source: "Aviasales, found by travellers recently",
        departOn: out,
        returnOn: back,
      },
    };
  };

  const main = await fareTo(trip.to);
  if (main.status !== "none") return main;
  // 4. No fares at all to the venue's airport: a nearby bigger airport,
  // named with its distance so the visitor knows it's a different airport.
  for (const alt of trip.alternates ?? []) {
    const r = await fareTo(alt.code);
    if (r.status === "ok" || r.status === "nearby") {
      return { status: "nearby", quote: { ...r.quote, viaAirport: alt } };
    }
  }
  // 5. Then a bigger airport near the traveller (to the venue's airport, or
  // the nearest alternative to it), also named with its distance.
  for (const from of trip.originAlternates ?? []) {
    for (const to of [{ code: trip.to }, ...(trip.alternates ?? []).slice(0, 1)]) {
      const r = await fareTo(to.code, from.code);
      if (r.status === "ok" || r.status === "nearby") {
        return { status: "nearby", quote: { ...r.quote, viaOrigin: from, ...("name" in to ? { viaAirport: to } : {}) } };
      }
    }
  }
  return main;
}
