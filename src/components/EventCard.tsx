import Link from "next/link";
import type { EventContext } from "@/lib/repositories";
import { dateParts, formatDateRange, formatPrice, formatTime } from "@/lib/format";
import { TeamMark } from "@/components/TeamMark";

/** A calendar-page tile: weekday, big day number, month — readable at a glance. */
function DateTile({ iso, timeZone }: { iso: string; timeZone: string }) {
  const { weekday, day, month } = dateParts(iso, timeZone);
  return (
    <div className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-line bg-surface text-center">
      <span className="w-full border-b border-line py-0.5 text-[10px] uppercase tracking-wide text-ink-3">
        {month}
      </span>
      <span className="text-[19px] font-medium leading-tight">{day}</span>
      <span className="pb-1 text-[11px] font-medium text-ink-3">{weekday}</span>
    </div>
  );
}

/**
 * One game in a list: when, who, where, and the cheapest ticket any site
 * listed — so matches can be compared without opening each one.
 */
export function EventRow({ context }: { context: EventContext }) {
  const { event, venue, homeTeam, awayTeam, title, prices } = context;
  const pricedSites = prices.offers.filter((o) => o.amount !== null).length;
  // Venue-local, so a Thursday-night game reads as Thursday.
  const timeZone = venue?.timeZone ?? "UTC";

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-3.5 transition-all hover:border-ink sm:gap-5 sm:p-4"
    >
      <DateTile iso={event.startsAt} timeZone={timeZone} />

      {homeTeam && awayTeam && (
        <div className="hidden shrink-0 items-center -space-x-2 sm:flex">
          <TeamMark
            name={homeTeam.name}
            abbreviation={homeTeam.abbreviation}
            logoUrl={homeTeam.logoUrl}
            primary={homeTeam.primaryColor}
            secondary={homeTeam.secondaryColor}
            size={36}
          />
          <TeamMark
            name={awayTeam.name}
            abbreviation={awayTeam.abbreviation}
            logoUrl={awayTeam.logoUrl}
            primary={awayTeam.primaryColor}
            secondary={awayTeam.secondaryColor}
            size={36}
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-medium leading-snug">{title}</p>
        <p className="truncate text-[13px] text-ink-3">
          {event.endsAt
            ? formatDateRange(event.startsAt, event.endsAt, timeZone)
            : formatTime(event.startsAt, timeZone)}
          {venue && ` · ${venue.name}, ${venue.city}`}
        </p>
      </div>

      {prices.cheapest && (
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-medium text-ink-3">from</p>
          <p className="tabular text-[16px] font-medium leading-tight text-ink">
            {formatPrice(prices.cheapest.amount!, prices.currency)}
          </p>
          <p className="hidden text-[11px] text-ink-3 sm:block">
            {pricedSites > 1 ? `cheapest of ${pricedSites} sites` : prices.cheapest.label}
          </p>
        </div>
      )}

      <span aria-hidden className="hidden shrink-0 text-ink-3 transition-colors group-hover:text-ink sm:inline">→</span>
    </Link>
  );
}
