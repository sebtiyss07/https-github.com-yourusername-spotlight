import { getEvent, getEventContexts } from "@/lib/repositories";
import type { SportEvent } from "@/lib/domain/types";

/**
 * Today's cheapest saved price for a list of games (for "My games"). Games
 * that have been played or no longer exist are left out.
 */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 100);
  const events = (await Promise.all(ids.map((id) => getEvent(id)))).filter((e): e is SportEvent => e !== null);
  const games = await getEventContexts(events);
  return Response.json({
    games: games.map((c) => ({
      id: c.event.id,
      price: c.prices.cheapest?.amount ?? null,
      site: c.prices.cheapest?.label ?? null,
      currency: c.prices.currency,
    })),
  });
}
