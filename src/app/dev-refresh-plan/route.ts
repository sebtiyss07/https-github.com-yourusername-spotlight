import { getUpcomingEvents, getVenue } from "@/lib/repositories";
import { tripDates } from "@/lib/trip";

/**
 * Development only: every upcoming game with its venue and the default hotel
 * stay (2 nights, 3 for a race weekend), for the daily price refresh
 * (scripts/refresh). 404 on the live site.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const events = await getUpcomingEvents();
  const rows = await Promise.all(
    events.map(async (event) => {
      const venue = await getVenue(event.venueId);
      if (!venue) return null;
      const stay = tripDates(event, venue, event.sportId === "motorsport" ? 3 : 2);
      return {
        id: event.id,
        startsAt: event.startsAt,
        venue: { name: venue.name, city: venue.city, country: venue.country, lat: venue.lat, lon: venue.lon },
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
      };
    }),
  );
  return Response.json({ events: rows.filter(Boolean) });
}
