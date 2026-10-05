import type { EventContext } from "@/lib/repositories";
import type { FinderRow } from "@/components/MatchFinder";
import { localDate } from "@/lib/dates";
import { dateParts, formatDateRange, formatTime } from "@/lib/format";

/** One game flattened for a list row (league pages and the home page). */
export function toFinderRow(context: EventContext): FinderRow {

  const { event, venue, homeTeam, awayTeam, title, prices } = context;
  const zone = venue?.timeZone ?? "UTC";
  const { weekday, day, month } = dateParts(event.startsAt, zone);
  const crest = (t: typeof homeTeam) =>
    t
      ? {
          name: t.name,
          abbreviation: t.abbreviation,
          logoUrl: t.logoUrl,
          primary: t.primaryColor,
          secondary: t.secondaryColor,
        }
      : undefined;
  return {
    id: event.id,
    title,
    teamIds: [event.homeTeamId, event.awayTeamId].filter((x): x is string => !!x),
    month: localDate(event.startsAt, zone).slice(0, 7),
    day,
    weekday,
    monthShort: month,
    time: event.endsAt
      ? formatDateRange(event.startsAt, event.endsAt, zone)
      : `${formatTime(event.startsAt, zone)} local`,
    place: venue ? `${venue.name}, ${venue.city}` : "Venue to be confirmed",
    startsAt: event.startsAt,
    price: prices.cheapest?.amount ?? null,
    site: prices.cheapest?.label ?? null,
    sites: prices.offers.filter((o) => o.amount !== null).length,
    home: crest(homeTeam),
    away: crest(awayTeam),
    // Smaller copy of the same Commons image for list rows.
    photo: context.photo && event.sportId !== "motorsport"
      ? context.photo.small
      : undefined,
  };
}
