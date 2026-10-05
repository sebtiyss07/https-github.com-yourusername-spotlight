import { getEvent, getVenue } from "@/lib/repositories";
import { eventTitle } from "@/lib/data/events";

/** The game as a calendar file (.ics): title, venue and start time. */
export async function GET(_req: Request, { params }: { params: Promise<{ event: string }> }) {
  const { event: id } = await params;
  const event = await getEvent(id);
  if (!event) return new Response("Not found", { status: 404 });
  const venue = await getVenue(event.venueId);
  const start = new Date(event.startsAt);
  // Games run about three hours; a race weekend ends when the race does.
  const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 3 * 3_600_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const url = `https://www.spotlightkt.com/events/${event.id}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Spotlight//Game//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@spotlightkt.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(eventTitle(event))}`,
    venue ? `LOCATION:${esc(`${venue.name}, ${venue.city}`)}` : "",
    `DESCRIPTION:${esc(`Compare ticket prices: ${url}`)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${event.id}.ics"` },
  });
}
