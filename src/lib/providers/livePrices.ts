import { unstable_cache } from "next/cache";
import { RATES } from "@/lib/data/prices";
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

// One hour, so a fare someone just searched shows up soon after.
const CACHE = { next: { revalidate: 60 * 60 } };

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
  // Fares move daily: a saved one older than 3 days isn't shown or added up.
  if (!f || (Date.now() - Date.parse(`${expediaFares.checkedOn}T12:00:00Z`)) / 86_400_000 > 3) return null;
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
  /** Up to three choices for the same stay (cheapest, best reviewed, closest). */
  options: HotelOption[];
  /** Which of the options this quote is. */
  pick: number;
}

/** One hotel choice for the stay, as Booking.com listed it. */
export interface HotelOption {
  name: string;
  perNight: number;
  total: number;
  distance: string;
  room: string;
  url: string;
  /** Booking.com guest score out of 10, and how many reviews it's from. */
  score: number | null;
  reviews: number | null;
  /** The rate shown had free cancellation. */
  freeCancellation: boolean;
  /** "cheapest", "best-rated", "closest" (one hotel can be several). */
  tags: string[];
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
  /** The dates this fare is for (YYYY-MM-DD): always the visitor's own. */
  departOn?: string;
  returnOn?: string;
  /** "NYC → DTW": the airport (or city) codes searched. */
  route?: string;
}

export type FlightResult =
  | { status: "ok"; quote: FlightQuote; options?: FlightQuote[] }
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

type SnapshotHotel = [
  name: string, perNight: number, total: number, distance: string, room: string, path: string, nights: string,
  score?: number | null, reviews?: number | null, free?: boolean, tags?: string,
];
interface SnapshotSearch {
  found: string | null;
  wide: boolean;
  hotels: SnapshotHotel[];
}
/** One search for 1 adult, and (`pair`) one for 2 adults sharing a room. */
const HOTELS = hotelSnapshot.events as unknown as Record<string, SnapshotSearch & { checkIn: string; checkOut: string; pair?: SnapshotSearch; checkedOn?: string }>;

/** A saved hotel price older than this many days isn't shown (links are). */
const MAX_HOTEL_AGE_DAYS = 14;

/** Days since this stay's hotel price was read ("5 October 2026", or the file's "28–29 September 2026"). */
function hotelAgeDays(snap: { checkedOn?: string }): number {
  const label = (snap.checkedOn ?? hotelSnapshot.checkedOn).replace(/^(\d+)[–-]\d+/, "$1");
  const read = Date.parse(`${label} 12:00 UTC`);
  return Number.isFinite(read) ? (Date.now() - read) / 86_400_000 : Infinity;
}

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
  /** The venue's country (ISO code): a hotel across a border isn't offered. */
  country: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  /** Which hotel option the visitor picked (0 = cheapest). */
  pick?: number;
}): Promise<HotelQuote | null> {
  const snap = HOTELS[stay.eventId];
  if (!snap || hotelAgeDays(snap) > MAX_HOTEL_AGE_DAYS) return null;
  const forYourDates = snap.checkIn === stay.checkIn && snap.checkOut === stay.checkOut;
  // One traveller: a room for 1. Groups: rooms for 2 (an odd one out gets a
  // room for 2 as well, so their price is that room's).
  const search = stay.adults === 1 ? snap : snap.pair;
  // Booking.com paths carry the hotel's country ("/hotel/ca/…"). Detroit's
  // cheapest was in Windsor, Canada: close, but across a border, so those
  // aren't offered.
  const inCountry = (search?.hotels ?? []).filter((h) => h[5].split("/")[2] === stay.country.toLowerCase());
  const pick = Math.min(Math.max(0, stay.pick ?? 0), Math.max(0, inCountry.length - 1));
  const best = inCountry[pick];
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
  const options: HotelOption[] = inCountry.map((h, i) => ({
    name: h[0],
    perNight: h[1],
    total: h[2],
    distance: h[3],
    room: h[4],
    url: `https://www.booking.com${h[5]}?${dates}`,
    score: h[7] ?? null,
    reviews: h[8] ?? null,
    freeCancellation: !!h[9],
    tags: h[10] ? h[10].split(",") : i === 0 ? ["cheapest"] : [],
  }));
  return {
    options,
    pick,
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
    // Detroit stays were re-checked on their own date (US-side hotels only).
    checkedOn: snap.checkedOn ?? hotelSnapshot.checkedOn,
    checkIn: snap.checkIn,
    checkOut: snap.checkOut,
    forYourDates,
  };
}

