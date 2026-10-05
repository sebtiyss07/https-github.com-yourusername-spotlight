import Link from "next/link";
import type { EventContext } from "@/lib/repositories";
import { TeamMark } from "@/components/TeamMark";
import { dateParts, formatPrice, formatTime } from "@/lib/format";

/** A game or race card with its cheapest real price: quiet, bordered, no imagery. */
export function GameCard({ context, race }: { context: EventContext; race?: boolean }) {
  const { event, venue, title, prices, homeTeam, awayTeam, league } = context;
  const zone = venue?.timeZone ?? "UTC";
  const { weekday, day, month } = dateParts(event.startsAt, zone);
  const sites = prices.offers.filter((o) => o.amount !== null).length;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-ink"
    >
      <p className="flex items-center justify-between text-[13px] text-ink-3">
        <span>
          {weekday} {day} {month}
          {!race && ` · ${formatTime(event.startsAt, zone)}`}
        </span>
        {league && !race && <span>{league.shortName}</span>}
      </p>
      {homeTeam && awayTeam && (
        <div className="mt-4 flex items-center -space-x-1.5">
          {[homeTeam, awayTeam].map((t) => (
            <TeamMark key={t.id} name={t.name} abbreviation={t.abbreviation} logoUrl={t.logoUrl} primary={t.primaryColor} secondary={t.secondaryColor} size={30} />
          ))}
        </div>
      )}
      <p className="mt-3 text-[16px] font-medium leading-snug text-ink">{title}</p>
      <p className="mt-0.5 truncate text-[13px] text-ink-3">{race ? venue?.city : venue?.name}</p>
      <div className="mt-auto flex items-end justify-between pt-6">
        {prices.cheapest ? (
          <p>
            <span className="block text-[12px] text-ink-3">{race ? "Weekend pass from" : "From"}</span>
            <span className="tabular text-[20px] font-medium tracking-[-0.02em] text-ink">
              {formatPrice(prices.cheapest.amount!, prices.currency)}
            </span>
            {sites > 1 && <span className="text-[12px] text-ink-3"> · {sites} sites</span>}
          </p>
        ) : (
          <p className="text-[13px] text-ink-3">See ticket sites</p>
        )}
        <span aria-hidden className="text-ink-3 transition-colors group-hover:text-ink">
          →
        </span>
      </div>
    </Link>
  );
}
