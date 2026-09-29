import Link from "next/link";
import type { ReactNode } from "react";
import {
  getEventContexts,
  getEventsByLeague,
  getLeaguePhoto,
  type EventContext,
} from "@/lib/repositories";
import { PhotoCredit } from "@/components/ui";
import { dateParts, formatPrice, formatTime } from "@/lib/format";

/**
 * Home: one clear path, top to bottom.
 * 1. Pick a competition (with its lowest real price).
 * 2. How it works, in three steps.
 * 3. The cheapest matches coming up soon.
 * 4. The next F1 races.
 */
export default async function HomePage() {
  const [matches, ucl, uel, races, nfl, nba, mls, photo] = await Promise.all([
    getEventsByLeague("premier-league").then(getEventContexts),
    getEventsByLeague("champions-league").then(getEventContexts),
    getEventsByLeague("europa-league").then(getEventContexts),
    getEventsByLeague("formula-1").then(getEventContexts),
    getEventsByLeague("nfl").then(getEventContexts),
    getEventsByLeague("nba").then(getEventContexts),
    getEventsByLeague("mls").then(getEventContexts),
    getLeaguePhoto("premier-league"),
  ]);

  const lowest = (list: EventContext[]) =>
    list.reduce<number | null>((min, c) => {
      const p = c.prices.cheapest?.amount;
      return p != null && (min === null || p < min) ? p : min;
    }, null);

  // The cheapest priced matches in the next 30 days.
  const soon = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const deals = matches
    .filter((c) => c.prices.cheapest && new Date(c.event.startsAt).getTime() < soon)
    .sort((a, b) => a.prices.cheapest!.amount! - b.prices.cheapest!.amount!)
    .slice(0, 6);

  const currency = matches[0]?.prices.currency ?? "USD";
  const plFrom = lowest(matches);
  const uclFrom = lowest(ucl);
  const uelFrom = lowest(uel);
  const f1From = lowest(races);

  return (
    <>
      {/* 1. Pick a competition */}
      <section className="relative overflow-hidden bg-[#0b0d1a] text-white">
        {photo?.large && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.large} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0b0d1a]/80 via-[#0b0d1a]/70 to-[#0b0d1a]" />
            <PhotoCredit photo={photo} className="absolute right-4 top-4 z-10" />
          </>
        )}
        <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-16 text-center sm:px-8 sm:pt-24">
          <h1 className="mx-auto max-w-3xl text-[38px] font-semibold leading-[1.05] sm:text-[56px]">
            See the game for less.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/80">
            The cheapest ticket, flight and hotel for every match. All in one place.
          </p>

          <div className="mx-auto mt-10 grid max-w-3xl gap-4 text-left sm:grid-cols-2">
            <ChoiceCard
              href="/leagues/premier-league"
              title="Premier League"
              detail={`${matches.length} matches left this season`}
              price={plFrom !== null ? `Tickets from ${formatPrice(plFrom, currency)}` : null}
            />
            <ChoiceCard
              href="/leagues/champions-league"
              title="Champions League"
              detail={`${ucl.length} matches left this season`}
              price={uclFrom !== null ? `Tickets from ${formatPrice(uclFrom, currency)}` : null}
            />
            <ChoiceCard
              href="/leagues/europa-league"
              title="Europa League"
              detail={`${uel.length} matches left this season`}
              price={uelFrom !== null ? `Tickets from ${formatPrice(uelFrom, currency)}` : null}
            />
            <ChoiceCard
              href="/leagues/formula-1"
              title="Formula 1"
              detail={`${races.length} races left this season`}
              price={f1From !== null ? `Weekend passes from ${formatPrice(f1From, currency)}` : null}
            />
            {[
              { id: "nfl", title: "NFL", list: nfl },
              { id: "nba", title: "NBA", list: nba },
              { id: "mls", title: "MLS", list: mls },
            ].map(({ id, title, list }) => {
              const from = lowest(list);
              return (
                <ChoiceCard
                  key={id}
                  href={`/leagues/${id}`}
                  title={title}
                  detail={`${list.length} games left this season`}
                  price={from !== null ? `Tickets from ${formatPrice(from, currency)}` : null}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. How it works */}
      <section className="border-b border-line bg-surface">
        <ol className="mx-auto grid max-w-5xl gap-6 px-5 py-10 sm:grid-cols-3 sm:px-8">
          <Step n={1} title="Pick a match or race">
            Filter by team, month or budget.
          </Step>
          <Step n={2} title="Compare ticket sites">
            Every site that sells it, cheapest first.
          </Step>
          <Step n={3} title="See the whole trip">
            Ticket, flight and hotel added up for you.
          </Step>
        </ol>
      </section>

      {/* 3. Cheapest matches soon */}
      {deals.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <Heading
            eyebrow="Premier League"
            title="Cheapest matches in the next 30 days"
            href="/leagues/premier-league"
            link="All matches →"
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((c) => (
              <EventCard key={c.event.id} context={c} />
            ))}
          </div>
        </section>
      )}

      {/* 4. Next F1 races */}
      {races.length > 0 && (
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <Heading
              eyebrow="Formula 1"
              title="Next race weekends"
              href="/leagues/formula-1"
              link="All races →"
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {races.slice(0, 3).map((c) => (
                <EventCard key={c.event.id} context={c} race />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function ChoiceCard({
  href,
  title,
  detail,
  price,
}: {
  href: string;
  title: string;
  detail: string;
  price: string | null;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl bg-white p-5 text-ink shadow-lg transition-transform hover:-translate-y-1"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[22px] font-semibold">{title}</span>
        <span className="block text-[14px] text-ink-3">{detail}</span>
        {price && (
          <span className="mt-2 inline-block rounded-full bg-positive/10 px-2.5 py-0.5 text-[13px] font-semibold text-positive">
            {price}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white transition-colors group-hover:bg-accent"
      >
        →
      </span>
    </Link>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-semibold text-white">
        {n}
      </span>
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[14px] text-ink-3">{children}</span>
      </span>
    </li>
  );
}

function Heading({
  eyebrow,
  title,
  href,
  link,
}: {
  eyebrow: string;
  title: string;
  href: string;
  link: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[13px] font-semibold text-accent">{eyebrow}</p>
        <h2 className="mt-1 text-[24px] font-semibold sm:text-[28px]">{title}</h2>
      </div>
      <Link href={href} className="text-[14px] font-semibold text-accent hover:underline">
        {link}
      </Link>
    </div>
  );
}

/** A match or race as a photo card with its cheapest real price. */
function EventCard({ context, race }: { context: EventContext; race?: boolean }) {
  const { event, venue, title, prices, photo } = context;
  const zone = venue?.timeZone ?? "UTC";
  const { weekday, day, month } = dateParts(event.startsAt, zone);
  const sites = prices.offers.filter((o) => o.amount !== null).length;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative h-36 overflow-hidden bg-[#0b0d1a]">
        {photo?.small &&
          (race ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.small}
              alt=""
              className="absolute inset-0 m-auto h-[80%] opacity-60 [filter:brightness(0)_invert(1)]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.small}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ))}
        <span className="absolute left-3 top-3 rounded-lg bg-white px-2 py-1 text-center text-[11px] font-semibold uppercase leading-tight text-ink shadow">
          {weekday} {day} {month}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[16px] font-semibold leading-snug group-hover:text-accent">{title}</p>
        <p className="mt-0.5 truncate text-[13px] text-ink-3">
          {race ? venue?.city : `${formatTime(event.startsAt, zone)} · ${venue?.name ?? ""}`}
        </p>
        <div className="mt-auto flex items-end justify-between pt-4">
          {prices.cheapest ? (
            <p>
              <span className="block text-[12px] text-ink-3">
                {race ? "Weekend pass from" : "Tickets from"}
              </span>
              <span className="tabular text-[20px] font-semibold text-positive">
                {formatPrice(prices.cheapest.amount!, prices.currency)}
              </span>
              {sites > 1 && (
                <span className="text-[12px] text-ink-3"> · cheapest of {sites} sites</span>
              )}
            </p>
          ) : (
            <p className="text-[13px] text-ink-3">See official tickets</p>
          )}
          <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold transition-colors group-hover:bg-accent group-hover:text-white">
            Compare →
          </span>
        </div>
      </div>
    </Link>
  );
}