/**
 * The cheapest round-trip fare for the visitor's exact dates and airports,
 * never another day or another airport. In order:
 *
 * 1. Duffel (when DUFFEL_ACCESS_TOKEN is set): live airline fares, priced
 *    the moment we ask. Cached for 3 hours per route, dates and group size.
 * 2. Travelpayouts (TRAVELPAYOUTS_TOKEN): the cheapest fare travellers found
 *    for these exact dates in the last few days.
 * 3. Fares read from Expedia's own results (flight-prices.json).
 *
 * Nothing found means no price: the page links to live fares for the dates.
 */
export async function cheapestFlight(trip: {
  from: string;
  to: string;
  departOn: string;
  returnOn: string;
  adults: number;
  /** Where "see this fare" goes for a live airline fare (a search for the same dates). */
  bookUrl: string;
}): Promise<FlightResult> {
  const result = await findFlight(trip);
  // Say which airports the fare is between (a city code like NYC means any of its airports).
  if (result.status !== "ok") return result;
  const route = `${trip.from} → ${trip.to}`;
  return { ...result, quote: { ...result.quote, route }, options: (result.options ?? [result.quote]).map((q) => ({ ...q, route })) };
}

async function findFlight(trip: Parameters<typeof cheapestFlight>[0]): Promise<FlightResult> {
  const live = await duffelFare(trip);
  if (live) return { status: "ok", quote: live };

  // Amadeus (live fares, any route, these exact dates).
  const amadeus = await amadeusFares(trip);
  if (amadeus?.length) return { status: "ok", quote: amadeus[0], options: amadeus };

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (token) {
    type Fare = { price: number; airline: string; transfers: number; link: string; departure_at: string; return_at: string };
    const params = new URLSearchParams({ origin: trip.from, destination: trip.to, departure_at: trip.departOn, return_at: trip.returnOn, currency: "usd", sorting: "price", one_way: "false", limit: "10", token });
    const r = await getJson<{ data?: Fare[] }>(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`);
    // Only a fare for exactly these dates counts (cheapest first).
    const exact = (r?.data ?? [])
      .filter((x) => x.departure_at.slice(0, 10) === trip.departOn && x.return_at.slice(0, 10) === trip.returnOn)
      .sort((a, b) => a.price - b.price);
    const toQuote = (f: Fare): FlightQuote => ({
      perPerson: f.price,
      airline: AIRLINES[f.airline] ?? f.airline,
      stopsLabel: stopsLabel(f.transfers),
      url: `https://www.aviasales.com${f.link}`,
      source: "Aviasales: a fare travellers found in the last few days, which may have gone",
      departOn: trip.departOn,
      returnOn: trip.returnOn,
    });
    if (exact.length) {
      // Choices: the cheapest, the cheapest nonstop, and another airline.
      const picks = [exact[0], exact.find((f) => f.transfers === 0), exact.find((f) => f.airline !== exact[0].airline)];
      const options = [...new Set(picks.filter((f): f is Fare => !!f))].map(toQuote);
      return { status: "ok", quote: options[0], options };
    }
  }

  const saved = expediaFareFor(trip);
  if (saved) return { status: "ok", quote: saved };
  return { status: token || process.env.DUFFEL_ACCESS_TOKEN ? "none" : "no-key" };
}

const stopsLabel = (n: number) => (n === 0 ? "Nonstop" : `${n} stop${n > 1 ? "s" : ""}`);

