import { getEvent, getEventContexts, search } from "@/lib/repositories";
import type { SportEvent } from "@/lib/domain/types";
import { dateParts, formatPrice } from "@/lib/format";

/**
 * Instant search suggestions for the search box: leagues and teams first,
 * then the next matching games with their date and cheapest saved price.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.slice(0, 60) ?? "";
  const { hits } = await search(q);
  // ?only=places: teams and leagues only (the trip planner's "who" box).
  if (params.get("only") === "places") {
    const items = hits
      .filter((h) => h.kind === "league" || h.kind === "team")
      .slice(0, 8)
      .map((h) => ({ kind: h.kind, id: h.id, title: h.title, subtitle: h.kind === "team" ? h.subtitle : "Every game" }));
    return Response.json({ items }, { headers: { "Cache-Control": "public, max-age=300" } });
  }
  const places = hits.filter((h) => h.kind === "league" || h.kind === "team").slice(0, 4);
  const events = (await Promise.all(hits.filter((h) => h.kind === "event").slice(0, 5).map((h) => getEvent(h.id)))).filter(
    (e): e is SportEvent => e !== null,
  );
  const games = await getEventContexts(events);
  const items = [
    ...places.map((h) => ({ kind: h.kind, title: h.title, subtitle: h.kind === "team" ? "Team · all games" : "League · all games", href: h.href })),
    ...games.map((c) => {
      const { weekday, day, month } = dateParts(c.event.startsAt, c.venue?.timeZone ?? "UTC");
      return {
        kind: "event" as const,
        title: c.title,
        subtitle: `${weekday} ${day} ${month}${c.league ? ` · ${c.league.shortName}` : ""}`,
        href: `/events/${c.event.id}`,
        price: c.prices.cheapest
          ? `${formatPrice(c.prices.cheapest.amount!, c.prices.currency)}${c.prices.cheapest.fees.included !== "yes" ? " + any fees" : ""}`
          : null,
      };
    }),
  ];
  return Response.json({ items }, { headers: { "Cache-Control": "public, max-age=300" } });
}
