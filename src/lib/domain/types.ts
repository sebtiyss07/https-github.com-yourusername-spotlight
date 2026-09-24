/**
 * Core domain model.
 *
 * These types mirror the eventual database schema one-to-one. Every `id` is a
 * stable slug (not an auto-increment) so that URLs, seed data, and third-party
 * provider mappings all key off the same value and survive a migration to
 * Postgres without a rewrite.
 */

export type SportId =
  | "basketball"
  | "soccer"
  | "american-football"
  | "baseball"
  | "ice-hockey"
  | "tennis"
  | "motorsport"
  | "cricket"
  | "golf"
  | "combat-sports";

/** ISO 3166-1 alpha-2, or a continent code for multi-country competitions. */
export type CountryCode = string;

export interface Sport {
  id: SportId;
  name: string;
  /** One-line pitch shown on the sport card. */
  tagline: string;
  /** Hex accent used for gradients and highlights across the sport's pages. */
  accent: string;
  /** Rough global following, used only for ordering the landing page. */
  globalFans: number;
}

/**
 * Note there is no `logoUrl` on `Sport` or `League`, and that is deliberate.
 *
 * League and governing-body marks — the NBA silhouette, the Premier League
 * lion, the FIFA and NFL shields — are registered trademarks, and are typically
 * enforced harder than club crests because they're the organisation's primary
 * mark. Sports and leagues are rendered as text and custom-drawn generic
 * iconography only. `/dev-audit` asserts this stays true.
 */

export type LeagueTier = "domestic" | "continental" | "international" | "tour";

export interface League {
  id: string;
  sportId: SportId;
  name: string;
  shortName: string;
  tier: LeagueTier;
  country: CountryCode;
  /** Human-readable region, e.g. "Europe" or "North America". */
  region: string;
  founded: number;
  teamCount: number;
  /** Months the competition is active, for the "in season / off season" badge. */
  seasonMonths: [start: number, end: number];
  description: string;
  /** True when we have a full team roster + schedule seeded for this league. */
  hasDepth: boolean;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: CountryCode;
  /** Used for distance maths and flight-route lookups. */
  lat: number;
  lon: number;
  capacity: number;
  /** IATA code of the nearest major airport — the travel provider's entry point. */
  nearestAirport: string;
  opened: number;
}

export interface Team {
  id: string;
  leagueId: string;
  sportId: SportId;
  name: string;
  /** Short display name, e.g. "Lakers" or "Arsenal". */
  shortName: string;
  /**
   * Two-or-three letter crest code, guaranteed unique within the league.
   *
   * Uniqueness can't be computed by the component that draws the crest: it only
   * sees one team. Taking first-and-last initials collides three ways in the NFL
   * alone (Bears, Bengals and Browns all give "CB"), which would render three
   * clubs with identical badges in one fixture list. So it's assigned here,
   * against the full roster.
   */
  abbreviation: string;
  city: string;
  country: CountryCode;
  venueId: string;
  founded: number;
  primaryColor: string;
  secondaryColor: string;
  /** Championships won in the team's top-level competition. */
  titles: number;
  /**
   * Licensed crest image, if you have one.
   *
   * Deliberately optional and deliberately empty in the seed data. Club crests
   * are registered trademarks — shipping them without a licence is a real
   * exposure for a commercial product, not a technicality. `TeamMark` renders a
   * designed crest from the club's colours when this is absent, so licensed
   * assets (SportsDataIO, API-Sports, or a direct club agreement) drop in by
   * populating this field alone.
   */
  logoUrl?: string;
}

export type EventKind =
  /** A regular-season fixture between two teams. */
  | "fixture"
  /** A knockout or playoff match. */
  | "playoff"
  /** A single marquee final: Super Bowl, Champions League final. */
  | "final"
  /** A multi-day tournament treated as one attendable event: Wimbledon, The Masters. */
  | "tournament"
  /** A motorsport race weekend. */
  | "race";

export interface SportEvent {
  id: string;
  sportId: SportId;
  leagueId: string;
  kind: EventKind;
  /** Display title. For fixtures this is derived, e.g. "Lakers @ Celtics". */
  name: string;
  /** ISO 8601 with timezone offset. Always store the venue's local offset. */
  startsAt: string;
  /** Multi-day events only (tournaments, race weekends). */
  endsAt?: string;
  venueId: string;
  homeTeamId?: string;
  awayTeamId?: string;
  /** 0-100. Drives sort order, price modelling, and the "hot" badge. */
  demandScore: number;
  /** Marks World Cups, Super Bowls, Grand Slams — the events people plan trips around. */
  isMarquee: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Provider-facing value objects
// ---------------------------------------------------------------------------

export interface Money {
  /** Minor units (cents). Integer maths only — never float money. */
  amount: number;
  currency: string;
}

export type TicketMarketplace =
  | "ticketmaster"
  | "seatgeek"
  | "stubhub"
  | "vividseats"
  | "gametime"
  | "viagogo"
  | "box-office";

export interface TicketListing {
  id: string;
  eventId: string;
  marketplace: TicketMarketplace;
  section: string;
  row?: string;
  quantityAvailable: number;
  /** Face price per ticket, excluding fees. */
  price: Money;
  /** Fees and delivery, per ticket. The number people actually get surprised by. */
  fees: Money;
  /** price + fees. Precomputed so sorting never depends on the caller. */
  total: Money;
  /**
   * True when `fees` is a modelled estimate rather than a figure the
   * marketplace actually quoted. Most APIs return pre-fee prices, so this is
   * the common case for live data — and it must be visible, because an
   * estimated total shown as an exact one is the core dishonesty this product
   * exists to avoid.
   */
  feesEstimated: boolean;
  /**
   * Rough seat quality, 0-100, for the "best value" ranking.
   *
   * Null when the provider doesn't report anything we can derive it from.
   * Inventing a number here would put a fabricated "view quality 40/100" next
   * to a real price.
   */
  seatQuality: number | null;
  isResale: boolean;
  deepLink: string;
}

export type TravelMode = "flight" | "train" | "bus" | "drive";

export interface TravelOption {
  id: string;
  mode: TravelMode;
  /** IATA, station code, or "DRIVE". */
  fromCode: string;
  toCode: string;
  carrier: string;
  departsAt: string;
  arrivesAt: string;
  durationMinutes: number;
  stops: number;
  price: Money;
  deepLink: string;
}

export type StayKind = "hotel" | "hostel" | "apartment" | "rental";

export interface StayOption {
  id: string;
  kind: StayKind;
  name: string;
  /** Walking distance to the venue in metres. The number that actually matters. */
  distanceToVenueM: number;
  rating: number;
  reviewCount: number;
  pricePerNight: Money;
  deepLink: string;
  amenities: string[];
}

/**
 * The full cost of showing up: the thing no existing site puts on one screen.
 */
export interface TripEstimate {
  eventId: string;
  ticket: TicketListing | null;
  travel: TravelOption | null;
  stay: StayOption | null;
  nights: number;
  /**
   * Null when a truthful total can't be produced — most often because the
   * ticket, flight, and room came back in different currencies. Showing a
   * coerced number would be worse than showing none.
   */
  total: Money | null;
  /** Currencies involved, so the UI can explain a missing total. */
  totalCurrencies: string[];
  /** Local transport to the venue, included in `total` when it's computable. */
  localTransport: Money | null;
}
