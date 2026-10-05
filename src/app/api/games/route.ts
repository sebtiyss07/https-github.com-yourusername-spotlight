import { getEvent, getEventContext } from "@/lib/repositories";
import type { SportEvent } from "@/lib/domain/types";

/**
 * Each game's cheapest price right now, read the same way as its game page
 * (live where the page is live), so "cheaper than when you saved it" compares
 * like with like. Games that have been played or no longer exist are left out.
 */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 100);
  const events = (await Promise.all(ids.map((id) => getEvent(id)))).filter((e): e is SportEvent => e !== null);
  const games = await Promise.all(events.map((e) => getEventContext(e, { live: true })));
  return Response.json({
    games: games.map((c) => ({
      id: c.event.id,
      title: c.title,
      startsAt: c.event.startsAt,
      place: c.venue ? `${c.venue.name}, ${c.venue.city}` : "",
      price: c.prices.cheapest?.amount ?? null,
      site: c.prices.cheapest?.label ?? null,
      currency: c.prices.currency,
    })),
  });
}
