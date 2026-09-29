import type { Money, TicketListing, TicketMarketplace } from "@/lib/domain/types";
import { EVENTS_BY_ID } from "@/lib/data/events";
import { VENUES_BY_ID } from "@/lib/data/teams";
import { intBetween, rngFrom } from "@/lib/data/random";
import type { ProviderResult, TicketProvider, TicketQuery } from "@/lib/providers/types";

/**
 * Seeded ticket marketplace.
 *
 * This models the thing the product actually exists to expose: the same seat
 * costs different amounts on different sites, and the advertised price is not
 * the price. Fee rates below are in the published range each marketplace
 * charges — the spread between the cheapest headline price and the cheapest
 * *total* is the entire reason someone would use this site.
 */

interface MarketplaceProfile {
  id: TicketMarketplace;
  label: string;
  /** Fees as a fraction of face value. */
  feeRate: number;
  /** Multiplier applied to face value — resale sites mark up, box office doesn't. */
  priceBias: number;
  isResale: boolean;
  /** How many listings this marketplace typically surfaces. */
  inventoryWeight: number;
}

const MARKETPLACES: MarketplaceProfile[] = [
  { id: "box-office", label: "Box Office", feeRate: 0.12, priceBias: 1.0, isResale: false, inventoryWeight: 2 },
  { id: "ticketmaster", label: "Ticketmaster", feeRate: 0.27, priceBias: 1.04, isResale: false, inventoryWeight: 4 },
  { id: "seatgeek", label: "SeatGeek", feeRate: 0.25, priceBias: 1.09, isResale: true, inventoryWeight: 4 },
  { id: "stubhub", label: "StubHub", feeRate: 0.31, priceBias: 1.02, isResale: true, inventoryWeight: 5 },
  { id: "vividseats", label: "Vivid Seats", feeRate: 0.28, priceBias: 1.06, isResale: true, inventoryWeight: 4 },
  { id: "gametime", label: "Gametime", feeRate: 0.22, priceBias: 1.11, isResale: true, inventoryWeight: 3 },
  { id: "viagogo", label: "viagogo", feeRate: 0.35, priceBias: 1.15, isResale: true, inventoryWeight: 3 },
];

/** How many marketplaces the seeded comparison actually covers. */
export const MARKETPLACE_COUNT = MARKETPLACES.length;

export const MARKETPLACE_LABELS: Record<TicketMarketplace, string> =
  Object.fromEntries(MARKETPLACES.map((m) => [m.id, m.label])) as Record<
    TicketMarketplace,
    string
  >;

/** Typical lowest face value per league, in USD cents. */
const LEAGUE_BASE: Record<string, number> = {
  nba: 5_500,
  nfl: 12_000,
  "premier-league": 6_000,
  "champions-league": 14_000,
  "fifa-world-cup": 30_000,
  "la-liga": 8_000,
  "serie-a": 5_000,
  bundesliga: 3_500,
  "formula-1": 32_000,
  wec: 9_000,
  "grand-slams": 11_000,
  majors: 15_000,
  ufc: 20_000,
  boxing: 25_000,
  nhl: 7_000,
  mlb: 3_000,
  ipl: 2_500,
  "the-ashes": 6_000,
  euroleague: 4_500,
  "copa-libertadores": 5_000,
};

const DEFAULT_BASE = 6_000;

/**
 * Seating tiers. Quality drives both price and the value ranking — a cheap
 * ticket behind a pillar isn't the answer to "where's the best deal".
 */
interface Tier {
  name: string;
  /** Multiplier on the event's base price. */
  multiplier: number;
  quality: number;
}

const ARENA_TIERS: Tier[] = [
  { name: "Upper Concourse", multiplier: 1.0, quality: 35 },
  { name: "Upper Corner", multiplier: 1.25, quality: 45 },
  { name: "Mezzanine", multiplier: 1.8, quality: 60 },
  { name: "Lower Bowl Corner", multiplier: 2.6, quality: 72 },
  { name: "Lower Bowl Sideline", multiplier: 4.1, quality: 85 },
  { name: "Courtside / Field Level", multiplier: 9.5, quality: 98 },
];

const STADIUM_TIERS: Tier[] = [
  { name: "Upper Tier Behind Goal", multiplier: 1.0, quality: 38 },
  { name: "Upper Tier Side", multiplier: 1.35, quality: 52 },
  { name: "Family Stand", multiplier: 1.5, quality: 55 },
  { name: "Lower Tier Corner", multiplier: 2.2, quality: 68 },
  { name: "Halfway Line", multiplier: 3.8, quality: 88 },
  { name: "Hospitality", multiplier: 8.0, quality: 96 },
];

const CIRCUIT_TIERS: Tier[] = [
  { name: "General Admission", multiplier: 1.0, quality: 40 },
  { name: "Hairpin Grandstand", multiplier: 1.9, quality: 62 },
  { name: "Main Straight", multiplier: 3.2, quality: 84 },
  { name: "Start/Finish Tower", multiplier: 4.6, quality: 92 },
  { name: "Paddock Club", multiplier: 12.0, quality: 99 },
];

