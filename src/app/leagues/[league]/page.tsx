import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getEventContexts,
  getEventsByLeague,
  getLeague,
  getLeagues,
  getSport,
  getTeamsByLeague,
  type EventContext,
} from "@/lib/repositories";
import { MatchFinder, type FinderRow } from "@/components/MatchFinder";
import { localDate } from "@/lib/dates";
import { dateParts, formatDateRange, formatTime } from "@/lib/format";
import { SportIcon } from "@/components/SportIcon";
import { EmptyState } from "@/components/ui";

export async function generateStaticParams() {
  const leagues = await getLeagues();
  return leagues.map((l) => ({ league: l.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ league: string }>;
}): Promise<Metadata> {
  const { league: leagueId } = await params;
  const league = await getLeague(leagueId);
  if (!league) return {};
  return { title: league.name, description: league.description };
}

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const [{ league: leagueId }, query] = await Promise.all([params, searchParams]);
  const league = await getLeague(leagueId);
  if (!league) notFound();

  const [sport, teams, events] = await Promise.all([
    getSport(league.sportId),
    getTeamsByLeague(league.id),
    getEventsByLeague(league.id).then(getEventContexts),
  ]);

  const isRace = league.sportId === "motorsport";
  // Football is "matches"; American sports say "games".
  const noun = isRace ? "races" : league.sportId === "soccer" && league.id !== "mls" ? "matches" : "games";
  const rows: FinderRow[] = events.map((c) => toRow(c));
  const currency = events[0]?.prices.currency ?? "USD";
  const teamOptions = [...teams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ id: t.id, name: t.name }));
  const initialTeam = teamOptions.some((t) => t.id === query.team) ? query.team : "";

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto max-w-4xl px-5 pb-10 pt-10 sm:px-6 sm:pt-14">
          <p className="flex items-center gap-2 text-[13px] text-ink-3">
            {sport && <SportIcon sport={sport.id} size={16} />}
            {events.length.toLocaleString("en-US")} {noun} left this season
          </p>
          <h1 className="mt-3 text-[32px] font-medium leading-tight tracking-[-0.035em] text-ink sm:text-[44px]">
            {league.name}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-ink-3">
            {isRace
              ? "The cheapest weekend pass for every race, across every site that sells it. Pick a race to compare prices."
              : `The cheapest ticket for every ${noun.slice(0, -1).replace(/che$/, "ch")}, across every site that sells it. Filter by team, month or budget, then pick one to compare prices.`}
          </p>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-4xl px-5 sm:px-6">
        {events.length === 0 ? (
          <EmptyState
            title={`No ${noun} coming up`}
            description="There's nothing on the calendar right now. Check back soon."
          />
        ) : (
          <MatchFinder
            rows={rows}
            teams={isRace ? [] : teamOptions}
            currency={currency}
            initialTeam={initialTeam}
            noun={noun}
          />
        )}
      </div>
    </>
  );
}

function toRow(context: EventContext): FinderRow {
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
