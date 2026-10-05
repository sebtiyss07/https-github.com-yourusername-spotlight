import { originCities } from "@/lib/providers/geo";

export const dynamic = "force-static";

/** Every city the "travelling from" boxes can suggest, fetched once per visit. */
export function GET() {
  return Response.json(
    originCities().map((c) => [c.city, c.country, c.code, c.airport, Math.round(c.lat * 100) / 100, Math.round(c.lon * 100) / 100]),
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
