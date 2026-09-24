import type { Money, StayKind, StayOption } from "@/lib/domain/types";
import { intBetween, pick, rngFrom, shuffled } from "@/lib/data/random";
import type {
  ProviderResult,
  StayProvider,
  StayQuery,
} from "@/lib/providers/types";

/**
 * Seeded accommodation search.
 *
 * Ranked and priced by walking distance to the venue, because that's the axis
 * every other booking site buries. A hotel 400m from the gate at $260 beats one
 * 6km away at $190 once you've paid for two taxis at surge pricing after a
 * sold-out event — and this is the comparison the product is meant to make
 * obvious.
 */

const HOTEL_BRANDS = [
  "The Warwick", "Hyatt Place", "Kimpton", "Marriott Courtyard", "Hilton Garden Inn",
  "AC Hotel", "Moxy", "Aloft", "Le Méridien", "The Ridgeline", "Canopy",
  "Residence Inn", "The Quarter", "Novotel", "citizenM",
];

const HOSTEL_BRANDS = ["Generator", "HI Hostel", "Wombat's", "The Circus", "Selina"];
const APARTMENT_BRANDS = ["Sonder", "Locke", "Blueground", "Native Places"];
const RENTAL_BRANDS = ["Private host", "Entire flat", "Loft rental", "Guest suite"];

const AMENITIES = [
  "Free Wi-Fi", "Breakfast included", "Gym", "24h reception", "Bar",
  "Free cancellation", "Airport shuttle", "Late checkout", "Air conditioning",
  "Luggage storage", "Pool", "Pet friendly",
];

interface KindProfile {
  kind: StayKind;
  brands: string[];
  /** Nightly rate multiplier vs. the market baseline. */
  priceMul: number;
  ratingFloor: number;
  count: number;
}

const PROFILES: KindProfile[] = [
  { kind: "hotel", brands: HOTEL_BRANDS, priceMul: 1.0, ratingFloor: 7.4, count: 7 },
  { kind: "apartment", brands: APARTMENT_BRANDS, priceMul: 0.86, ratingFloor: 8.0, count: 3 },
  { kind: "rental", brands: RENTAL_BRANDS, priceMul: 0.72, ratingFloor: 7.8, count: 3 },
  { kind: "hostel", brands: HOSTEL_BRANDS, priceMul: 0.3, ratingFloor: 7.0, count: 2 },
];

function money(amount: number): Money {
  return { amount: Math.round(amount), currency: "USD" };
}

/**
 * Nightly baseline by market. Coordinates are enough to place a venue in a
 * pricing band without a separate city lookup.
 */
function marketBaseline(lat: number, lon: number): number {
  // Western Europe
  if (lat > 35 && lat < 60 && lon > -10 && lon < 20) return 21_000;
  // North America
  if (lat > 24 && lat < 55 && lon > -130 && lon < -60) return 24_000;
  // Japan / Korea
  if (lat > 30 && lat < 46 && lon > 125 && lon < 146) return 16_000;
  // South Asia
  if (lat > 6 && lat < 35 && lon > 66 && lon < 92) return 7_000;
  // Australia
  if (lat < -10 && lon > 110 && lon < 155) return 19_000;
  // Latin America
  if (lat > -35 && lat < 25 && lon > -110 && lon < -35) return 11_000;
  return 15_000;
}

/**
 * Proximity premium. Steep inside 1km — that's the walkable band, and it's
 * priced accordingly on event nights.
 */
function distancePremium(metres: number): number {
  if (metres < 500) return 1.55;
  if (metres < 1_000) return 1.32;
  if (metres < 2_000) return 1.12;
  if (metres < 4_000) return 0.98;
  return 0.85;
}

export function buildStayOptions(query: StayQuery): StayOption[] {
  const baseline = marketBaseline(query.lat, query.lon);
  const nights = Math.max(
    1,
    Math.round(
      (Date.parse(query.checkOut) - Date.parse(query.checkIn)) / 86_400_000,
    ),
  );
  const options: StayOption[] = [];

  for (const profile of PROFILES) {
    for (let i = 0; i < profile.count; i++) {
      const seed = `stay:${query.lat.toFixed(3)}:${query.lon.toFixed(3)}:${profile.kind}:${i}`;
      const rng = rngFrom(seed);

      const distance = intBetween(rng, 220, 7_500);
      const rate =
        baseline *
        profile.priceMul *
        distancePremium(distance) *
        (0.78 + rng() * 0.55) *
        // Larger parties need larger rooms.
        (query.guests > 2 ? 1.35 : 1);

      options.push({
        id: seed,
        kind: profile.kind,
        name: `${pick(rng, profile.brands)} ${["Central", "Stadium District", "Riverside", "Old Town", "Downtown", "North Quarter"][intBetween(rng, 0, 5)]}`,
        distanceToVenueM: distance,
        rating: Number(
          (profile.ratingFloor + rng() * (9.7 - profile.ratingFloor)).toFixed(1),
        ),
        reviewCount: intBetween(rng, 84, 4_200),
        pricePerNight: money(rate),
        amenities: shuffled(rng, AMENITIES).slice(0, intBetween(rng, 3, 5)),
        deepLink: `https://www.google.com/travel/hotels?q=${encodeURIComponent(
          `hotels near ${query.lat.toFixed(4)},${query.lon.toFixed(4)}`,
        )}`,
      });
    }
  }

  const filtered =
    query.maxPerNight !== undefined
      ? options.filter((o) => o.pricePerNight.amount <= query.maxPerNight!.amount)
      : options;

  // Note: `nights` doesn't change nightly rate here, but a real provider prices
  // multi-night stays differently (minimum-stay rules around big events), so
  // it stays part of the query contract.
  void nights;

  // Ranked by true nightly cost, not headline rate — see `effectiveNightly`.
  return filtered.sort((a, b) => effectiveNightly(a) - effectiveNightly(b));
}

/**
 * What a night actually costs you.
 *
 * Sorting accommodation by nightly rate is how every booking site does it, and
 * it's wrong for event travel: a room 6km out at $43 looks like the winner
 * until you add two surge-priced cab rides on a night when 78,000 people leave
 * the same postcode at once. So we add the cost of getting to the ground and
 * back, and rank on the total.
 *
 * Inside the walkable band that surcharge is zero, which is exactly why the
 * genuinely close options rise to the top instead of being buried.
 */
export function transportSurchargePerNight(distanceToVenueM: number): number {
  if (distanceToVenueM <= WALKABLE_M) return 0;

  const km = distanceToVenueM / 1000;
  // Return trip, at a post-event rate rather than an off-peak one.
  const perKmCents = 320;
  const flagfall = 450;
  return Math.round((flagfall + km * perKmCents) * 2);
}

export function effectiveNightly(stay: StayOption): number {
  return (
    stay.pricePerNight.amount + transportSurchargePerNight(stay.distanceToVenueM)
  );
}

/** Beyond this, "walking distance" stops being a real option on event day. */
export const WALKABLE_M = 2_200;

export const seededStayProvider: StayProvider = {
  name: "seeded",
  enabled: true,
  synthetic: true,
  async search(query: StayQuery): Promise<ProviderResult<StayOption>> {
    return {
      items: buildStayOptions(query),
      sources: ["Seeded accommodation model"],
      errors: [],
      fetchedAt: new Date().toISOString(),
    };
  },
};
