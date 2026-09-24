import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getEventContexts,
  getEventsByLeague,
  getLeague,
  getLeagues,
  getSport,
  getTeamsByLeague,
  getVenue,
} from "@/lib/repositories";
import { EventRow } from "@/components/EventCard";
import {
  Badge,
  Breadcrumbs,
  EmptyState,
  SectionHeading,
  Stat,
  TeamMark,
} from "@/components/ui";
import { formatCompactNumber } from "@/lib/format";

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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: leagueId } = await params;
  const league = await getLeague(leagueId);
  if (!league) notFound();

  const [sport, teams, events] = await Promise.all([
    getSport(league.sportId),
    getTeamsByLeague(league.id),
    getEventsByLeague(league.id, 40).then(getEventContexts),
  ]);

  // Home venues, for the capacity stat and the team cards.
  const venues = await Promise.all(teams.map((t) => getVenue(t.venueId)));

  // Dedupe before summing: the Rams and Chargers share SoFi, the Giants and
  // Jets share MetLife, so a per-team sum overstates the NFL by ~153,000 seats.
  const uniqueVenues = new Map(
    venues.filter((v): v is NonNullable<typeof v> => v !== null).map((v) => [v.id, v]),
  );
  const totalCapacity = [...uniqueVenues.values()].reduce(
    (sum, v) => sum + v.capacity,
    0,
  );
  const sharedVenueCount = venues.length - uniqueVenues.size;

  const accent = sport?.accent ?? "#3b82f6";
  const [seasonStart, seasonEnd] = league.seasonMonths;

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div className="wash" style={{ ["--wash-color" as string]: accent }} />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <Breadcrumbs
            items={[
              { label: "Sports", href: "/" },
              { label: sport?.name ?? "Sport", href: `/sports/${league.sportId}` },
              { label: league.name },
            ]}
          />

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              {league.name}
            </h1>
            {league.hasDepth && <Badge tone="positive">Full data</Badge>}
          </div>

          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            {league.description}
          </p>

          <div className="mt-10 grid gap-8 border-t border-line pt-7 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Founded" value={league.founded} />
            <Stat
              label="Teams"
              value={league.teamCount || "—"}
              hint={teams.length > 0 ? `${teams.length} seeded` : "Roster not seeded"}
            />
            <Stat
              label="Season"
              value={`${MONTHS[seasonStart - 1]} – ${MONTHS[seasonEnd - 1]}`}
            />
            <Stat
              label="Total capacity"
              value={totalCapacity > 0 ? formatCompactNumber(totalCapacity) : "—"}
              hint={
                totalCapacity > 0
                  ? sharedVenueCount > 0
                    ? `across ${uniqueVenues.size} venues (${sharedVenueCount} shared)`
                    : `across ${uniqueVenues.size} home venues`
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <section>
          <SectionHeading
            eyebrow="Clubs"
            title={teams.length > 0 ? `All ${teams.length} teams` : "Teams"}
          />

          {teams.length === 0 ? (
            <EmptyState
              title="Roster not seeded yet"
              description="This competition's teams haven't been populated. Its major events are still listed below, and the fixture list will fill in once a data provider is connected."
            />
          ) : (
            <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teams.map((team, i) => {
                const venue = venues[i];
                return (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    className="group -mx-3 flex items-center gap-3.5 rounded-lg px-3 py-3 transition-colors hover:bg-surface-2"
                  >
                    <TeamMark
                      name={team.name}
                      abbreviation={team.abbreviation}
                      logoUrl={team.logoUrl}
                      primary={team.primaryColor}
                      secondary={team.secondaryColor}
                      size={38}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">
                        {team.name}
                      </p>
                      <p className="truncate text-[12px] text-ink-3">
                        {venue ? venue.name : team.city}
                      </p>
                    </div>
                    {team.titles > 0 && (
                      <span className="tabular shrink-0 text-[12px] font-semibold text-ink-3">
                        {team.titles}×
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-16">
          <SectionHeading
            eyebrow="Fixtures"
            title="Upcoming schedule"
            action={
              <span className="text-[12px] text-ink-3">
                Prices are lowest all-in totals
              </span>
            }
          />
          {events.length === 0 ? (
            <EmptyState
              title="No fixtures scheduled"
              description="Nothing upcoming is seeded for this competition."
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