const COURSE_TIERS: Tier[] = [
  { name: "Grounds Pass", multiplier: 1.0, quality: 50 },
  { name: "Reserved Grandstand", multiplier: 2.1, quality: 72 },
  { name: "18th Green Stand", multiplier: 3.4, quality: 90 },
  { name: "Hospitality Pavilion", multiplier: 7.5, quality: 97 },
];

function tiersFor(sportId: string, kind: string): Tier[] {
  if (sportId === "motorsport") return CIRCUIT_TIERS;
  if (sportId === "golf") return COURSE_TIERS;
  if (sportId === "soccer" || sportId === "american-football" || sportId === "cricket") {
    return kind === "race" ? CIRCUIT_TIERS : STADIUM_TIERS;
  }
  return ARENA_TIERS;
}

function money(amount: number, currency = "USD"): Money {
  return { amount: Math.round(amount), currency };
}

/**
 * Demand → price curve. Deliberately convex: a 90-demand event isn't twice a
 * 45-demand event, it's roughly five times, which is how marquee pricing
 * actually behaves.
 */
function demandMultiplier(demandScore: number): number {
  return 0.55 + Math.pow(demandScore / 55, 2.15);
}

/** Scarcity premium as the date approaches, and the late-window dump after it. */
function timingMultiplier(daysOut: number): number {
  if (daysOut <= 2) return 0.88; // brokers offloading
  if (daysOut <= 7) return 1.22;
  if (daysOut <= 30) return 1.08;
  if (daysOut <= 120) return 0.97;
  return 0.9;
}

export function buildListings(eventId: string): TicketListing[] {
  const event = EVENTS_BY_ID.get(eventId);
  if (!event) return [];

  const venue = VENUES_BY_ID.get(event.venueId);
  const tiers = tiersFor(event.sportId, event.kind);
  const base = LEAGUE_BASE[event.leagueId] ?? DEFAULT_BASE;
  const daysOut = Math.max(
    0,
    (Date.parse(event.startsAt) - Date.now()) / 86_400_000,
  );

  // Small venues price up: less supply for the same demand.
  const scarcity = venue ? Math.min(1.6, 45_000 / Math.max(8_000, venue.capacity ?? 45_000)) : 1;

  const eventMultiplier =
    demandMultiplier(event.demandScore) * timingMultiplier(daysOut) * scarcity;

  const listings: TicketListing[] = [];

  for (const marketplace of MARKETPLACES) {
    for (const tier of tiers) {
      const count = Math.max(
        1,
        Math.round(marketplace.inventoryWeight / (tier.quality > 90 ? 3 : 1.5)),
      );

      for (let i = 0; i < count; i++) {
        const seed = `${eventId}:${marketplace.id}:${tier.name}:${i}`;
        const rng = rngFrom(seed);

        // Per-listing spread. This is what makes one site cheapest for one
        // event and a different site cheapest for the next.
        const jitter = 0.82 + rng() * 0.46;

        const face =
          base * tier.multiplier * eventMultiplier * marketplace.priceBias * jitter;
        const fees = face * marketplace.feeRate;

        listings.push({
          id: seed,
          eventId,
          marketplace: marketplace.id,
          section: tier.name,
          row: marketplace.id === "box-office" ? undefined : `${intBetween(rng, 1, 34)}`,
          quantityAvailable: intBetween(rng, 1, 8),
          price: money(face),
          fees: money(fees),
          total: money(face + fees),
          // The whole seeded provider is modelled and labelled as such, but
          // keep the flag accurate so the UI never has to special-case it.
          feesEstimated: true,
          seatQuality: Math.max(
            10,
            Math.min(99, tier.quality + intBetween(rng, -6, 6)),
          ),
          isResale: marketplace.isResale,
          // Deep links point at each marketplace's event search. Replacing
          // these with true affiliate deep links is the revenue step.
          deepLink: buildSearchLink(marketplace.id, event.name),
        });
      }
    }
  }

  return listings.sort((a, b) => a.total.amount - b.total.amount);
}

function buildSearchLink(marketplace: TicketMarketplace, eventName: string): string {
  const q = encodeURIComponent(eventName);
  switch (marketplace) {
    case "ticketmaster":
      return `https://www.ticketmaster.com/search?q=${q}`;
    case "seatgeek":
      return `https://seatgeek.com/search?search=${q}`;
    case "stubhub":
      return `https://www.stubhub.com/find/s/?q=${q}`;
    case "vividseats":
      return `https://www.vividseats.com/search?searchTerm=${q}`;
    case "gametime":
      return `https://gametime.co/search?q=${q}`;
    case "viagogo":
      return `https://www.viagogo.com/search?q=${q}`;
    case "box-office":
      return `https://www.google.com/search?q=${q}+official+tickets`;
  }
}

export const seededTicketProvider: TicketProvider = {
  name: "seeded",
  enabled: true,
  synthetic: true,
  async search(query: TicketQuery): Promise<ProviderResult<TicketListing>> {
    let items = buildListings(query.eventId).filter(
      (l) => l.quantityAvailable >= query.quantity,
    );

    if (query.maxTotal !== undefined) {
      items = items.filter((l) => l.total.amount <= query.maxTotal!);
    }

    return {
      items,
      sources: MARKETPLACES.map((m) => m.label),
      errors: [],
      fetchedAt: new Date().toISOString(),
    };
  },
};
