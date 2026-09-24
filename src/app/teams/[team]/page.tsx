import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getEventContexts,
  getEventsByTeam,
  getLeague,
  getSport,
  getTeam,
  getTeams,
  getVenue,
  countEventsByTeam,
} from "@/lib/repositories";
import { EventRow } from "@/components/EventCard";
import { Breadcrumbs, EmptyState, SectionHeading, Stat, TeamMark } from "@/components/ui";
import { formatCompactNumber } from "@/lib/format";

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
    description: `Every upcoming ${team.name} fixture, with the cheapest ticket across all marketplaces and how to get to ${team.city}.`,
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

  const [league, sport, venue, events, counts] = await Promise.all([
    getLeague(team.leagueId),
    getSport(team.sportId),
    getVenue(team.venueId),
    getEventsByTeam(team.id, 30).then(getEventContexts),
    // `events` is capped at 30 for display; these are the real figures.
    countEventsByTeam(team.id),
  ]);

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="wash"
          style={{ ["--wash-color" as string]: team.primaryColor }}
        />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <Breadcrumbs
            items={[
              { label: "Sports", href: "/" },
              { label: sport?.name ?? "Sport", href: `/sports/${team.sportId}` },
              { label: league?.name ?? "League", href: `/leagues/${team.leagueId}` },
              { label: team.name },
            ]}
          />

          <div className="flex items-center gap-4">
            <TeamMark
              name={team.name}
              abbreviation={team.abbreviation}
              logoUrl={team.logoUrl}
              primary={team.primaryColor}
              secondary={team.secondaryColor}
              size={64}
            />
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                {team.name}
              </h1>
              <p className="mt-1.5 text-[14px] text-ink-2">
                {team.city} · Founded {team.founded}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-8 border-t border-line pt-7 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Home venue"
              value={
                <span className="text-[15px]">{venue?.name ?? "Unknown"}</span>
              }
              hint={venue ? `Opened ${venue.opened}` : undefined}
            />
            <Stat
              label="Capacity"
              value={venue ? formatCompactNumber(venue.capacity) : "—"}
            />
            <Stat label="Titles" value={team.titles} hint="top-flight championships" />
            <Stat
              label="Upcoming"
              value={counts.total}
              hint={`${counts.home} home · ${counts.away} away`}
            />
          </div>

          {venue && (
            <p className="mt-6 text-[13px] text-ink-3">
              Nearest airport:{" "}
              <span className="font-semibold text-ink-2">{venue.nearestAirport}</span>
              {" · "}
              Flights and stays are priced against this venue on every fixture page.
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <section>
          <SectionHeading
            eyebrow="Schedule"
            title={
              counts.total > events.length
                ? `Next ${events.length} of ${counts.total} fixtures`
                : "Every upcoming fixture"
            }
            action={
              league && (
                <Link
                  href={`/leagues/${league.id}`}
                  className="text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
                >
                  Full {league.shortName} schedule →
                </Link>
              )
            }
          />
          {events.length === 0 ? (
            <EmptyState
              title="No fixtures scheduled"
              description="This team has no upcoming events in the current seed window."
            />
          ) : (
            <div className="divide-y divide-line border-y border-line">
              {events.map((context) => (
                <EventRow key={context.event.id} context={context} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
