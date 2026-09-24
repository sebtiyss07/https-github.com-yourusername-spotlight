import Link from "next/link";
import type { EventContext } from "@/lib/repositories";
import { getFromPrice } from "@/lib/providers/priceIndex";
import {
  formatCountdown,
  formatDate,
  formatDateRange,
  formatMoney,
  formatTime,
} from "@/lib/format";
import { Badge } from "@/components/ui";
import { TeamMark } from "@/components/TeamMark";

/**
 * Compact event row for list pages.
 *
 * Carries no border or background of its own — callers place these inside a
 * `divide-y` group so the list reads as one table rather than a stack of
 * floating cards.
 *
 * The "from" price comes from the cached price index, never a live provider
 * fan-out — see `lib/providers/priceIndex.ts` for why that distinction matters.
 */
export function EventRow({ context }: { context: EventContext }) {
  const { event, venue, homeTeam, awayTeam, title } = context;
  const price = getFromPrice(event.id);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group -mx-4 flex items-center gap-5 rounded-lg px-4 py-4 transition-colors hover:bg-surface-2/70"
    >
      <div className="w-[74px] shrink-0">
        <p className="text-[13px] font-semibold">{formatDate(event.startsAt)}</p>
        <p className="tabular text-[12px] text-ink-3">
          {formatTime(event.startsAt)}
        </p>
      </div>

      {homeTeam && awayTeam ? (
        <div className="flex shrink-0 items-center -space-x-1.5">
          <TeamMark
            name={awayTeam.name}
            abbreviation={awayTeam.abbreviation}
            logoUrl={awayTeam.logoUrl}
            primary={awayTeam.primaryColor}
            secondary={awayTeam.secondaryColor}
            size={28}
          />
          <TeamMark
            name={homeTeam.name}
            abbreviation={homeTeam.abbreviation}
            logoUrl={homeTeam.logoUrl}
            primary={homeTeam.primaryColor}
            secondary={homeTeam.secondaryColor}
            size={28}
          />
        </div>
      ) : (
        <span
          aria-hidden
          className="h-7 w-7 shrink-0 rounded-full border border-line-bright"
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-medium tracking-tight">
          {title}
        </p>
        <p className="truncate text-[12.5px] text-ink-3">
          {venue ? `${venue.name} · ${venue.city}` : "Venue to be confirmed"}
        </p>
      </div>

      <div className="hidden shrink-0 items-center gap-2 lg:flex">
        {event.isMarquee && <Badge tone="warn">Marquee</Badge>}
        {event.demandScore >= 85 && !event.isMarquee && (
          <Badge tone="hot">High demand</Badge>
        )}
        {event.kind === "playoff" && <Badge tone="accent">Playoff</Badge>}
      </div>

      <div className="w-[104px] shrink-0 text-right">
        {price ? (
          <>
            <p className="tabular text-[15px] font-semibold">
              {formatMoney(price.from)}
            </p>
            <p className="text-[11.5px] text-ink-3">
              each · {price.marketplaceCount} sites
            </p>
          </>
        ) : (
          <p className="text-[12.5px] text-ink-3">Not on sale</p>
        )}
      </div>
    </Link>
  );
}

/**
 * Championship card.
 *
 * Also chrome-less: callers place these in a `gap-px` grid over a hairline
 * background, so divisions between cards are single-pixel rules rather than six
 * separate rounded boxes each with its own border and shadow.
 */
export function MarqueeCard({
  context,
  accent,
}: {
  context: EventContext;
  accent: string;
}) {
  const { event, venue, title, league } = context;
  const price = getFromPrice(event.id);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col bg-surface p-6 transition-colors hover:bg-surface-2/60"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: accent }}
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
          {event.kind === "race" ? "Race weekend" : "Championship"}
        </span>
        <span className="ml-auto shrink-0 text-[12px] text-ink-3">
          {formatCountdown(event.startsAt)}
        </span>
      </div>

      <h3 className="text-[17px] font-semibold leading-snug tracking-tight">
        {title}
      </h3>

      <p className="mt-2 text-[13.5px] text-ink-2">
        {formatDateRange(event.startsAt, event.endsAt)}
      </p>
      <p className="text-[13.5px] text-ink-3">
        {venue ? `${venue.name}, ${venue.city}` : "Venue TBC"}
      </p>

      <div className="mt-auto flex items-end justify-between gap-3 pt-8">
        <span className="truncate text-[12.5px] text-ink-3">{league?.name}</span>
        {price && (
          <span className="shrink-0 text-right">
            <span className="block text-[11px] text-ink-3">from</span>
            <span className="tabular text-[17px] font-semibold">
              {formatMoney(price.from)}
            </span>
          </span>
        )}
      </div>
    </Link>
  );
}
