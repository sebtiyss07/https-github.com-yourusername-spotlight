import type { SitePrice } from "@/lib/data/prices";

/**
 * Live prices from TicketNetwork and Ticket Liquidator (the public Seatics
 * feed their game pages load: same event, different site config, so each
 * site's own fees) and Gametime (its public listings feed).
 *
 * The price is the cheapest seat sold as a single ticket, fees included,
 * rounded up to the whole dollar the site shows (checked on both sites' pages,
 * 1 Oct 2026). Parking, packages, add-ons, wheelchair-only seats and listings
 * not placed on the venue's seat map are left out. Answers are cached for
 * 15 minutes; any failure keeps the saved price.
 *
 * TicketSmarter isn't read live: it refused automated requests (HTTP 403) on
 * 1 Oct 2026, so it shows the price we checked that day.
 */

const REVALIDATE = 900; // seconds
const UA = "Mozilla/5.0 (compatible; SpotlightPriceCheck/1.0; +https://www.spotlightkt.com/about)";

const NON = /tailgate|parking|\blot\b|garage|not a game ticket|not a ticket|does not include admission|add[\s-]?on|photo|camp|meet|experience|hospitality|package|pass only|no game ticket|merch|pre-?game|post-?game|food|beverage|hotel|early entry|entry pass/i;
const WC = /\bWC\b|wheelchair|\bADA\b|accessible|companion/i;

/** Seatics website config for each site. */
const SEATICS_CONFIG = { ticketnetwork: 3551, ticketliquidator: 237 } as const;

async function getText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "*/*" },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/**
 * Reads the JavaScript array literal Seatics wraps in its callback
 * (single-quoted strings, numbers, nested arrays). A small parser, so no
 * third-party code is ever run.
 */
export function parseJsArray(src: string, start: number): unknown {
  let i = start;
  const ws = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };
  const value = (): unknown => {
    ws();
    const c = src[i];
    if (c === "[") {
      i++;
      const out: unknown[] = [];
      ws();
      if (src[i] === "]") {
        i++;
        return out;
      }
      for (;;) {
        out.push(value());
        ws();
        if (src[i] === ",") i++;
        else if (src[i] === "]") {
          i++;
          return out;
        } else throw new Error("bad array");
      }
    }
    if (c === "'" || c === '"') {
      i++;
      let s = "";
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\") {
          const n = src[i + 1];
          if (n === "u") {
            s += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16));
            i += 6;
            continue;
          }
          s += n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "" : n;
          i += 2;
          continue;
        }
        s += src[i++];
      }
      i++;
      return s;
    }
    if (c === "{") {
      // Objects aren't needed; skip to the matching brace.
      let depth = 0;
      do {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") depth--;
        i++;
      } while (depth > 0 && i < src.length);
      return null;
    }
    const m = /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|null|true|false|undefined)/i.exec(src.slice(i, i + 40));
    if (!m) throw new Error("bad value");
    i += m[0].length;
    const t = m[0];
    return t === "null" || t === "undefined" ? null : t === "true" ? true : t === "false" ? false : Number(t);
  };
  return value();
}

type SeaticsRow = [string, string, string, number, number, ...unknown[]];

/** Cheapest single seat in a Seatics TicketsByEvent answer, fees included. */
export function cheapestSeatics(text: string): number | null | undefined {
  const at = text.indexOf("cb([");
  if (at < 0) return undefined;
  const data = parseJsArray(text, at + 3) as unknown[];
  const rows = Array.isArray(data?.[0]) ? (data[0] as SeaticsRow[]) : null;
  if (!rows) return undefined;
  let best: number | null = null;
  for (const t of rows) {
    const allIn = Number(t[21]);
    const ticketType = t[10];
    const splits = Number(t[18]);
    const notes = String(t[6] ?? "");
    if (ticketType !== 1 || !(splits & 1) || !(allIn > 0)) continue; // tickets only, sold as one
    // Only listings placed on the venue's seat map: unplaced ones included
    // parking lots (NRG Park's colour lots) and an "early entry pass".
    if (!String(t[0] ?? "").trim()) continue;
    if (NON.test(`${t[0]} ${t[1]} ${notes}`) || WC.test(`${t[0]} ${t[1]} ${t[2]} ${notes}`)) continue;
    if (best === null || allIn < best) best = allIn;
  }
  return best;
}


/** The whole-dollar price the sites show ($211.60 shows as $212). */
const shown = (v: number) => Math.ceil(Math.round(v * 100) / 100);

