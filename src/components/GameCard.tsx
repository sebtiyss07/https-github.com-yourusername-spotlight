import Link from "next/link";
import type { EventContext } from "@/lib/repositories";
import { TeamMark } from "@/components/TeamMark";
import { dateParts, formatPrice, formatTime } from "@/lib/format";
import { darkTeamColor } from "@/lib/colors";

/** Each competition's colour: its home-page card, and game cards without a photo. */
export const LEAGUE_COLORS: Record<string, string> = {
  nfl: "#013369",
  nba: "#c8102e",
  mls: "#1c7c54",
  "premier-league": "#3d195b",
  "champions-league": "#0e1e5b",
  "formula-1": "#e10600",
};

/**
 * A game or race card with its cheapest real price. Uses the stadium photo
 * where we have one; otherwise the two teams' colours and badges.
 */
export function GameCard({ context, race }: { context: EventContext; race?: boolean }) {
  const { event, venue, title, prices, photo, homeTeam, awayTeam, league } = context;
  const zone = venue?.timeZone ?? "UTC";
  const { weekday, day, month } = dateParts(event.startsAt, zone);
  const sites = prices.offers.filter((o) => o.amount !== null).length;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className="relative h-36 overflow-hidden bg-[#0b0d1a]"
        style={
          !photo?.small && homeTeam && awayTeam
            ? { background: `linear-gradient(120deg, ${darkTeamColor(homeTeam)} 0%, ${darkTeamColor(homeTeam)} 48%, ${darkTeamColor(awayTeam)} 52%, ${darkTeamColor(awayTeam)} 100%)` }
            : undefined
        }
      >
        {photo?.small ? (
          race ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.small}
              alt=""
              className="absolute inset-0 m-auto h-[80%] opacity-60 [filter:brightness(0)_invert(1)]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.small}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )
        ) : !homeTeam || !awayTeam ? (
          // No photo or team colours on file (e.g. European cup ties): the
          // two sides' names on the competition's colour.
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center text-white"
            style={{ background: `linear-gradient(135deg, ${LEAGUE_COLORS[event.leagueId] ?? "#1f2340"}, #0b0d1a)` }}
          >
            {title.split(/\s+(?:vs\.?|v|at)\s+/i).map((side, i) => (
              <span key={i} className={i === 0 ? "text-[18px] font-semibold leading-tight" : "text-[18px] font-semibold leading-tight before:mr-1 before:text-[13px] before:font-normal before:text-white/60 before:content-['vs']"}>
                {side}
              </span>
            ))}
          </div>
        ) : (
          homeTeam &&
          awayTeam && (
            <div className="absolute inset-0 flex items-center justify-center gap-6">
              <span className="rounded-full bg-white/95 p-1.5 shadow">
                <TeamMark name={homeTeam.name} abbreviation={homeTeam.abbreviation} logoUrl={homeTeam.logoUrl} primary={homeTeam.primaryColor} secondary={homeTeam.secondaryColor} size={48} />
              </span>
              <span className="text-[14px] font-semibold text-white/90">vs</span>
              <span className="rounded-full bg-white/95 p-1.5 shadow">
                <TeamMark name={awayTeam.name} abbreviation={awayTeam.abbreviation} logoUrl={awayTeam.logoUrl} primary={awayTeam.primaryColor} secondary={awayTeam.secondaryColor} size={48} />
              </span>
            </div>
          )
        )}
        <span className="absolute left-3 top-3 rounded-lg bg-white px-2 py-1 text-center text-[11px] font-semibold uppercase leading-tight text-ink shadow">
          {weekday} {day} {month}
        </span>
        {league && !race && (
          <span className="absolute right-3 top-3 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
            {league.shortName}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[16px] font-semibold leading-snug group-hover:text-accent">{title}</p>
        <p className="mt-0.5 truncate text-[13px] text-ink-3">
          {race ? venue?.city : `${formatTime(event.startsAt, zone)} · ${venue?.name ?? ""}`}
        </p>
        <div className="mt-auto flex items-end justify-between pt-4">
          {prices.cheapest ? (
            <p>
              <span className="block text-[12px] text-ink-3">
                {race ? "Weekend pass from" : "Tickets from"}
              </span>
              <span className="tabular text-[20px] font-semibold text-positive">
                {formatPrice(prices.cheapest.amount!, prices.currency)}
              </span>
              {prices.cheapest.fees.included !== "yes" && <span className="text-[12px] font-semibold text-hot"> + any fees</span>}
              {sites > 1 && (
                <span className="text-[12px] text-ink-3"> · cheapest of {sites} sites</span>
              )}
            </p>
          ) : (
            <p className="text-[13px] text-ink-3">See ticket sites</p>
          )}
          <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold transition-colors group-hover:bg-accent group-hover:text-white">
            Compare →
          </span>
        </div>
      </div>
    </Link>
  );
}
