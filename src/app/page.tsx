import Link from "next/link";
import {
  getEventContexts,
  getLeaguesBySport,
  getMarqueeEvents,
  getSports,
  getUpcomingEvents,
} from "@/lib/repositories";
import { EventRow, MarqueeCard } from "@/components/EventCard";
import { SportIcon } from "@/components/SportIcon";
import { MARKETPLACE_COUNT } from "@/lib/providers/tickets/seeded";
import { formatFans } from "@/lib/format";

export default async function HomePage() {
  const sports = await getSports();

  const [marquee, soon] = await Promise.all([
    getMarqueeEvents(6).then(getEventContexts),
    getUpcomingEvents(10).then(getEventContexts),
  ]);

  const leagueCounts = await Promise.all(
    sports.map(async (sport) => ({
      sportId: sport.id,
      count: (await getLeaguesBySport(sport.id)).length,
    })),
  );
  const countBySport = new Map(leagueCounts.map((l) => [l.sportId, l.count]));

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="wash" style={{ ["--wash-color" as string]: "#2563eb" }} />

        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-20 sm:px-8 sm:pb-24 sm:pt-28">
          <h1 className="max-w-3xl text-[2.75rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
            Every game.
            <br />
            Every ticket.
            <br />
            <span className="text-ink-3">Every route there.</span>
          </h1>

          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Stop opening eight tabs. Pick a sport, find the match, and see the
            cheapest seat across every marketplace — with the flight and the bed
            priced in, from wherever you are.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="#sports"
              className="rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-surface transition-opacity hover:opacity-90"
            >
              Browse sports
            </Link>
            <Link
              href="/events"
              className="rounded-full px-6 py-3 text-[14px] font-semibold text-ink transition-colors hover:bg-surface-2"
            >
              Upcoming championships →
            </Link>
          </div>

          <p className="mt-10 text-[13px] text-ink-3">
            Comparing {MARKETPLACE_COUNT} ticket marketplaces, flights, rail and
            stays
          </p>
        </div>
      </section>

      {/* Sports. A plain grid — no card chrome; the icons and type carry it. */}
      <section
        id="sports"
        className="scroll-mt-20 border-t border-line bg-surface"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <h2 className="text-[26px] font-bold tracking-[-0.02em]">
              The ten biggest sports on earth
            </h2>
            <span className="hidden shrink-0 text-[13px] text-ink-3 sm:block">
              Sorted by global following
            </span>
          </div>

          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {sports.map((sport) => (
              <Link
                key={sport.id}
                href={`/sports/${sport.id}`}
                className="group -mx-3 rounded-xl px-3 py-4 transition-colors hover:bg-surface-2"
              >
                <span
                  className="inline-flex transition-transform duration-200 group-hover:-translate-y-0.5"
                  style={{ color: sport.accent }}
                >
                  <SportIcon sport={sport.id} size={26} />
                </span>

                <h3 className="mt-3 text-[15px] font-semibold tracking-tight">
                  {sport.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-3">
                  {sport.tagline}
                </p>
                <p className="mt-3 text-[12px] text-ink-3">
                  {countBySport.get(sport.id) ?? 0} leagues ·{" "}
                  {formatFans(sport.globalFans)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Championships. One hairline grid rather than six floating cards. */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <h2 className="text-[26px] font-bold tracking-[-0.02em]">
              Worth booking a flight for
            </h2>
            <Link
              href="/events"
              className="shrink-0 text-[13px] font-medium text-accent hover:underline"
            >
              See all →
            </Link>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {marquee.map((context) => (
              <MarqueeCard
                key={context.event.id}
                context={context}
                accent={context.sport?.accent ?? "#2563eb"}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Next up */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <h2 className="text-[26px] font-bold tracking-[-0.02em]">
              Happening soon
            </h2>
            <span className="hidden shrink-0 text-[13px] text-ink-3 sm:block">
              Lowest all-in price per ticket
            </span>
          </div>

          <div className="divide-y divide-line border-y border-line">
            {soon.map((context) => (
              <EventRow key={context.event.id} context={context} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="max-w-2xl text-[26px] font-bold tracking-[-0.02em]">
            The whole trip, not just the ticket
          </h2>

          <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              {
                title: "Every marketplace at once",
                body: "The same seat is listed at seven different totals once fees land. We show the total, sorted, so the cheapest is genuinely the cheapest.",
              },
              {
                title: "Priced from where you are",
                body: "Type any city on earth. Flights, rail and coach are quoted against the venue's nearest airport and filtered to land before kick-off.",
              },
              {
                title: "Ranked by walk, not ad spend",
                body: "Stays are ranked by what a night really costs — the room plus getting to the ground and back, on a night when 78,000 people leave at once.",
              },
            ].map((step, i) => (
              <div key={step.title} className="border-t border-ink pt-5">
                <span className="tabular text-[12px] font-semibold text-ink-3">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-[16px] font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
