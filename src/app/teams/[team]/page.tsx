import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  countEventsByTeam,
  getEventContexts,
  getEventsByTeam,
  getLeague,
  getTeam,
  getTeams,
} from "@/lib/repositories";
import { EventRow } from "@/components/EventCard";
import { BackLink, EmptyState, StepLabel, TeamMark } from "@/components/ui";

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

  const [league, events, counts] = await Promise.all([
    getLeague(team.leagueId),
    getEventsByTeam(team.id, 30).then(getEventContexts),
    // `events` is capped for display; this is the real total.
    countEventsByTeam(team.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <BackLink href={`/leagues/${team.leagueId}`}>
        All {league?.shortName ?? "league"} games
      </BackLink>

      <div className="mt-8 flex items-center gap-4">
        <TeamMark
          name={team.name}
          abbreviation={team.abbreviation}
          logoUrl={team.logoUrl}
          primary={team.primaryColor}
          secondary={team.secondaryColor}
          size={56}
        />
        <div>
          <StepLabel step={2} />
          <h1 className="mt-1 text-[30px] font-semibold leading-tight sm:text-[38px]">
            {team.name}
          </h1>
        </div>
      </div>
      <p className="mt-4 text-[16px] text-ink-2">
        Pick a game to see the ticket, flight and hotel prices.
      </p>

      <div className="mt-8">
        {events.length === 0 ? (
          <EmptyState
            title="No games coming up"
            description="This team has nothing on the calendar right now. Check back soon."
          />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {events.map((context) => (
                <EventRow key={context.event.id} context={context} />
              ))}
            </div>
            <p className="mt-6 text-[14px] text-ink-3">
              Showing {events.length} of {counts.total} games
            </p>
          </>
        )}
      </div>
    </div>
  );
}
