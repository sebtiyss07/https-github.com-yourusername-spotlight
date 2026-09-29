import Link from "next/link";
import type { EventContext } from "@/lib/repositories";
import { dateParts, formatDateRange, formatPrice, formatTime } from "@/lib/format";
import { TeamMark } from "@/components/TeamMark";

/** A calendar-page tile: weekday, big day number, month — readable at a glance. */
function DateTile({ iso, timeZone }: { iso: string; timeZone: string }) {
  const { weekday, day, month } = dateParts(iso, timeZone);
  return (
    <div className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-line bg-surface text-center">
      <span className="w-full bg-accent py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
        {month}
      </span>
      <span className="font-display text-[22px] font-semibold leading-tight">{day}</span>
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
      className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-line-bright hover:shadow-md sm:gap-5 sm:p-4"
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
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{title}</p>
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
          <p className="tabular text-[17px] font-semibold leading-tight text-positive">
            {formatPrice(prices.cheapest.amount!, prices.currency)}
          </p>
          <p className="hidden text-[11px] text-ink-3 sm:block">
            {pricedSites > 1 ? `cheapest of ${pricedSites} sites` : prices.cheapest.label}
          </p>
        </div>
      )}

      <span className="hidden shrink-0 rounded-full bg-surface-2 px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors group-hover:bg-accent group-hover:text-white sm:inline-block">
        {prices.offers.length > 1 ? "Compare →" : "Plan trip →"}
      </span>
    </Link>
  );
}

/** A final or championship, as a card with a floodlit header in the sport's colour. */
export function MarqueeCard({
  context,
  accent,
}: {
  context: EventContext;
  accent: string;
}) {
  const { event, venue, title, league } = context;
  const timeZone = venue?.timeZone ?? "UTC";

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className="glow px-5 pb-5 pt-4"
        style={{ ["--glow" as string]: accent }}
      >
        <p className="text-[12px] font-semibold uppercase tracking-wide text-white/70">
          {league?.name}
        </p>
        <h3 className="mt-1 text-[19px] font-semibold leading-snug">{title}</h3>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[14px] text-ink-2">
          {formatDateRange(event.startsAt, event.endsAt, timeZone)}
          {!event.endsAt && ` · ${formatTime(event.startsAt, timeZone)} local`}
        </p>
        <p className="text-[13px] text-ink-3">
          {venue ? `${venue.name}, ${venue.city}` : "Venue to be confirmed"}
        </p>
        <div className="mt-auto flex justify-end pt-5">
          <span className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white transition-colors group-hover:bg-accent">
            Plan trip →
          </span>
        </div>
      </div>
    </Link>
  );
}
