import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getEventContexts,
  getEventsBySport,
  getLeaguesBySport,
  getMarqueeEventsBySport,
  getSport,
  getSports,
  countEventsBySport,
} from "@/lib/repositories";
import { EventRow, MarqueeCard } from "@/components/EventCard";
import { Badge, Breadcrumbs, EmptyState, SectionHeading } from "@/components/ui";
import { SportIcon } from "@/components/SportIcon";
import { formatCompactNumber, formatFans } from "@/lib/format";

export async function generateStaticParams() {
  const sports = await getSports();
  return sports.map((s) => ({ sport: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>;
}): Promise<Metadata> {
  const { sport: sportId } = await params;
  const sport = await getSport(sportId);
  if (!sport) return {};
  return {
    title: sport.name,
    description: `${sport.tagline} Every ${sport.name.toLowerCase()} league, team, and event — with the cheapest ticket and how to get there.`,
  };
}

const TIER_LABEL: Record<string, string> = {
  domestic: "Domestic league",
  continental: "Continental",
  international: "International",
  tour: "Tour",
};

export default async function SportPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport: sportId } = await params;
  const sport = await getSport(sportId);
  if (!sport) notFound();

  const [leagues, marquee, upcoming, eventCount] = await Promise.all([
    getLeaguesBySport(sport.id),
    getMarqueeEventsBySport(sport.id).then((e) => getEventContexts(e.slice(0, 3))),
    getEventsBySport(sport.id, 15).then(getEventContexts),
    // The true total. `upcoming` is a capped slice for display, so its length
    // would report the limit rather than the count.
    countEventsBySport(sport.id),
  ]);

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div className="wash" style={{ ["--wash-color" as string]: sport.accent }} />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <Breadcrumbs items={[{ label: "Sports", href: "/" }, { label: sport.name }]} />

          <div className="flex items-start gap-4">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-surface shadow-sm ring-1 ring-line sm:h-20 sm:w-20"
              style={{ color: sport.accent }}
            >
              <SportIcon sport={sport.id} size={38} />
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                {sport.name}
              </h1>
              <p className="mt-2 max-w-2xl text-[15px] text-ink-2">
                {sport.tagline}
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-2 text-[12px]">
            <Badge tone="neutral">{formatFans(sport.globalFans)}</Badge>
            <Badge tone="neutral">{leagues.length} competitions</Badge>
            <Badge tone="neutral">
              {formatCompactNumber(eventCount)} upcoming{" "}
              {eventCount === 1 ? "event" : "events"}
            </Badge>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        {marquee.length > 0 && (
          <section className="mb-16">
            <SectionHeading
              eyebrow="The big ones"
              title={`Major ${sport.name.toLowerCase()} events`}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {marquee.map((context) => (
                <MarqueeCard
                  key={context.event.id}
                  context={context}
                  accent={sport.accent}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeading eyebrow="Competitions" title="Leagues & tours" />

          {leagues.length === 0 ? (
            <EmptyState
              title="No competitions seeded yet"
              description="This sport's league catalogue hasn't been populated."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {leagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.id}`}
                  className="group rounded-2xl border border-line bg-surface p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-line-bright hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold tracking-tight">
                        {league.name}
                      </h3>
                      <p className="mt-0.5 text-[12px] text-ink-3">
                        {TIER_LABEL[league.tier]} · {league.region}
                      </p>
                    </div>
                    {league.hasDepth && <Badge tone="positive">Full data</Badge>}
                  </div>

                  <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-2">
                    {league.description}
                  </p>

                  <div className="mt-4 flex items-center gap-4 text-[11.5px] text-ink-3">
                    <span>Est. {league.founded}</span>
                    {league.teamCount > 0 && <span>{league.teamCount} teams</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-16">
          <SectionHeading
            eyebrow="Calendar"
            title="Next fixtures"
            action={
              eventCount > upcoming.length ? (
                <span className="text-[12px] text-ink-3">
                  showing {upcoming.length} of {formatCompactNumber(eventCount)}
                </span>
              ) : undefined
            }
          />
          {upcoming.length === 0 ? (
            <EmptyState
              title="Nothing scheduled"
              description="No upcoming events are seeded for this sport yet."
            />
          ) : (
            <div className="divide-y divide-line border-y border-line">
              {upcoming.map((context) => (
                <EventRow key={context.event.id} context={context} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
