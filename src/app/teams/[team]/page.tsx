import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  allInPrice,
  getEventContexts,
  getEventsByTeam,
  getLeague,
  getTeam,
  getTeams,
  getVenue,
} from "@/lib/repositories";
import { EventRow } from "@/components/EventCard";
import { PriceCalendar } from "@/components/PriceCalendar";
import { EmptyState, TeamMark } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { darkTeamColor } from "@/lib/colors";
import Link from "next/link";

export async function generateStaticParams() {
  const teams = await getTeams();
  return teams.map((t) => ({ team: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}): Promise<Metadata> {
  const { team: teamId } = await params;
  const team = await getTeam(teamId);
  if (!team) return {};
  return {
    title: team.name,
    description: `Every upcoming ${team.name} game, with the cheapest ticket plus a flight and hotel to ${team.city}.`,
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: teamId } = await params;
  const team = await getTeam(teamId);
  if (!team) notFound();

  const [league, events, venue] = await Promise.all([
    getLeague(team.leagueId),
    getEventsByTeam(team.id).then(getEventContexts),
    getVenue(team.venueId),
  ]);
  const homeGames = events.filter((c) => c.event.homeTeamId === team.id).length;
  const cheapest = events.reduce<{ amount: number; currency: string } | null>((best, c) => {
    const p = allInPrice(c);
    return p != null && (!best || p < best.amount) ? { amount: p, currency: c.prices.currency } : best;
  }, null);

  return (
    <>
      {/* The team's own colours, so every team page is recognisable at a glance. */}
      <section
        className="text-white"
        style={{ background: `linear-gradient(120deg, ${darkTeamColor(team)} 0%, ${darkTeamColor(team)} 55%, #0b0d1a 100%)` }}
      >
        <div className="mx-auto max-w-4xl px-5 pb-10 pt-8 sm:px-8">
          <Link href={`/leagues/${team.leagueId}`} className="text-[14px] font-medium text-white/75 hover:text-white">
            ← All {league?.shortName ?? "league"} games
          </Link>
          <div className="mt-6 flex items-center gap-4">
            <span className="rounded-full bg-white p-1.5 shadow-lg">
              <TeamMark
                name={team.name}
                abbreviation={team.abbreviation}
                logoUrl={team.logoUrl}
                primary={team.primaryColor}
                secondary={team.secondaryColor}
                size={60}
              />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-white/70">{league?.name}</p>
              <h1 className="text-[30px] font-semibold leading-tight sm:text-[40px]">{team.name}</h1>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-[14px]">
            {venue && (
              <span className="rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">Home: {venue.name}</span>
            )}
            <span className="rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">
              {events.length} games left · {homeGames} at home
            </span>
            {cheapest && (
              <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-ink">
                Tickets from {formatPrice(cheapest.amount, cheapest.currency)}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <PriceCalendar games={events} />
        <h2 className="mt-10 text-[20px] font-bold first:mt-0">All games</h2>
        <p className="text-[16px] text-ink-2">
          Pick a game to compare ticket sites and see the whole trip.
        </p>
        <div className="mt-5">
          {events.length === 0 ? (
            <EmptyState
              title="No games coming up"
              description="This team has nothing on the calendar right now. Check back soon."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((context) => (
                <EventRow key={context.event.id} context={context} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
