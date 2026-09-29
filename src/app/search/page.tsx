import Link from "next/link";
import type { Metadata } from "next";
import { search } from "@/lib/repositories";
import { BackLink, Badge, EmptyState } from "@/components/ui";

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
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
            {hits.map((hit) => (
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
      </div>
    </div>
  );
}
