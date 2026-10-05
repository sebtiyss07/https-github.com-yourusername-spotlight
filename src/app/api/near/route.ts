import { getEventContexts, getUpcomingEvents, getVenue } from "@/lib/repositories";
import { haversineKm, resolveOrigin } from "@/lib/providers/geo";
import { toFinderRow } from "@/lib/finderRow";
import type { SportEvent } from "@/lib/domain/types";

/**
 * Upcoming games within a distance of a city (or a lat/lon), every league,
 * cheapest first, with each game's distance in miles.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const miles = Math.min(500, Math.max(10, Number(params.get("miles")) || 150));
  const days = Math.min(365, Math.max(1, Number(params.get("days")) || 365));
  let lat = Number(params.get("lat"));
  let lon = Number(params.get("lon"));
  let place: string | null = null;
  const city = params.get("city")?.slice(0, 60).trim();
  if (city) {
    const found = resolveOrigin(city);
    if (!found) return Response.json({ error: "city", games: [] });
    ({ lat, lon } = found);
    place = found.city;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return Response.json({ error: "location", games: [] });

  const events = await getUpcomingEvents();
  const venues = new Map((await Promise.all(events.map((e) => getVenue(e.venueId)))).flatMap((v) => (v ? [[v.id, v] as const] : [])));
  if (place) {
    // A typed city is measured from its own stadiums and arenas, not its
    // airport (O'Hare is 17 miles from Soldier Field).
    const inCity = [...venues.values()].filter((v) => v.city.toLowerCase() === place!.toLowerCase());
    if (inCity.length) {
      lat = inCity.reduce((a, v) => a + v.lat, 0) / inCity.length;
      lon = inCity.reduce((a, v) => a + v.lon, 0) / inCity.length;
    }
  }

  const until = Date.now() + days * 864e5;
  const near: { event: SportEvent; miles: number }[] = [];
  for (const event of events) {
    if (Date.parse(event.startsAt) > until) continue;
    const venue = venues.get(event.venueId);
    if (!venue) continue;
    const d = haversineKm(lat, lon, venue.lat, venue.lon) / 1.609;
    if (d <= miles) near.push({ event, miles: Math.round(d) });
  }
  const contexts = await getEventContexts(near.map((n) => n.event));
  const milesById = new Map(near.map((n) => [n.event.id, n.miles]));
  const games = contexts
    .filter((c) => c.prices.cheapest)
    .sort((a, b) => a.prices.cheapest!.amount! - b.prices.cheapest!.amount!)
    .slice(0, 40)
    .map((c) => {
      const row = toFinderRow(c);
      const miles = milesById.get(c.event.id)!;
      return { ...row, place: `${miles <= 2 ? "In town" : `${miles} mi away`} · ${row.place}`, miles };
    });
  return Response.json({ place, currency: contexts[0]?.prices.currency ?? "USD", total: near.length, games });
}
