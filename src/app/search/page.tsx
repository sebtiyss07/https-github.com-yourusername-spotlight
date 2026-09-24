import Link from "next/link";
import type { Metadata } from "next";
import { search } from "@/lib/repositories";
import { Badge, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Search" };

const KIND_TONE: Record<string, "accent" | "positive" | "warn" | "neutral"> = {
  sport: "accent",
  league: "positive",
  team: "warn",
  event: "neutral",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { hits, total, truncated } = await search(q);

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
        {q ? `Results for “${q}”` : "Search"}
      </h1>
      <p className="mt-2 text-[14px] text-ink-3">
        {q
          ? truncated
            ? `Showing ${hits.length} of ${total} matches across sports, leagues, teams, and events`
            : `${total} ${total === 1 ? "match" : "matches"} across sports, leagues, teams, and events`
          : "Search any sport, league, team, or event."}
      </p>

      <div className="mt-8">
        {q.length >= 2 && total === 0 ? (
          <EmptyState
            title="Nothing found"
            description={`No sport, league, team, or event matches “${q}”. Try a team name, a league, or a city.`}
          />
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {hits.map((hit) => (
              <Link
                key={`${hit.kind}-${hit.id}`}
                href={hit.href}
                className="flex items-center gap-4 border-b border-line px-5 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2/70"
              >
                <Badge tone={KIND_TONE[hit.kind]}>{hit.kind}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {hit.title}
                  </p>
                  <p className="truncate text-[12px] text-ink-3">
                    {hit.subtitle}
                  </p>
                </div>
                <span className="text-ink-3">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
