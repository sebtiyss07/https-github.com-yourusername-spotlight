import { allInPrice, convertUsd, type EventContext } from "@/lib/repositories";
import { savedHotelFor } from "@/lib/providers/livePrices";

/**
 * "Trip from": the cheapest ticket with fees included plus the cheapest
 * saved hotel for the game's stay, for one person. Null when either part
 * isn't known, so a trip price is never half a guess.
 */
export function tripFrom(c: EventContext): number | null {
  const ticket = allInPrice(c);
  if (ticket === null || !c.venue) return null;
  const hotel = savedHotelFor(c.event.id, c.venue.country);
  if (!hotel) return null;
  return Math.round((ticket + convertUsd(hotel.total, c.prices.currency)) * 100) / 100;
}
