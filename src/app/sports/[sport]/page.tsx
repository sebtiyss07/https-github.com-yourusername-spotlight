import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getEventContexts,
  getLeaguesBySport,
  getMarqueeEventsBySport,
  getSport,
  getSports,
} from "@/lib/repositories";
import { GameCard } from "@/components/GameCard";
import { BackLink, EmptyState } from "@/components/ui";
import { SportIcon } from "@/components/SportIcon";

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
    description: `Every ${sport.name.toLowerCase()} league and big event — with the cheapest ticket, a flight and a hotel.`,
  };
}

export default async function SportPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport: sportId } = await params;
  const sport = await getSport(sportId);
  if (!sport) notFound();

  const [leagues, marquee] = await Promise.all([
    getLeaguesBySport(sport.id),
    getMarqueeEventsBySport(sport.id).then((e) => getEventContexts(e.slice(0, 3))),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <BackLink href="/">Home</BackLink>

      <div className="mt-8 flex items-center gap-4">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-xl"
          style={{
            color: sport.accent,
            background: `color-mix(in oklab, ${sport.accent} 13%, white)`,
          }}
        >
          <SportIcon sport={sport.id} size={28} />
        </span>
        <div>
          <h1 className="text-[30px] font-medium leading-tight sm:text-[38px]">
            {sport.name}
          </h1>
          <p className="text-[15px] text-ink-3">{sport.tagline}</p>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-[22px] font-medium">Choose a league</h2>
        {leagues.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="No leagues yet"
              description="We haven't added any leagues for this sport yet."
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/leagues/${league.id}`}
                className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{league.name}</p>
                  <p className="text-[13px] text-ink-3">{league.region}</p>
                </div>
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 transition-colors group-hover:bg-accent group-hover:text-white"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {marquee.length > 0 && (
        <section className="mt-14">
          <h2 className="text-[22px] font-medium">Big events</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {marquee.map((context) => (
              <GameCard key={context.event.id} context={context} race={context.event.sportId === "motorsport"} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
