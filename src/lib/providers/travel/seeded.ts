import type { Money, TravelMode, TravelOption } from "@/lib/domain/types";
import { intBetween, pick, rngFrom } from "@/lib/data/random";
import {
  AIRPORTS_BY_IATA,
  haversineKm,
  resolveOrigin,
} from "@/lib/providers/geo";
import type {
  ProviderResult,
  TravelProvider,
  TravelQuery,
} from "@/lib/providers/types";

/**
 * Seeded travel search.
 *
 * Routes are priced off great-circle distance with the kinks real airfare has:
 * short hops are expensive per kilometre, long-haul is cheap per kilometre, and
 * a connection saves money but costs hours. Rail and coach are offered only
 * where they're actually competitive — under ~800km, same landmass.
 */

const AIRLINES_BY_REGION: Record<string, string[]> = {
  US: ["Delta", "United", "American", "Alaska", "JetBlue", "Southwest"],
  GB: ["British Airways", "easyJet", "Virgin Atlantic", "Ryanair"],
  EU: ["Lufthansa", "Air France", "KLM", "Iberia", "ITA Airways", "Ryanair"],
  ASIA: ["Singapore Airlines", "ANA", "Emirates", "Qatar Airways", "Cathay Pacific"],
  OTHER: ["Qantas", "Air Canada", "LATAM", "Turkish Airlines"],
};

function airlinesFor(country: string): string[] {
  if (country === "US" || country === "CA") return AIRLINES_BY_REGION.US;
  if (country === "GB") return AIRLINES_BY_REGION.GB;
  if (["FR", "DE", "ES", "IT", "NL", "MC"].includes(country))
    return AIRLINES_BY_REGION.EU;
  if (["JP", "SG", "IN", "AE", "TR", "KR"].includes(country))
    return AIRLINES_BY_REGION.ASIA;
  return AIRLINES_BY_REGION.OTHER;
}

const RAIL_OPERATORS: Record<string, string> = {
  GB: "LNER",
  FR: "SNCF",
  DE: "Deutsche Bahn",
  ES: "Renfe",
  IT: "Trenitalia",
  US: "Amtrak",
  JP: "JR",
};

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

  // Same airport: no travel leg to sell.
  if (origin.iata === destination.iata) return [];

  const km = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const arriveBy = Date.parse(query.arriveBy);
  const options: TravelOption[] = [];
  const carriers = airlinesFor(origin.country);

  // Three flight shapes: nonstop, one-stop saver, and a red-eye.
  const shapes: { stops: number; priceMul: number; label: string }[] = [
    { stops: 0, priceMul: 1.0, label: "nonstop" },
    { stops: 1, priceMul: 0.78, label: "one-stop" },
    { stops: km > 1200 ? 1 : 0, priceMul: 0.66, label: "red-eye" },
  ];

  shapes.forEach((shape, i) => {
    const rng = rngFrom(`${origin.iata}:${destination.iata}:${query.arriveBy}:${i}`);
    const duration = flightMinutes(km, shape.stops);
    // Land a few hours before the event, or the night before for long-haul.
    const bufferHours = km > 3000 ? intBetween(rng, 14, 22) : intBetween(rng, 4, 9);
    const arrivesAt = arriveBy - bufferHours * 3600_000;
    const departsAt = arrivesAt - duration * 60_000;

    const fare =
      baseFareCents(km) *
      shape.priceMul *
      (0.85 + rng() * 0.4) *
      Math.max(1, query.passengers);

    options.push({
      id: `flight-${origin.iata}-${destination.iata}-${i}`,
      mode: "flight",
      fromCode: origin.iata,
      toCode: destination.iata,
      carrier: pick(rng, carriers),
      departsAt: new Date(departsAt).toISOString(),
      arrivesAt: new Date(arrivesAt).toISOString(),
      durationMinutes: duration,
      stops: shape.stops,
      price: money(fare),
      deepLink: `https://www.google.com/travel/flights?q=${origin.iata}+to+${destination.iata}`,
    });
  });

  // Surface ground transport only where it genuinely beats flying.
  const sameLandmass = origin.country === destination.country;
  if (km < 800 && sameLandmass) {
    const rng = rngFrom(`rail:${origin.iata}:${destination.iata}`);
    const railMinutes = Math.round(60 + (km / 200) * 60);
    const arrivesAt = arriveBy - intBetween(rng, 3, 6) * 3600_000;

    const groundModes: { mode: TravelMode; mul: number; speed: number }[] = [
      { mode: "train", mul: 0.55, speed: 1 },
      { mode: "bus", mul: 0.22, speed: 1.9 },
      { mode: "drive", mul: 0.35, speed: 1.5 },
    ];

    for (const g of groundModes) {
      const duration = Math.round(railMinutes * g.speed);
      options.push({
        id: `${g.mode}-${origin.iata}-${destination.iata}`,
        mode: g.mode,
        fromCode: g.mode === "drive" ? "DRIVE" : origin.city,
        toCode: g.mode === "drive" ? "DRIVE" : destination.city,
        carrier:
          g.mode === "drive"
            ? "Own vehicle (fuel + tolls)"
            : g.mode === "bus"
              ? "FlixBus"
              : (RAIL_OPERATORS[origin.country] ?? "National rail"),
        departsAt: new Date(arrivesAt - duration * 60_000).toISOString(),
        arrivesAt: new Date(arrivesAt).toISOString(),
        durationMinutes: duration,
        stops: 0,
        price: money(baseFareCents(km) * g.mul * Math.max(1, query.passengers)),
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
