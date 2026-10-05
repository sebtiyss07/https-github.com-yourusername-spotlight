import type { Metadata } from "next";
import { getEventContexts, getMarqueeEvents } from "@/lib/repositories";
import { GameCard } from "@/components/GameCard";
import { BackLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Big events",
  description:
    "Every final and championship coming up — with the cheapest ticket, a flight and a hotel.",
};

export default async function EventsPage() {
  const events = await getMarqueeEvents().then(getEventContexts);

  // Grouped by month (in each venue's own time zone) so a year-long calendar
  // stays easy to scan.
  const groups = new Map<string, typeof events>();
  for (const context of events) {
    const key = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: context.venue?.timeZone ?? "UTC",
    }).format(new Date(context.event.startsAt));
    const bucket = groups.get(key) ?? [];
    bucket.push(context);
    groups.set(key, bucket);
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <BackLink href="/">Home</BackLink>

      <h1 className="mt-8 text-[30px] font-semibold leading-tight sm:text-[38px]">
        Big events
      </h1>
      <p className="mt-2 text-[16px] text-ink-2">
        Finals, championships and Grand Prix weekends, soonest first, with the cheapest ticket on each.
      </p>

      {[...groups.entries()].map(([month, monthEvents]) => (
        <section key={month} className="mt-12">
          <h2 className="text-[20px] font-semibold">{month}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {monthEvents.map((context) => (
              <GameCard key={context.event.id} context={context} race={context.event.sportId === "motorsport"} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
