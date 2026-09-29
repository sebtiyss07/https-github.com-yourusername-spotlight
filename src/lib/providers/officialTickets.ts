import type { SportEvent, Team } from "@/lib/domain/types";
import type { SitePrice } from "@/lib/data/prices";

/**
 * Live prices from the two sellers that offer an official, free developer API:
 *
 * - SeatGeek Platform API (sign up at https://seatgeek.com/build): each game's
 *   lowest listed price, fees included. Needs SEATGEEK_CLIENT_ID.
 * - Ticketmaster Discovery API (sign up at https://developer.ticketmaster.com):
 *   the price range Ticketmaster publishes for the game. Needs
 *   TICKETMASTER_API_KEY.
 *
 * Each switches on only when its key is set (in .env.local, and in Vercel's
 * environment settings for the live site). Answers are cached for 15 minutes,
 * so the page follows price changes without calling the APIs on every visit.
 * Any failure returns nothing and the page keeps its saved prices.
 */

const REVALIDATE = 900; // seconds

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\./g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const hoursApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 3_600_000;

interface SgEvent {
  id: number;
  url: string;
  datetime_utc: string;
  stats?: { lowest_price?: number | null; listing_count?: number | null };
}

async function seatGeek(event: SportEvent, home: Team | null, known?: SitePrice): Promise<SitePrice | null> {
  const key = process.env.SEATGEEK_CLIENT_ID;
  if (!key) return null;
  const base = "https://api.seatgeek.com/2/events";
  const knownId = known?.url.match(/events\/(\d+)/)?.[1];
  let ev: SgEvent | null = null;
  if (knownId) ev = await getJson<SgEvent>(`${base}/${knownId}?client_id=${key}`);
  if (!ev && home) {
    // Not matched yet: the home team's game within a few hours of kick-off.
    const q = new URLSearchParams({ client_id: key, "performers[home_team].slug": slug(home.name), per_page: "10" });
    const found = await getJson<{ events: SgEvent[] }>(`${base}?${q}`);
    ev = found?.events.find((e) => hoursApart(`${e.datetime_utc}Z`, event.startsAt) <= 6) ?? null;
  }
  if (!ev) return null;
  const price = ev.stats?.lowest_price ?? null;
  return {
    site: "seatgeek",
    url: ev.url,
    price: price && price > 0 ? price : null,
    label: "Lowest listing, live from SeatGeek",
    note: price ? undefined : "No tickets listed on SeatGeek right now",
  };
}

interface TmEvent {
  id: string;
  name: string;
  url: string;
  dates?: { start?: { dateTime?: string } };
  priceRanges?: { type?: string; currency?: string; min?: number }[];
}

async function ticketmaster(event: SportEvent, home: Team | null, known?: SitePrice): Promise<SitePrice | null> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return null;
  const base = "https://app.ticketmaster.com/discovery/v2";
  const knownId = known?.url.match(/event\/([\w]+)/)?.[1];
  let ev: TmEvent | null = null;
  if (knownId) ev = await getJson<TmEvent>(`${base}/events/${knownId}.json?apikey=${key}`);
  if (!ev && home) {
    const start = new Date(Date.parse(event.startsAt) - 6 * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");
    const end = new Date(Date.parse(event.startsAt) + 6 * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");
    const q = new URLSearchParams({ apikey: key, keyword: home.name, startDateTime: start, endDateTime: end, size: "10" });
    const found = await getJson<{ _embedded?: { events: TmEvent[] } }>(`${base}/events.json?${q}`);
    // Skip parking and package listings Ticketmaster files as separate events.
    ev = found?._embedded?.events.find((e) => !/parking|package|tailgate|suite/i.test(e.name)) ?? null;
  }
  if (!ev) return null;
  const range = ev.priceRanges?.find((r) => r.currency === "USD" && (r.type ?? "standard") === "standard") ?? ev.priceRanges?.find((r) => r.currency === "USD");
  const price = range?.min && range.min > 0 ? range.min : null;
  return {
    site: "ticketmaster",
    url: ev.url,
    price,
    label: price ? "Lowest price in Ticketmaster's published range, live" : undefined,
    note: price ? undefined : "Official seller: see the price on Ticketmaster",
  };
}

/** Whether either live source is switched on. */
export const LIVE_TICKET_SOURCES = Boolean(process.env.SEATGEEK_CLIENT_ID || process.env.TICKETMASTER_API_KEY);

/**
 * The saved rows with SeatGeek's and Ticketmaster's replaced by live ones
 * where the APIs answer; rows are added for games we hadn't matched before.
 */
export async function withLiveOfficialPrices(event: SportEvent, home: Team | null, rows: SitePrice[]): Promise<SitePrice[]> {
  if (!LIVE_TICKET_SOURCES) return rows;
  const find = (site: SitePrice["site"]) => rows.find((r) => r.site === site);
  const [sg, tm] = await Promise.all([seatGeek(event, home, find("seatgeek")), ticketmaster(event, home, find("ticketmaster"))]);
  const live = [sg, tm].filter((r): r is SitePrice => r !== null);
  return [...rows.filter((r) => !live.some((l) => l.site === r.site)), ...live];
}
