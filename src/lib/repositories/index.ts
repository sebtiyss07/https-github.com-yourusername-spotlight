import type {
  League,
  Sport,
  SportEvent,
  Team,
  Venue,
} from "@/lib/domain/types";
import { SPORTS, SPORTS_BY_ID } from "@/lib/data/sports";
import {
  LEAGUES,
  LEAGUES_BY_ID,
  featuredLeagues,
  leaguesForSport,
} from "@/lib/data/leagues";
import {
  TEAMS,
  TEAMS_BY_ID,
  VENUES_BY_ID,
  teamsForLeague,
} from "@/lib/data/teams";
import { cache } from "react";
import { eventTitle } from "@/lib/data/events";
import { loadLiveData } from "@/lib/data/live";
import { CLUB_TICKETS } from "@/lib/data/tickets";
import { ACTIVE_SPORTS, isLeagueActive } from "@/lib/data/scope";
import { venuePhotoFor, type VenuePhoto } from "@/lib/data/photos";
import { getCurrency, type Currency } from "@/lib/currency";
import { SITE_FEES, type SiteFees } from "@/lib/data/fees";
import { withLiveOfficialPrices } from "@/lib/providers/officialTickets";
import { withLiveResalePrices } from "@/lib/providers/resaleTickets";
import priceHistory from "@/lib/data/price-history.json";

export type { SiteFees };

export type { VenuePhoto };
import {
  F1_PRICES_CHECKED_ON,
  PRICE_SITE_LABELS,
  PRICES_CHECKED_ON,
  US_PRICES_CHECKED_ON,
  RATES,
  racePricesFor,
  sitePricesFor,
  type PriceSite,
  type SitePrice,
} from "@/lib/data/prices";

/**
 * Repository layer — the seam between the app and its storage.
 *
 * Every function is async even though the seed data is synchronous and in
 * memory. That's deliberate: when this moves to Postgres, the call signatures
 * don't change, so no page or component needs touching. The cost today is one
 * microtask; the saving later is a rewrite.
 *
 * Nothing outside this directory should import from `lib/data`.
 *
 * Every query also applies the site's current scope (`lib/data/scope.ts`), so
 * a switched-off sport can't surface anywhere — not in a list, not in search,
 * not through a direct link.
 */

const SCOPED_SPORTS = SPORTS.filter((s) => ACTIVE_SPORTS.includes(s.id));
const SCOPED_LEAGUES = LEAGUES.filter(isLeagueActive);
const LEAGUE_IDS = new Set(SCOPED_LEAGUES.map((l) => l.id));
const SCOPED_TEAMS = TEAMS.filter((t) => LEAGUE_IDS.has(t.leagueId));

function inScope<T extends { leagueId: string }>(item: T | undefined): T | null {
  return item && LEAGUE_IDS.has(item.leagueId) ? item : null;
}

export async function getSports(): Promise<Sport[]> {
  return SCOPED_SPORTS;
}

export async function getSport(id: string): Promise<Sport | null> {
  const sport = SPORTS_BY_ID.get(id as Sport["id"]);
  return sport && ACTIVE_SPORTS.includes(sport.id) ? sport : null;
}

export async function getLeagues(): Promise<League[]> {
  return SCOPED_LEAGUES;
}

export async function getLeague(id: string): Promise<League | null> {
  return LEAGUE_IDS.has(id) ? (LEAGUES_BY_ID.get(id) ?? null) : null;
}

/** One flagship league per sport — the homepage's primary browse surface. */
export async function getFeaturedLeagues(): Promise<
  { league: League; label: string }[]
> {
  return featuredLeagues().filter(({ league }) => LEAGUE_IDS.has(league.id));
}

export async function getLeaguesBySport(sportId: string): Promise<League[]> {
  // Domestic leagues first, then continental, then international tours —
  // matches how people actually navigate a sport.
  const order: Record<League["tier"], number> = {
    domestic: 0,
    continental: 1,
    international: 2,
    tour: 3,
  };
  return leaguesForSport(sportId).filter(isLeagueActive).sort(
    (a, b) => order[a.tier] - order[b.tier] || a.name.localeCompare(b.name),
  );
}