interface DuffelOffer {
  total_amount: string;
  total_currency: string;
  owner: { name: string };
  slices: { segments: unknown[] }[];
}

/** Live airline fares from Duffel's offer search: the cheapest offer, in US dollars. */
/**
 * Live round-trip fares from Amadeus Flight Offers Search for the exact dates
 * and airports (city codes like NYC cover every airport there). Production
 * only: Amadeus's test host serves sample data, not real prices. Returns up
 * to three choices (cheapest, cheapest nonstop, another airline), per person.
 */
const amadeusFares = unstable_cache(
  async (trip: { from: string; to: string; departOn: string; returnOn: string; adults: number; bookUrl: string }): Promise<FlightQuote[] | null> => {
    const id = process.env.AMADEUS_CLIENT_ID?.trim();
    const secret = process.env.AMADEUS_CLIENT_SECRET?.trim();
    if (!id || !secret || process.env.AMADEUS_ENV !== "production") return null;
    const host = "https://api.amadeus.com";
    try {
      const auth = await fetch(`${host}/v1/security/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!auth.ok) return null;
      const { access_token } = (await auth.json()) as { access_token?: string };
      if (!access_token) return null;
      const adults = Math.max(1, Math.min(9, trip.adults));
      const q = new URLSearchParams({
        originLocationCode: trip.from,
        destinationLocationCode: trip.to,
        departureDate: trip.departOn,
        returnDate: trip.returnOn,
        adults: String(adults),
        currencyCode: "USD",
        max: "30",
      });
      const res = await fetch(`${host}/v2/shopping/flight-offers?${q}`, {
        headers: { Authorization: `Bearer ${access_token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return null;
      type Offer = {
        price?: { grandTotal?: string; currency?: string };
        validatingAirlineCodes?: string[];
        itineraries?: { segments?: unknown[] }[];
      };
      const body = (await res.json()) as { data?: Offer[]; dictionaries?: { carriers?: Record<string, string> } };
      const offers = (body.data ?? [])
        .map((o) => {
          const total = Number(o.price?.grandTotal);
          const code = o.validatingAirlineCodes?.[0] ?? "";
          const legs = (o.itineraries ?? []).map((i) => (i.segments ?? []).length);
          return {
            perPerson: Math.round((total / adults) * 100) / 100,
            code,
            stops: legs.length ? Math.max(...legs) - 1 : 0,
            ok: o.price?.currency === "USD" && total > 0 && legs.length === 2,
          };
        })
        .filter((o) => o.ok)
        .sort((a, b) => a.perPerson - b.perPerson);
      if (!offers.length) return null;
      const name = (code: string) => {
        const raw = AIRLINES[code] ?? body.dictionaries?.carriers?.[code] ?? code;
        return raw === raw.toUpperCase() ? raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : raw;
      };
      const picks = [offers[0], offers.find((o) => o.stops === 0), offers.find((o) => o.code !== offers[0].code)];
      return [...new Set(picks.filter((o): o is (typeof offers)[number] => !!o))].map((o) => ({
        perPerson: o.perPerson,
        airline: name(o.code),
        stopsLabel: stopsLabel(o.stops),
        url: trip.bookUrl,
        source: "Live fare (Amadeus), checked within the last hour",
        departOn: trip.departOn,
        returnOn: trip.returnOn,
      }));
    } catch {
      return null;
    }
  },
  ["amadeus-fares"],
  { revalidate: 3600 },
);

const duffelFare = unstable_cache(
  async (trip: { from: string; to: string; departOn: string; returnOn: string; adults: number; bookUrl: string }): Promise<FlightQuote | null> => {
    const key = process.env.DUFFEL_ACCESS_TOKEN;
    // A test key returns made-up "Duffel Airways" fares: never on the live site.
    if (!key || (key.startsWith("duffel_test_") && process.env.NODE_ENV === "production")) return null;
    try {
      const res = await fetch("https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=8000", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Duffel-Version": "v2", "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          data: {
            slices: [
              { origin: trip.from, destination: trip.to, departure_date: trip.departOn },
              { origin: trip.to, destination: trip.from, departure_date: trip.returnOn },
            ],
            passengers: Array.from({ length: trip.adults }, () => ({ type: "adult" })),
            cabin_class: "economy",
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return null;
      const offers = ((await res.json()) as { data?: { offers?: DuffelOffer[] } }).data?.offers ?? [];
      // In US dollars, converting euros and pounds at the same stored ECB rate
      // as ticket prices. Any other currency is skipped rather than guessed.
      const usd = (o: DuffelOffer) =>
        o.total_currency === "USD" ? Number(o.total_amount)
        : o.total_currency === "EUR" || o.total_currency === "GBP" ? Number(o.total_amount) / RATES[o.total_currency]
        : null;
      const best = offers
        .map((o) => ({ o, amount: usd(o) }))
        .filter((x): x is { o: DuffelOffer; amount: number } => x.amount !== null && x.amount > 0)
        .sort((a, b) => a.amount - b.amount)[0];
      if (!best) return null;
      const stops = Math.max(...best.o.slices.map((sl) => sl.segments.length - 1));
      return {
        perPerson: Math.round((best.amount / trip.adults) * 100) / 100,
        airline: best.o.owner.name,
        stopsLabel: stopsLabel(stops),
        url: trip.bookUrl,
        source: "Airline fare, checked in the last few hours",
        departOn: trip.departOn,
        returnOn: trip.returnOn,
      };
    } catch {
      return null;
    }
  },
  ["duffel-fare"],
  { revalidate: 3 * 60 * 60 },
);


/** Airline names for the two-letter codes Aviasales returns ("F9" → Frontier). */
const AIRLINES: Record<string, string> = {
  AA: "American Airlines", DL: "Delta", UA: "United", WN: "Southwest", B6: "JetBlue",
  AS: "Alaska Airlines", F9: "Frontier", NK: "Spirit", G4: "Allegiant", SY: "Sun Country",
  MX: "Breeze Airways", HA: "Hawaiian Airlines", AC: "Air Canada", WS: "WestJet", PD: "Porter",
  AM: "Aeroméxico", Y4: "Volaris", VB: "Viva Aerobus", BA: "British Airways", VS: "Virgin Atlantic",
  U2: "easyJet", FR: "Ryanair", W6: "Wizz Air", LS: "Jet2", EI: "Aer Lingus", LH: "Lufthansa",
  AF: "Air France", KL: "KLM", IB: "Iberia", VY: "Vueling", TP: "TAP Air Portugal", LX: "Swiss",
  OS: "Austrian", SN: "Brussels Airlines", SK: "SAS", AY: "Finnair", DY: "Norwegian",
  AZ: "ITA Airways", TK: "Turkish Airlines", EK: "Emirates", QR: "Qatar Airways", EY: "Etihad",
  SQ: "Singapore Airlines", MH: "Malaysia Airlines", AK: "AirAsia", CX: "Cathay Pacific",
  LA: "LATAM", CM: "Copa Airlines", AV: "Avianca", NH: "ANA", JL: "Japan Airlines",
};

/**
 * The saved cheapest hotel for a game's default stay, for one person (used by
 * the budget trip finder). Only stays that haven't started yet, and only
 * hotels in the venue's own country.
 */
export function savedHotelFor(eventId: string, country: string): { name: string; total: number; nights: number; checkIn: string; checkOut: string } | null {
  const snap = HOTELS[eventId];
  const best = snap?.hotels[0];
  if (!snap || !best || hotelAgeDays(snap) > MAX_HOTEL_AGE_DAYS) return null;
  if (Date.parse(snap.checkIn) < Date.now() - 864e5) return null;
  const [name, , total, , , path] = best;
  if (path.split("/")[2] !== country.toLowerCase()) return null;
  const nights = Math.round((Date.parse(snap.checkOut) - Date.parse(snap.checkIn)) / 86_400_000);
  return { name, total, nights, checkIn: snap.checkIn, checkOut: snap.checkOut };
}
