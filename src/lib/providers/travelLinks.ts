import { adultsPerRoom, expediaFlightsUrl, expediaHotelsUrl } from "./expedia";

/**
 * Pre-filled searches for the same trip on several booking sites, each opened
 * cheapest-first, so people can compare without retyping anything.
 *
 * Flight and hotel prices change with every search and none of these sites
 * offers an open price feed, so we link to their live results rather than
 * show a number we'd have to guess. Every format below was opened in a browser
 * on 2026-09-28 and landed on the right route, dates, people and place.
 * Left out on purpose: Skyscanner (couldn't verify, it serves a robot check),
 * Hotels.com and KAYAK hotels (both drop the venue location and search the
 * whole city).
 */

export interface TravelLink {
  site: string;
  url: string;
}

interface FlightTrip {
  /** IATA airport or metro code, e.g. "NYC", "LHR". */
  from: string;
  to: string;
  departOn: string;
  returnOn: string;
  adults: number;
}

const compact = (date: string) => date.replaceAll("-", "");

export function flightLinks(trip: FlightTrip): TravelLink[] {
  const n = Math.max(1, trip.adults);
  const route = `${trip.from}-${trip.to}/${trip.departOn}/${trip.returnOn}/${n}adults`;
  // Aviasales: "LAX0711DTW09111" = LAX, 7 Nov, DTW, back 9 Nov, 1 adult
  // (opened 2026-10-03: the page showed those dates and live fares). Listed
  // first: each search there also records the fare for those exact dates in
  // the Travelpayouts feed, so the next visitor planning that trip sees it.
  const ddmm = (date: string) => `${date.slice(8, 10)}${date.slice(5, 7)}`;
  const marker = process.env.TRAVELPAYOUTS_MARKER;
  const aviasales = `https://www.aviasales.com/search/${trip.from}${ddmm(trip.departOn)}${trip.to}${ddmm(trip.returnOn)}${Math.min(n, 9)}${marker ? `?marker=${marker}` : ""}`;
  return [
    { site: "Aviasales", url: aviasales },
    { site: "Expedia", url: expediaFlightsUrl(trip) },
    { site: "KAYAK", url: `https://www.kayak.com/flights/${route}?sort=price_a` },
    { site: "momondo", url: `https://www.momondo.com/flight-search/${route}?sort=price_a` },
    {
      site: "Priceline",
      url: `https://www.priceline.com/m/fly/search/${trip.from}-${trip.to}-${compact(trip.departOn)}/${trip.to}-${trip.from}-${compact(trip.returnOn)}/?cabin-class=ECO&num-adults=${n}`,
    },
  ];
}

export function hotelLinks(stay: {
  destination: string;
  lat: number;
  lon: number;
  checkIn: string;
  checkOut: string;
  adults: number;
}): TravelLink[] {
  const rooms = adultsPerRoom(stay.adults);
  const booking = new URLSearchParams({
    ss: stay.destination,
    latitude: String(stay.lat),
    longitude: String(stay.lon),
    checkin: stay.checkIn,
    checkout: stay.checkOut,
    group_adults: String(Math.max(1, stay.adults)),
    no_rooms: String(rooms.length),
    group_children: "0",
    // Cheapest first, hotels only (no hostels or flat shares).
    order: "price",
    nflt: "ht_id=204;distance=5000",
  });
  // Hotels.com: cheapest first around the venue for the same dates (checked:
  // the page opens with those dates, sorted "price: low to high").
  const hotelsCom = new URLSearchParams({
    destination: stay.destination,
    latLong: `${stay.lat},${stay.lon}`,
    startDate: stay.checkIn,
    endDate: stay.checkOut,
    adults: String(Math.max(1, stay.adults)),
    rooms: String(rooms.length),
    sort: "PRICE_LOW_TO_HIGH",
  });
  return [
    { site: "Booking.com", url: `https://www.booking.com/searchresults.html?${booking}` },
    { site: "Expedia", url: expediaHotelsUrl(stay) },
    { site: "Hotels.com", url: `https://www.hotels.com/Hotel-Search?${hotelsCom}` },
  ];
}
