import Link from "next/link";
import type { Metadata } from "next";
import { getEvent, getEventContexts, search } from "@/lib/repositories";
import type { SportEvent } from "@/lib/domain/types";
import { BackLink, Badge, EmptyState } from "@/components/ui";
import { EventRow } from "@/components/EventCard";

export const metadata: Metadata = { title: "Search" };

const KIND_LABEL: Record<string, string> = {
  sport: "Sport",
  league: "League",
  team: "Team",
  event: "Game",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { hits, total, truncated } = await search(q);
  // Teams and leagues as plain links; games as full rows with date and price.
  const places = hits.filter((h) => h.kind !== "event");
  const events = (await Promise.all(hits.filter((h) => h.kind === "event").map((h) => getEvent(h.id)))).filter(
    (e): e is SportEvent => e !== null,
  );
  const games = await getEventContexts(events);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <BackLink href="/">Home</BackLink>

      <h1 className="mt-8 text-[30px] font-semibold leading-tight sm:text-[36px]">
        {q ? `Results for “${q}”` : "Search"}
      </h1>
      <p className="mt-2 text-[15px] text-ink-3">
        {q
          ? truncated
            ? `Showing the first ${hits.length} of ${total} results`
            : `${total} ${total === 1 ? "result" : "results"}`
          : "Search for a team, league or city using the box at the top."}
      </p>

      <div className="mt-8">
        {q.length >= 2 && total === 0 ? (
          <EmptyState
            title="Nothing found"
            description={`Nothing matches “${q}”. Try a team like “Bears”, a league like “NBA”, or a city like “Chicago”.`}
          />
        ) : (
          <div className="space-y-8">
          {places.length > 0 && (
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
            {places.map((hit) => (
              <Link
                key={`${hit.kind}-${hit.id}`}
                href={hit.href}
                className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2"
              >
                <Badge tone={hit.kind === "event" ? "accent" : "neutral"}>
                  {KIND_LABEL[hit.kind]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{hit.title}</p>
                  <p className="truncate text-[13px] text-ink-3">{hit.subtitle}</p>
                </div>
                <span
                  aria-hidden
                  className="text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
          )}
          {games.length > 0 && (
            <section>
              <h2 className="text-[18px] font-semibold">Games, soonest first</h2>
              <div className="mt-3 space-y-2.5">
                {games.map((c) => (
                  <EventRow key={c.event.id} context={c} />
                ))}
              </div>
            </section>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
