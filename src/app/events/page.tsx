import type { Metadata } from "next";
import {
  getEventContexts,
  getMarqueeEvents,
  getSports,
} from "@/lib/repositories";
import { MarqueeCard } from "@/components/EventCard";
import { SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Championships & finals",
  description:
    "Every World Cup, final, major, and championship on the calendar — with the cheapest ticket and what the trip costs.",
};

export default async function EventsPage() {
  const [events, sports] = await Promise.all([
    getMarqueeEvents().then(getEventContexts),
    getSports(),
  ]);

  const accentBySport = new Map(sports.map((s) => [s.id, s.accent]));

  // Group by month so a year-long calendar stays readable.
  const groups = new Map<string, typeof events>();
  for (const context of events) {
    const key = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(context.event.startsAt));
    const bucket = groups.get(key) ?? [];
    bucket.push(context);
    groups.set(key, bucket);
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div className="wash" style={{ ["--wash-color" as string]: "#fbbf24" }} />
        <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
            Championships & finals
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            The events worth building a trip around. {events.length} on the
            calendar, sorted by date, priced all-in from wherever you are.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        {[...groups.entries()].map(([month, monthEvents]) => (
          <section key={month} className="mb-14 last:mb-0">
            <SectionHeading title={month} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {monthEvents.map((context) => (
                <MarqueeCard
                  key={context.event.id}
                  context={context}
                  accent={accentBySport.get(context.event.sportId) ?? "#3b82f6"}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