export async function getTeams(): Promise<Team[]> {
  return SCOPED_TEAMS;
}

export async function getTeam(id: string): Promise<Team | null> {
  return inScope(TEAMS_BY_ID.get(id));
}

export async function getTeamsByLeague(leagueId: string): Promise<Team[]> {
  return LEAGUE_IDS.has(leagueId) ? teamsForLeague(leagueId) : [];
}

/**
 * Fixtures come from real sources (`lib/data/live.ts`). `cache` shares one
 * load per request; Next's fetch cache shares the network calls across them.
 */
const liveData = cache(loadLiveData);

export async function getVenue(id: string): Promise<Venue | null> {
  return VENUES_BY_ID.get(id) ?? (await liveData()).venuesById.get(id) ?? null;
}

export async function getEvent(id: string): Promise<SportEvent | null> {
  return inScope((await liveData()).eventsById.get(id));
}

/**
 * In-scope events that haven't started, soonest first. Every list query goes
 * through here, which is what keeps switched-off sports out of every list and
 * search.
 */
async function upcoming(
  match: (e: SportEvent) => boolean = () => true,
): Promise<SportEvent[]> {
  const { events } = await liveData();
  const now = Date.now();
  return events
    .filter((e) => LEAGUE_IDS.has(e.leagueId) && match(e) && Date.parse(e.startsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

const playsIn = (teamId: string) => (e: SportEvent) =>
  e.homeTeamId === teamId || e.awayTeamId === teamId;

export async function getUpcomingEvents(limit?: number): Promise<SportEvent[]> {
  const events = await upcoming();
  return limit ? events.slice(0, limit) : events;
}

export async function getEventsBySport(
  sportId: string,
  limit?: number,
): Promise<SportEvent[]> {
  const events = await upcoming((e) => e.sportId === sportId);
  return limit ? events.slice(0, limit) : events;
}

/**
 * True counts, deliberately separate from the list queries above.
 *
 * Pages show a capped slice for readability, and reporting `list.length` as
 * the count turns a display limit into a fabricated statistic.
 */
export async function countEventsBySport(sportId: string): Promise<number> {
  return (await upcoming((e) => e.sportId === sportId)).length;
}

export async function countEventsByLeague(leagueId: string): Promise<number> {
  return (await upcoming((e) => e.leagueId === leagueId)).length;
}

export async function countEventsByTeam(teamId: string): Promise<{
  total: number;
  home: number;
  away: number;
}> {
  const events = await upcoming(playsIn(teamId));
  return {
    total: events.length,
    home: events.filter((e) => e.homeTeamId === teamId).length,
    away: events.filter((e) => e.awayTeamId === teamId).length,
  };
}

export async function getEventsByLeague(
  leagueId: string,
  limit?: number,
): Promise<SportEvent[]> {
  const events = await upcoming((e) => e.leagueId === leagueId);
  return limit ? events.slice(0, limit) : events;
}

export async function getEventsByTeam(
  teamId: string,
  limit?: number,
): Promise<SportEvent[]> {
  const events = await upcoming(playsIn(teamId));
  return limit ? events.slice(0, limit) : events;
}

/** The big standalone events — every F1 race, for now. */
export async function getMarqueeEvents(limit?: number): Promise<SportEvent[]> {
  const events = await upcoming((e) => e.isMarquee);
  return limit ? events.slice(0, limit) : events;
}

export async function getMarqueeEventsBySport(
  sportId: string,
): Promise<SportEvent[]> {
  return upcoming((e) => e.isMarquee && e.sportId === sportId);
}

/**
 * Hydrates an event with the records the UI always needs alongside it, so
 * pages don't fan out into four more awaits per row.
 */
export interface EventContext {
  event: SportEvent;
  venue: Venue | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  league: League | null;
  sport: Sport | null;
  title: string;
  /** A match ticket, or for a race the full-weekend pass. */
  prices: PriceComparison;
  /** Races only: single race-day tickets. */
  raceDayPrices: PriceComparison | null;
  /** The home ground's photo, or for a race the circuit map. */
  photo: VenuePhoto | null;
}

/** One ticket site's lowest listed price, linking to that exact ticket page. */
export interface PriceOffer {
  site: PriceSite;
  label: string;
  url: string;
  /** Lowest single-ticket price the site listed; null when it listed none. */
  amount: number | null;
  /** What the ticket covers, when it varies (e.g. "4-day pass (Thu–Sun)"). */
  ticket?: string;
  /** The site's own price when it charges in another currency (e.g. £195.70). */
  original?: { amount: number; currency: string };
  /** What the site adds in fees, and whether `amount` already includes them. */
  fees: SiteFees;
  /** Shown instead of a price for a site we link without reading its price. */
  note?: string;
}

export interface PriceComparison {
  /** Sites with a price, cheapest first, then the ones that listed none. */
  offers: PriceOffer[];
  /** The cheapest priced offer, or null when no site listed a price. */
  cheapest: PriceOffer | null;
  currency: Currency;
  /** When these prices were read (YYYY-MM-DD), or null with no offers. */
  checkedOn: string | null;
  /** The earliest of those dates, when sites were checked on different days. */
  checkedFrom: string | null;
  /** The date of the European Central Bank rates used to convert prices. */
  ratesOn: string;
}

/** The cheapest price for a game when it is known to include fees, else null. */
export function allInPrice(c: { prices: PriceComparison }): number | null {
  const o = c.prices.cheapest;
  return o && o.fees.included === "yes" ? o.amount : null;
}

/** A USD amount in the visitor's currency, at the stored ECB rate. */
export function convertUsd(amount: number, currency: Currency): number {
  return Math.round(amount * RATES[currency] * 100) / 100;
}

/**
 * Sites whose event pages open already filtered to one ticket when the link
 * carries `quantity=1` (checked on each site: the page shows "1 Ticket"), so
 * visitors land on the same one-ticket price we show.
 */
const ONE_TICKET_PARAM: Partial<Record<PriceSite, string>> = {
  tickpick: "quantity",
  gametime: "quantity",
  vividseats: "quantity",
  stubhub: "quantity",
  seatgeek: "quantity",
};

function oneTicketUrl(site: PriceSite, url: string): string {
  const param = ONE_TICKET_PARAM[site];
  if (!param) return url;
  try {
    const u = new URL(url);
    u.searchParams.set(param, "1");
    return u.toString();
  } catch {
    return url;
  }
}

function comparePrices(
  rows: SitePrice[],
  checkedOn: (site: PriceSite) => string,
  currency: Currency,
): PriceComparison {
  const offers: PriceOffer[] = rows.map((p) => ({
    site: p.site,
    label: PRICE_SITE_LABELS[p.site],
    url: oneTicketUrl(p.site, p.url),
    // A site's own figure when it already charges in this currency;
    // otherwise converted.
    amount:
      p.price === null
        ? null
        : p.original?.currency === currency
          ? p.original.amount
          : convertUsd(p.price, currency),
    ticket: p.label,
    original: p.original && p.original.currency !== currency ? p.original : undefined,
    fees: SITE_FEES[p.site],
    note: p.note,
  }));
  // Prices that already include the site's fees first, then the sites that
  // add (or may add) fees at checkout: their lower-looking number may not be
  // what you pay, so it can't be "the cheapest" over an all-in price.
  const rank = (o: PriceOffer) => (o.amount === null ? 2 : o.fees.included === "yes" ? 0 : 1);
  offers.sort((a, b) => rank(a) - rank(b) || (a.amount ?? Infinity) - (b.amount ?? Infinity));
  // Only sites that showed a price count towards "checked on".
  const dates = rows.filter((r) => r.price !== null).map((r) => r.checked ?? checkedOn(r.site)).sort();
  return {
    offers,
    cheapest: offers[0]?.amount != null ? offers[0] : null,
    currency,
    checkedOn: dates.at(-1) ?? null,
    checkedFrom: dates[0] && dates[0] !== dates.at(-1) ? dates[0] : null,
    ratesOn: RATES.date,
  };
}

const US_LEAGUE_IDS = new Set(["nfl", "nba", "mls"]);

async function eventPrices(
  event: SportEvent,
  currency: Currency,
  live: boolean,
): Promise<Pick<EventContext, "prices" | "raceDayPrices">> {
  if (event.sportId === "motorsport") {
    const race = racePricesFor(event.venueId.replace(/^f1-/, ""));
    const f1Date = () => F1_PRICES_CHECKED_ON;
    return {
      prices: comparePrices(race?.weekend ?? [], f1Date, currency),
      raceDayPrices: race ? comparePrices(race.raceDay, f1Date, currency) : null,
    };
  }
  const isUs = US_LEAGUE_IDS.has(event.leagueId);
  // Every league's game page reads the live feeds; lists use saved prices.
  const useLive = live;
  // Saved prices only change on a new deploy, so each game's comparison is
  // worked out once per currency and reused (lists show hundreds of games).
  const memoKey = `${event.id}|${currency}`;
  if (!useLive) {
    const hit = SAVED_PRICES_MEMO.get(memoKey);
    if (hit) return hit;
  }
  const checked = isUs ? US_PRICES_CHECKED_ON : PRICES_CHECKED_ON;
  let rows = sitePricesFor(event.id);
  const liveSites = new Set<PriceSite>();
  if (useLive) {
    const home = event.homeTeamId ? (TEAMS_BY_ID.get(event.homeTeamId) ?? null) : null;
    const before = rows;
    const [official, resale] = await Promise.all([
      isUs ? withLiveOfficialPrices(event, home, rows) : rows,
      withLiveResalePrices(rows),
    ]);
    // SeatGeek and Ticketmaster from the first; TicketNetwork, Ticket Liquidator and Gametime from the second.
    rows = official.map((r) => resale.find((x) => x.site === r.site && !before.includes(x)) ?? r);
    for (const r of rows) if (!before.includes(r) && r.price !== null) liveSites.add(r.site);
  }
  // Today in US Eastern time, so an evening check isn't dated tomorrow.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const result = {
    prices: comparePrices(rows, (site) => (liveSites.has(site) ? today : checked[site]), currency),
    raceDayPrices: null,
  };
  if (!useLive) SAVED_PRICES_MEMO.set(memoKey, result);
  return result;
}

const SAVED_PRICES_MEMO = new Map<string, Pick<EventContext, "prices" | "raceDayPrices">>();

/**
 * `live` fetches today's prices from TicketNetwork and Ticket Liquidator, and
 * SeatGeek's and Ticketmaster's through their official APIs (when keys are
 * set). Only a single game's page asks for it;
 * lists of games use the saved prices.
 */
export async function getEventContext(
  event: SportEvent,
  { live = false }: { live?: boolean } = {},
): Promise<EventContext> {
  return {
    event,
    venue: await getVenue(event.venueId),
    homeTeam: event.homeTeamId ? (TEAMS_BY_ID.get(event.homeTeamId) ?? null) : null,
    awayTeam: event.awayTeamId ? (TEAMS_BY_ID.get(event.awayTeamId) ?? null) : null,
    league: LEAGUES_BY_ID.get(event.leagueId) ?? null,
    sport: SPORTS_BY_ID.get(event.sportId) ?? null,
    title: eventTitle(event),
    ...(await eventPrices(event, await getCurrency(), live)),
    photo: venuePhotoFor(
      event.sportId === "motorsport"
        ? `f1:${event.venueId.replace(/^f1-/, "")}`
        : (event.homeTeamId ?? ""),
    ),
  };
}

export async function getEventContexts(
  events: SportEvent[],
): Promise<EventContext[]> {
  return Promise.all(events.map((e) => getEventContext(e)));
}

/** Free-text search across sports, leagues, teams, and events. */
export interface SearchHit {
  kind: "sport" | "league" | "team" | "event";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchResults {
  hits: SearchHit[];
  /** Total matches found, which may exceed `hits.length`. */
  total: number;
  /** True when results were capped for display. */
  truncated: boolean;
}

const SEARCH_LIMIT = 120;

export async function search(query: string): Promise<SearchResults> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return { hits: [], total: 0, truncated: false };

  const hits: SearchHit[] = [];

  for (const s of SCOPED_SPORTS) {
    if (s.name.toLowerCase().includes(q)) {
      hits.push({
        kind: "sport",
        id: s.id,
        title: s.name,
        subtitle: "Sport",
        href: `/sports/${s.id}`,
      });
    }
  }

  for (const l of SCOPED_LEAGUES) {
    if (
      l.name.toLowerCase().includes(q) ||
      l.shortName.toLowerCase().includes(q)
    ) {
      hits.push({
        kind: "league",
        id: l.id,
        title: l.name,
        subtitle: `${l.region} · League`,
        href: `/leagues/${l.id}`,
      });
    }
  }

  for (const t of SCOPED_TEAMS) {
    if (
      t.name.toLowerCase().includes(q) ||
      t.shortName.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q)
    ) {
      hits.push({
        kind: "team",
        id: t.id,
        title: t.name,
        subtitle: `${t.city} · Team`,
        href: `/teams/${t.id}`,
      });
    }
  }

  for (const e of await upcoming()) {
    const title = eventTitle(e);
    if (title.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)) {
      hits.push({
        kind: "event",
        id: e.id,
        title,
        subtitle: e.isMarquee ? "Championship event" : "Fixture",
        href: `/events/${e.id}`,
      });
    }
  }

  // Sports and leagues first — they're navigational, events are the long tail.
  const rank: Record<SearchHit["kind"], number> = {
    sport: 0,
    league: 1,
    team: 2,
    event: 3,
  };
  const ordered = hits.sort((a, b) => rank[a.kind] - rank[b.kind]);

  return {
    hits: ordered.slice(0, SEARCH_LIMIT),
    total: ordered.length,
    truncated: ordered.length > SEARCH_LIMIT,
  };
}

