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
 * needs a free token (TRAVELPAYOUTS_TOKEN). Without one we say so rather than
 * show a made-up fare.
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
}

export type FlightResult =
  | { status: "ok"; quote: FlightQuote }
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
 * Only answers for the exact dates and room sharing we read: one traveller
 * (1 adult) or an even group (2 adults to each room). Anything else returns
 * null, so the page shows booking links rather than a price for a different
 * stay. The quote is for one room.
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
  if (!snap || snap.checkIn !== stay.checkIn || snap.checkOut !== stay.checkOut) return null;
  const search = stay.adults === 1 ? snap : stay.adults % 2 === 0 ? snap.pair : undefined;
  const best = search?.hotels[0];
  if (!search || !best) return null;
  const [name, perNight, total, distance, room, path] = best;
  const nights = Math.round((Date.parse(stay.checkOut) - Date.parse(stay.checkIn)) / 86_400_000);
  const perRoom = stay.adults === 1 ? 1 : 2;
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
  };
}

export async function cheapestFlight(trip: {
  from: string;
  to: string;
  departOn: string;
  returnOn: string;
}): Promise<FlightResult> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    // No live feed: fall back to fares read from Expedia's own results.
    const saved = expediaFareFor(trip);
    return saved ? { status: "ok", quote: saved } : { status: "no-key" };
  }

  const params = new URLSearchParams({
    origin: trip.from,
    destination: trip.to,
    departure_at: trip.departOn,
    return_at: trip.returnOn,
    currency: "usd",
    sorting: "price",
    one_way: "false",
    limit: "1",
    token,
  });
  const r = await getJson<{
    data?: { price: number; airline: string; transfers: number; link: string }[];
  }>(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`);
  const f = r?.data?.[0];
  if (!f) return { status: "none" };
  return {
    status: "ok",
    quote: {
      perPerson: f.price,
      airline: f.airline,
      stopsLabel: f.transfers === 0 ? "Nonstop" : `${f.transfers} stop${f.transfers > 1 ? "s" : ""}`,
      url: `https://www.aviasales.com${f.link}`,
      source: "Aviasales, found in the last few days",
    },
  };
}
