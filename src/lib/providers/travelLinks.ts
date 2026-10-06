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
  return [
    { site: "Expedia", url: expediaFlightsUrl(trip) },
    { site: "KAYAK", url: `https://www.kayak.com/flights/${route}?sort=price_a` },
    { site: "momondo", url: `https://www.momondo.com/flight-search/${route}?sort=price_a` },
    {
      site: "Priceline",
      url: `https://www.priceline.com/m/fly/search/${trip.from}-${trip.to}-${compact(trip.departOn)}/${trip.to}-${trip.from}-${compact(trip.returnOn)}/?cabin-class=ECO&num-adults=${n}`,
    },
  ];
}

/**
 * The same round trip on the airline's own site, for the airlines whose
 * links were opened in a browser on 2026-10-06 and showed the right airports,
 * dates and travellers: Frontier, JetBlue and United open on the results,
 * Southwest on its booking form, filled in (one tap on Search). Others
 * (American: robot check; Delta and Alaska: dropped the airports) get none.
 * Needs real airports, not city codes.
 */
export function airlineLink(airline: string, trip: FlightTrip): TravelLink | null {
  const n = Math.min(9, Math.max(1, trip.adults));
  const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
  const usDate = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  switch (airline) {
    case "Frontier":
      return {
        site: "Frontier",
        url: `https://booking.flyfrontier.com/Flight/InternalSelect?${q({ o1: trip.from, d1: trip.to, dd1: usDate(trip.departOn), dd2: usDate(trip.returnOn), ADT: String(n), mon: "true", r: "true" })}`,
      };
    case "JetBlue":
      return {
        site: "JetBlue",
        url: `https://www.jetblue.com/booking/flights?${q({ from: trip.from, to: trip.to, depart: trip.departOn, return: trip.returnOn, isMultiCity: "false", noOfRoute: "1", lang: "en", adults: String(n), children: "0", infants: "0", sharedMarket: "false", roundTripFaresFlag: "false", usePoints: "false" })}`,
      };
    case "United":
      return {
        site: "United",
        url: `https://www.united.com/en/us/fsr/choose-flights?${q({ f: trip.from, t: trip.to, d: trip.departOn, r: trip.returnOn, px: String(n), taxng: "1", newHP: "True", clm: "7", st: "bestmatches", tqp: "R" })}`,
      };
    case "Southwest":
      return {
        site: "Southwest",
        url: `https://www.southwest.com/air/booking/select.html?${q({ adultPassengersCount: String(n), departureDate: trip.departOn, departureTimeOfDay: "ALL_DAY", destinationAirportCode: trip.to, fareType: "USD", originationAirportCode: trip.from, passengerType: "ADULT", returnDate: trip.returnOn, returnTimeOfDay: "ALL_DAY", tripType: "roundtrip" })}`,
      };
    default:
      return null;
  }
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