/** Somewhere you can actually buy a ticket for this event, verified by hand. */
export interface TicketSeller {
  label: string;
  note: string;
  url: string;
}

/**
 * Official sellers only (see `lib/data/tickets.ts`) — never a search page.
 * For a football match that's the home club's ticket office, plus the away
 * club's for away fans. (The F1 store is part of the race price comparison.)
 */
export async function getTicketSellers(event: SportEvent): Promise<TicketSeller[]> {
  const sellers: TicketSeller[] = [];

  if (event.sportId === "soccer") {
    for (const [teamId, note] of [
      [event.homeTeamId, "Home and neutral fans — the home club sells most seats."],
      [event.awayTeamId, "Away fans — your club sells its own away allocation."],
    ] as const) {
      const team = teamId ? TEAMS_BY_ID.get(teamId) : undefined;
      const url = team ? CLUB_TICKETS[team.id] : undefined;
      if (team && url) sellers.push({ label: `${team.name} ticket office`, note, url });
    }
  }

  return sellers;
}

/** A photo to headline a league's pages. */
export async function getLeaguePhoto(leagueId: string): Promise<VenuePhoto | null> {
  return leagueId === "premier-league" ? venuePhotoFor("tottenham") : null;
}

/**
 * The cheapest price Spotlight showed for a game on each daily check, in the
 * visitor's currency (scripts/refresh/history.mjs records it).
 */
export async function getPriceHistory(eventId: string, currency: Currency): Promise<{ date: string; price: number }[]> {
  const points = (priceHistory.events as unknown as Record<string, [string, number][]>)[eventId] ?? [];
  return points.map(([date, usd]) => ({ date, price: convertUsd(usd, currency) }));
}
