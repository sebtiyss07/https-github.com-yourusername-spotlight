import type { Money } from "@/lib/domain/types";
import { buildListings } from "@/lib/providers/tickets/seeded";
import { isValidMoney } from "@/lib/money";

/**
 * Price index — the "from" prices on list pages.
 *
 * A league page shows 40 fixtures. Fanning out to seven marketplaces for each
 * one is 280 HTTP calls to render a list, which is both far too slow and a fast
 * route to being rate-limited off every partner API you have.
 *
 * The correct production shape is what's modelled here: a *cached price index*,
 * refreshed by a background job, answering "cheapest total for this event" from
 * local storage in constant time. List pages read the index; only the event
 * detail page does a live fan-out.
 *
 * ## Why this file defines the meaning of "from"
 *
 * The index and the detail page previously disagreed. The index took the
 * cheapest of *all* listings; the detail page filtered to those with enough
 * seats for the party size (default two). So a league page could advertise $63
 * from a single-seat listing, and the detail page — asked for two together —
 * would show something dearer. Same event, two numbers, no explanation.
 *
 * The fix is that both now call `cheapestFor()`, and the quantity is explicit
 * rather than assumed. `from` means *one seat*, which is what a "from" price
 * conventionally means, and the UI labels it "each".
 *
 * When real providers come online, replace the body of `compute()` with the
 * crawl and persist to Redis or an `event_price_index` table. The read API
 * below doesn't change.
 */

export interface PriceIndexEntry {
  eventId: string;
  /** Cheapest all-in total for a SINGLE seat. */
  from: Money;
  /** Number of marketplaces that had inventory. */
  marketplaceCount: number;
  updatedAt: string;
}

/** Process-local cache. Swap for Redis when you run more than one instance. */
const CACHE = new Map<string, PriceIndexEntry>();

/** How long an entry stays fresh. Event pricing doesn't move minute to minute. */
const TTL_MS = 10 * 60 * 1000;

function isStale(entry: PriceIndexEntry): boolean {
  return Date.now() - Date.parse(entry.updatedAt) > TTL_MS;
}

/**
 * The single definition of "cheapest" — shared by the index and the detail
 * page, so the two cannot drift apart again.
 *
 * `quantity` is the number of seats needed *together*: a listing with one seat
 * left can't serve a party of two, and quietly ignoring that is how a headline
 * price becomes unbuyable.
 */
export function cheapestFor(
  eventId: string,
  quantity = 1,
): { total: Money; marketplaceCount: number } | null {
  const listings = buildListings(eventId).filter(
    (l) => l.quantityAvailable >= quantity && isValidMoney(l.total),
  );
  if (listings.length === 0) return null;

  const cheapest = listings.reduce((min, l) =>
    l.total.amount < min.total.amount ? l : min,
  );

  return {
    total: cheapest.total,
    marketplaceCount: new Set(listings.map((l) => l.marketplace)).size,
  };
}

function compute(eventId: string): PriceIndexEntry | null {
  const cheapest = cheapestFor(eventId, 1);
  if (!cheapest) return null;

  return {
    eventId,
    from: cheapest.total,
    marketplaceCount: cheapest.marketplaceCount,
    updatedAt: new Date().toISOString(),
  };
}

export function getFromPrice(eventId: string): PriceIndexEntry | null {
  const cached = CACHE.get(eventId);
  if (cached && !isStale(cached)) return cached;

  const fresh = compute(eventId);
  if (fresh) CACHE.set(eventId, fresh);
  return fresh;
}

/** Batch read for a list page. */
export function getFromPrices(
  eventIds: string[],
): Map<string, PriceIndexEntry> {
  const out = new Map<string, PriceIndexEntry>();
  for (const id of eventIds) {
    const entry = getFromPrice(id);
    if (entry) out.set(id, entry);
  }
  return out;
}
