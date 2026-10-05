import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getEventContexts,
  getEventsByTeam,
  getLeague,
  getTeam,
  getTeams,
  getVenue,
} from "@/lib/repositories";
import { EventRow } from "@/components/EventCard";
import { EmptyState, TeamMark } from "@/components/ui";
import { formatPrice } from "@/lib/format";
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
    const p = c.prices.cheapest?.amount;
    return p != null && (!best || p < best.amount) ? { amount: p, currency: c.prices.currency } : best;
  }, null);

  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto max-w-4xl px-5 pb-10 pt-8 sm:px-8">
          <Link href={`/leagues/${team.leagueId}`} className="text-[14px] text-ink-3 hover:text-ink">
            ← All {league?.shortName ?? "league"} games
          </Link>
          <div className="mt-8 flex items-center gap-4">
            <TeamMark
              name={team.name}
              abbreviation={team.abbreviation}
              logoUrl={team.logoUrl}
              primary={team.primaryColor}
              secondary={team.secondaryColor}
              size={56}
            />
            <div className="min-w-0">
              <p className="text-[13px] text-ink-3">{league?.name}</p>
              <h1 className="text-[30px] font-medium leading-tight tracking-[-0.035em] text-ink sm:text-[40px]">{team.name}</h1>
            </div>
          </div>
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-ink-3">
            {venue && <span>Home: {venue.name}</span>}
            <span>
              {events.length} games left · {homeGames} at home
            </span>
            {cheapest && (
              <span>
                Tickets from <span className="text-positive">{formatPrice(cheapest.amount, cheapest.currency)}</span>
              </span>
            )}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
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