async function livePrice(row: SitePrice): Promise<number | null | undefined> {
  if (row.site === "ticketnetwork" || row.site === "ticketliquidator") {
    const id = row.url.match(/\/tickets\/(\d+)\//)?.[1];
    if (!id) return undefined;
    const text = await getText(
      `https://mapwidget3.seatics.com/Api/TicketsByEvent?callback=cb&eventId=${id}&websiteConfigId=${SEATICS_CONFIG[row.site]}`,
    );
    if (!text) return undefined;
    try {
      return cheapestSeatics(text);
    } catch {
      return undefined; // an answer we can't read keeps the saved price
    }
  }
  if (row.site === "gametime") {
    const id = row.url.match(/\/events\/([\w-]+)/)?.[1];
    if (!id) return undefined;
    const text = await getText(`https://mobile.gametime.co/v3/listings/${id}?all_in_pricing=true&jitter_cheapest=0&quantity=1`);
    if (!text) return undefined;
    try {
      return cheapestGametime(JSON.parse(text));
    } catch {
      return undefined;
    }
  }
  if (row.site === "livefootballtickets" || row.site === "tickpick") {
    // Both publish the page's "tickets from" price in its structured data,
    // in US dollars on these US pages (LiveFootballTickets checked 3 Oct 2026:
    // "Tickets available from $173.80" = lowPrice 173.8).
    const text = await getText(row.url);
    if (!text || !/"priceCurrency"\s*:\s*"USD"/.test(text)) return undefined;
    const low = Number(text.match(/"lowPrice"\s*:\s*"?(\d+(?:\.\d+)?)/)?.[1]);
    return low > 0 ? low : undefined;
  }
  return undefined;
}

interface GametimeListing {
  available_lots?: number[];
  price?: { pre_tax_total?: number };
  spot?: { section?: string; section_group?: string; row?: string };
  disclosures?: string[];
}

/**
 * Cheapest Gametime seat sold as a single ticket, in dollars. Gametime shows
 * the pre-tax total (fees included), rounded up to the dollar; checked against
 * its event pages on 29 Sep 2026.
 */
export function cheapestGametime(data: { listings?: GametimeListing[] }): number | null | undefined {
  if (!Array.isArray(data?.listings)) return undefined;
  let best: number | null = null;
  for (const l of data.listings) {
    const cents = l.price?.pre_tax_total ?? 0;
    if (!(l.available_lots ?? []).includes(1) || !(cents > 0)) continue;
    const text = `${l.spot?.section ?? ""} ${l.spot?.section_group ?? ""} ${l.spot?.row ?? ""} ${(l.disclosures ?? []).join(" ")}`;
    if (NON.test(text) || WC.test(text)) continue;
    if (best === null || cents / 100 < best) best = cents / 100;
  }
  return best;
}

const LIVE_SITES = new Set<SitePrice["site"]>(["ticketnetwork", "ticketliquidator", "gametime", "livefootballtickets", "tickpick"]);

/** Sites whose live price is the cheapest real seat, not a headline "from" figure. */
const SEAT_CHECKED = new Set<SitePrice["site"]>(["ticketnetwork", "ticketliquidator", "gametime", "vividseats", "stubhub", "ticketsmarter"]);

/**
 * The saved rows, with TicketNetwork's, Ticket Liquidator's, Gametime's,
 * LiveFootballTickets' and TickPick's replaced by today's prices where their feeds answer. `undefined` from a feed
 * means it didn't answer, so the saved row stays.
 */
export async function withLiveResalePrices(rows: SitePrice[]): Promise<SitePrice[]> {
  return Promise.all(
    rows.map(async (r) => {
      if (!LIVE_SITES.has(r.site)) return r;
      const v = await livePrice(r);
      if (v === undefined) return r;
      if (v === null) return { site: r.site, url: r.url, price: null, note: "No single seat listed right now" };
      // LiveFootballTickets shows cents; the others show whole dollars.
      const price = r.site === "livefootballtickets" ? Math.round(v * 100) / 100 : shown(v);
      return { site: r.site, url: r.url, price, ...(r.label ? { label: r.label } : {}) };
    }),
  ).then(holdBackAddOns);
}

/**
 * TickPick's listed "from" price sometimes belongs to an add-on, not a seat
 * ("post-game photo on field" at $23 when the cheapest seat was $74). As in
 * the saved prices: below 70% of the cheapest seat-checked price on the other
 * sites, it isn't shown as a ticket price.
 */
function holdBackAddOns(rows: SitePrice[]): SitePrice[] {
  const seats = rows.filter((r) => SEAT_CHECKED.has(r.site) && r.price !== null).map((r) => r.price!);
  if (!seats.length) return rows;
  const floor = 0.7 * Math.min(...seats);
  return rows.map((r) =>
    r.site === "tickpick" && r.price !== null && r.price < floor
      ? { site: r.site, url: r.url, price: null, note: "Listed price looked like an add-on, not a seat: open TickPick to check" }
      : r,
  );
}
