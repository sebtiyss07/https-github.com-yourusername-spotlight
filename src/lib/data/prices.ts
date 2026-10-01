import snapshot from "./ticket-prices.json";
import f1Snapshot from "./f1-prices.json";
import usSnapshot from "./us-ticket-prices.json";

/**
 * Ticket prices, one row per ticket site. Each price is the lowest single
 * ticket that site listed on its public page for that match or race when we
 * checked (in USD, as the site showed it). Nothing here is estimated: a site
 * that listed no tickets has `price: null`.
 *
 * Premier League sellers: Vivid Seats, FootballTicketNet, LiveFootballTickets,
 * TickPick, Gametime, Ticombo, Ticket4Football and Football Ticket Pad (the last
 * two price in GBP; `original` keeps their own figure). Ticketmaster, StubHub and SeatGeek don't list
 * Premier League league matches.
 *
 * Formula 1 sellers: the official F1 store, StubHub, Vivid Seats, SeatGeek,
 * TickPick, Gametime and Ticombo, compared as full-weekend passes and race-day
 * tickets. (Motorsport Tickets was checked and left out: it has stopped trading
 * and is in liquidation.)
 *
 * NFL, NBA and MLS sellers: TickPick, Gametime, Vivid Seats, StubHub,
 * TicketSmarter, TicketNetwork and Ticket Liquidator (prices read), plus
 * SeatGeek and Ticketmaster (exact links; they don't share prices).
 */
export type PriceSite =
  | "vividseats"
  | "footballticketnet"
  | "livefootballtickets"
  | "tickpick"
  | "gametime"
  | "stubhub"
  | "seatgeek"
  | "ticombo"
  | "ticket4football"
  | "footballticketpad"
  | "f1store"
  | "ticketmaster"
  | "ticketsmarter"
  | "ticketnetwork"
  | "ticketliquidator";

export const PRICE_SITE_LABELS: Record<PriceSite, string> = {
  vividseats: "Vivid Seats",
  footballticketnet: "FootballTicketNet",
  livefootballtickets: "LiveFootballTickets",
  tickpick: "TickPick",
  gametime: "Gametime",
  stubhub: "StubHub",
  seatgeek: "SeatGeek",
  ticombo: "Ticombo",
  ticket4football: "Ticket4Football",
  footballticketpad: "Football Ticket Pad",
  f1store: "Official F1 store",
  ticketmaster: "Ticketmaster",
  ticketsmarter: "TicketSmarter",
  ticketnetwork: "TicketNetwork",
  ticketliquidator: "Ticket Liquidator",
};

export interface SitePrice {
  site: PriceSite;
  /** The site's own page for this exact match or race ticket. */
  url: string;
  /** Lowest single-ticket price listed, in USD; null when none were listed. */
  price: number | null;
  /** What the ticket covers, when it varies by site (e.g. "3-day pass"). */
  label?: string;
  /** The price as the site charges it, when that isn't USD (e.g. £195.70). */
  original?: { amount: number; currency: string };
  /** Shown instead of a price when we link a site without reading its price. */
  note?: string;
}

const EVENTS = {
  ...(snapshot.events as Record<string, SitePrice[]>),
  ...(usSnapshot.events as Record<string, SitePrice[]>),
};
const RACES = f1Snapshot.races as Record<
  string,
  { weekend: SitePrice[]; raceDay: SitePrice[] }
>;

export const PRICE_CURRENCY = snapshot.currency;

/** The date (YYYY-MM-DD) each site's football prices were read. */
export const PRICES_CHECKED_ON = snapshot.checkedOn as Record<string, string>;
export const F1_PRICES_CHECKED_ON = f1Snapshot.checkedOn;
/** The same for NFL, NBA and MLS games. */
export const US_PRICES_CHECKED_ON = usSnapshot.checkedOn as Record<string, string>;

export function sitePricesFor(eventId: string): SitePrice[] {
  return EVENTS[eventId] ?? [];
}

/** Weekend-pass and race-day prices for the race at this circuit. */
export function racePricesFor(
  circuitId: string,
): { weekend: SitePrice[]; raceDay: SitePrice[] } | null {
  return RACES[circuitId] ?? null;
}

/**
 * Exchange rates per 1 USD, from the European Central Bank's reference rates
 * on the date given. Used to show every price in the visitor's currency.
 */
export const RATES = (snapshot as unknown as {
  rates: { date: string; source: string; USD: number; EUR: number; GBP: number };
}).rates;
