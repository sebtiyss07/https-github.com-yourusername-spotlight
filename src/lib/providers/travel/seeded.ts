import type { Money, TravelMode, TravelOption } from "@/lib/domain/types";
import { intBetween, rngFrom } from "@/lib/data/random";
import {
  AIRPORTS_BY_IATA,
  flightSearchCode,
  haversineKm,
  resolveOrigin,
} from "@/lib/providers/geo";
import { expediaFlightsUrl } from "@/lib/providers/expedia";
import type {
  ProviderResult,
  TravelProvider,
  TravelQuery,
} from "@/lib/providers/types";

/**
 * Seeded travel search — example round-trip fares, not live ones.
 *
 * Routes are priced off great-circle distance with the kinks real airfare has:
 * short hops are expensive per kilometre, long-haul is cheap per kilometre, and
 * a connection saves money but costs hours. Rail and coach are offered only
 * where they're actually competitive — under ~800km, same landmass.
 *
 * No airline or operator names: a randomly chosen real carrier on a route it
 * may not fly is a detail that looks true and isn't. Carriers come back once a
 * live provider supplies them.
 */

function money(amount: number): Money {
  return { amount: Math.round(amount), currency: "USD" };
}

/**
 * Distance → fare. Piecewise because airfare genuinely isn't linear: the fixed
 * cost of a departure dominates short routes, and marginal cost dominates long
 * ones.
 */
function baseFareCents(km: number): number {
  if (km < 400) return 9_000 + km * 22;
  if (km < 1_500) return 12_000 + km * 11;
  if (km < 4_000) return 20_000 + km * 6.5;
  return 38_000 + km * 3.8;
}

function flightMinutes(km: number, stops: number): number {
  const cruise = 45 + (km / 800) * 60;
  return Math.round(cruise + stops * intBetween(rngFrom(`${km}:${stops}`), 70, 160));
}

export function buildTravelOptions(query: TravelQuery): TravelOption[] {
  const origin = resolveOrigin(query.origin);
  const destination = AIRPORTS_BY_IATA.get(query.destinationAirport);
  if (!origin || !destination) return [];

  // Same airport, or same city (JFK vs Newark): no flight to sell.
  if (flightSearchCode(origin) === flightSearchCode(destination)) return [];

  const km = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const arriveBy = Date.parse(query.arriveBy);
  const passengers = Math.max(1, query.passengers);
  const options: TravelOption[] = [];

  const flightLink = expediaFlightsUrl({
    from: flightSearchCode(origin),
    to: flightSearchCode(destination),
    departOn: query.departOn,
    returnOn: query.returnOn,
    adults: passengers,
  });

  // Three flight shapes: nonstop, one-stop saver, and a red-eye.
  const shapes: { stops: number; priceMul: number }[] = [
    { stops: 0, priceMul: 1.0 },
    { stops: 1, priceMul: 0.78 },
    { stops: km > 1200 ? 1 : 0, priceMul: 0.66 },
  ];

  shapes.forEach((shape, i) => {
    const seed = `${origin.iata}:${destination.iata}:${query.departOn}:${query.returnOn}:${i}`;
    const out = rngFrom(`${seed}:out`);
    const back = rngFrom(`${seed}:back`);
    const duration = flightMinutes(km, shape.stops);
    // Land a few hours before the event, or the night before for long-haul.
    const bufferHours = km > 3000 ? intBetween(out, 14, 22) : intBetween(out, 4, 9);
    const arrivesAt = arriveBy - bufferHours * 3600_000;
    const departsAt = arrivesAt - duration * 60_000;

    // Each direction priced on its own, then added — a return ticket.
    const legFare = (rng: () => number) =>
      baseFareCents(km) * shape.priceMul * (0.85 + rng() * 0.4) * passengers;

    options.push({
      id: `flight-${origin.iata}-${destination.iata}-${i}`,
      mode: "flight",
      fromCode: origin.iata,
      toCode: destination.iata,
      carrier: "Economy",
      departsAt: new Date(departsAt).toISOString(),
      arrivesAt: new Date(arrivesAt).toISOString(),
      durationMinutes: duration,
      stops: shape.stops,
      price: money(legFare(out) + legFare(back)),
      roundTrip: true,
      deepLink: flightLink,
    });
  });

  // Surface ground transport only where it genuinely beats flying.
  const sameLandmass = origin.country === destination.country;
  if (km < 800 && sameLandmass) {
    const rng = rngFrom(`rail:${origin.iata}:${destination.iata}`);
    const railMinutes = Math.round(60 + (km / 200) * 60);
    const arrivesAt = arriveBy - intBetween(rng, 3, 6) * 3600_000;

    const groundModes: { mode: TravelMode; mul: number; speed: number; carrier: string }[] = [
      { mode: "train", mul: 0.55, speed: 1, carrier: "Train" },
      { mode: "bus", mul: 0.22, speed: 1.9, carrier: "Bus" },
      { mode: "drive", mul: 0.35, speed: 1.5, carrier: "Your own car (fuel and tolls)" },
    ];

    for (const g of groundModes) {
      const duration = Math.round(railMinutes * g.speed);
      options.push({
        id: `${g.mode}-${origin.iata}-${destination.iata}`,
        mode: g.mode,
        fromCode: g.mode === "drive" ? "DRIVE" : origin.city,
        toCode: g.mode === "drive" ? "DRIVE" : destination.city,
        carrier: g.carrier,
        departsAt: new Date(arrivesAt - duration * 60_000).toISOString(),
        arrivesAt: new Date(arrivesAt).toISOString(),
        durationMinutes: duration,
        stops: 0,
        // There and back. Driving is one car, not one per passenger.
        price: money(
          baseFareCents(km) * g.mul * 2 * (g.mode === "drive" ? 1 : passengers),
        ),
        roundTrip: true,
        deepLink:
          g.mode === "drive"
            ? `https://www.google.com/maps/dir/${encodeURIComponent(origin.city)}/${encodeURIComponent(destination.city)}`
            : `https://www.google.com/search?q=${encodeURIComponent(`${origin.city} to ${destination.city} ${g.mode}`)}`,
      });
    }
  }

  return options.sort((a, b) => a.price.amount - b.price.amount);
}

export const seededTravelProvider: TravelProvider = {
  name: "seeded",
  enabled: true,
  synthetic: true,
  async search(query: TravelQuery): Promise<ProviderResult<TravelOption>> {
    return {
      items: buildTravelOptions(query),
      sources: ["Seeded route model"],
      errors: [],
      fetchedAt: new Date().toISOString(),
    };
  },
};
