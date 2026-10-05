import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getEventContexts,
  getEventsByLeague,
  getLeague,
  getLeagues,
  getSport,
  getTeamsByLeague,
  getLeaguePhoto,
} from "@/lib/repositories";
import { MatchFinder, type FinderRow } from "@/components/MatchFinder";
import { toFinderRow } from "@/lib/finderRow";
import { SportIcon } from "@/components/SportIcon";
import { EmptyState, PhotoCredit } from "@/components/ui";

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

  const [sport, teams, events, photo] = await Promise.all([
    getSport(league.sportId),
    getTeamsByLeague(league.id),
    getEventsByLeague(league.id).then(getEventContexts),
    getLeaguePhoto(league.id),
  ]);

  const isRace = league.sportId === "motorsport";
  // Football is "matches"; American sports say "games".
  const noun = isRace ? "races" : league.sportId === "soccer" && league.id !== "mls" ? "matches" : "games";
  const rows: FinderRow[] = events.map((c) => toFinderRow(c));
  const currency = events[0]?.prices.currency ?? "USD";
  const teamOptions = [...teams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ id: t.id, name: t.name }));
  const initialTeam = teamOptions.some((t) => t.id === query.team) ? query.team : "";

  return (
    <>
      <header
        className="glow relative overflow-hidden"
        style={{ ["--glow" as string]: sport?.accent ?? "#1d4ed8" }}
      >
        {photo && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.large} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-night/95 via-night/80 to-night/40" />
            <PhotoCredit photo={photo} className="absolute bottom-3 right-3 z-10" />
          </>
        )}
        <div className="relative mx-auto max-w-4xl px-5 pb-14 pt-8 sm:px-6 sm:pt-10">
          <div className="flex items-center gap-3">
            {sport && (
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white">
                <SportIcon sport={sport.id} size={22} />
              </span>
            )}
            <p className="text-[13px] font-semibold uppercase tracking-wide text-white/75">
              {events.length.toLocaleString("en-US")} {noun} left this season
            </p>
          </div>
          <h1 className="mt-3 text-[32px] font-extrabold leading-tight text-white sm:text-[44px]">
            {league.name}
          </h1>
          <p className="mt-2 max-w-xl text-[16px] text-white/85">
            {isRace
              ? "The cheapest weekend pass for every race, across the ticket sites we check. Pick a race to compare prices."
              : `The cheapest ticket for every ${noun.slice(0, -1).replace(/che$/, "ch")}, across the ticket sites we check. Filter by team, month or budget, then pick one to compare prices.`}
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
