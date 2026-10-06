import type { ReactNode } from "react";
import { CityInput } from "@/components/CityInput";

/** One choice card: a hotel or a flight that can be swapped into the trip. */
export interface Choice {
  /** "cheapest", "best-rated", "closest", "nonstop", "other-airline". */
  tags: string[];
  title: string;
  facts: string[];
  price: number;
  priceNote: string;
  freeCancellation?: boolean;
  selected: boolean;
  chooseHref: string;
  bookUrl: string;
  bookLabel: string;
}

export interface TravelLinkLite {
  site: string;
  url: string;
}

type Mode = "flight" | "train" | "coach" | "drive" | "none";

const TAG_LABEL: Record<string, string> = {
  cheapest: "💰 Cheapest",
  "best-rated": "⭐ Best reviewed",
  closest: "📍 Closest",
  nonstop: "✈️ Nonstop",
  "other-airline": "Other airline",
};

const MODE_LABEL: Record<Mode, string> = {
  flight: "Flight",
  train: "Train",
  coach: "Coach",
  drive: "Drive",
  none: "No travel needed",
};

/**
 * The whole trip as three plain steps: ticket, hotel, getting there, then
 * one total. Every choice is a link (the trip lives in the URL), so it works
 * without JavaScript and a built trip can be shared.
 */
export function TripSteps({
  money,
  hidden,
  origin,
  originUnresolved,
  travellers,
  nights,
  modes,
  go,
  sameCity,
  ticket,
  ticketChoices,
  compare,
  hotel,
  travel,
  total,
}: {
  money: (n: number) => string;
  /** Settings to keep when the form is submitted. */
  hidden: Record<string, string>;
  origin: string;
  originUnresolved: boolean;
  travellers: number;
  nights: number;
  /** Ways of getting there that make sense from this city. */
  modes: Mode[];
  go: Mode;
  sameCity: boolean;
  ticket: { price: number; site: string; url: string; feesExtra: boolean; sites: number; noun: string } | null;
  /** The cheapest few ticket sites, as cards (price per ticket). */
  ticketChoices: Choice[];
  /** Every ticket site, shown on request. */
  compare: ReactNode;
  hotel: {
    wanted: boolean;
    choices: Choice[];
    links: TravelLinkLite[];
    toggleHref: string;
    note?: string;
  };
  travel: {
    choices: Choice[];
    links: TravelLinkLite[];
    toggleHref: string;
    needsOrigin: boolean;
    /** No exact-date fare: the nearest real one, with its own dates (per person). */
    nearby?: { perPerson: number; departOn: string; returnOn: string; airline: string; stopsLabel: string; url: string } | null;
  };
  total: { amount: number; parts: string[]; missing: string[]; feesExtra: boolean };
}) {
  const people = `${travellers} ${travellers === 1 ? "person" : "people"}`;
  const hotelPicked = hotel.choices.find((c) => c.selected);
  const flightPicked = travel.choices.find((c) => c.selected);

  return (
    <section id="trip" className="mt-8 scroll-mt-32">
      <h2 className="text-[26px] font-extrabold sm:text-[30px]">Book your trip in 3 steps</h2>
      <p className="mt-1 text-ink-2">Pick each part, see one total, then book each part on the site that sells it.</p>

      {/* Settings: one row */}
      <form method="get" action="#trip" className="mt-5 grid gap-2 rounded-2xl border border-line bg-surface p-3 shadow-xs sm:grid-cols-[2fr_1fr_1fr_auto]">
        {Object.entries(hidden)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        <label className="block rounded-xl bg-surface-2 px-4 py-2">
          <span className="block text-[12px] font-semibold text-ink-3">Travelling from</span>
          <CityInput
            name="origin"
            defaultValue={origin}
            placeholder="Pick your city ▾"
            submitOnPick
            inputClassName="w-full bg-transparent text-[16px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-3"
          />
        </label>
        <label className="block rounded-xl bg-surface-2 px-4 py-2">
          <span className="block text-[12px] font-semibold text-ink-3">People</span>
          <select name="travellers" defaultValue={travellers} className="w-full cursor-pointer bg-transparent text-[16px] font-semibold text-ink outline-none">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "person" : "people"}
              </option>
            ))}
          </select>
        </label>
        <label className="block rounded-xl bg-surface-2 px-4 py-2">
          <span className="block text-[12px] font-semibold text-ink-3">Nights</span>
          <select name="nights" defaultValue={nights} className="w-full cursor-pointer bg-transparent text-[16px] font-semibold text-ink outline-none">
            {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "night" : "nights"}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-xl bg-accent px-6 py-3 text-[16px] font-bold text-white hover:bg-accent-2">
          Update
        </button>
        {originUnresolved && (
          <p className="text-[14px] font-semibold text-hot sm:col-span-4">
            We couldn&apos;t find &ldquo;{origin}&rdquo;. Pick a city from the list.
          </p>
        )}
      </form>

      <ol className="mt-5 flex flex-col gap-4">
        {/* 1. Ticket */}
        <Step n={1} title={`Your ${ticket?.noun ?? "ticket"}${travellers > 1 ? `s × ${travellers}` : ""}`} price={ticket ? money(ticket.price * travellers) : null} money={money}>
          {ticketChoices.length ? (
            <ChoiceCards choices={ticketChoices} money={money} selectable={false} />
          ) : (
            <p className="text-[15px] text-ink-2">No ticket site has a price yet. See each site below.</p>
          )}
          <details className="group mt-3">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[14px] font-semibold text-ink-2 hover:border-accent hover:text-accent">
              <span className="group-open:hidden">Compare all {ticket?.sites ?? ""} ticket sites ▾</span>
              <span className="hidden group-open:inline">Hide the full list ▴</span>
            </summary>
            <div className="mt-3">{compare}</div>
          </details>
        </Step>

        {/* 2. Hotel */}
        <Step
          n={2}
          title={`Your hotel · ${nights} ${nights === 1 ? "night" : "nights"}`}
          price={hotel.wanted ? (hotelPicked ? money(hotelPicked.price) : null) : "Not needed"}
          money={money}
        >
          {!hotel.wanted ? (
            <p className="text-[15px] text-ink-2">
              No hotel in this trip.{" "}
              <a href={hotel.toggleHref} className="font-semibold text-accent hover:underline">
                Add a hotel
              </a>
            </p>
          ) : hotel.choices.length ? (
            <>
              <ChoiceCards choices={hotel.choices} money={money} />
              {hotel.note && <p className="mt-2 text-[13px] text-ink-3">{hotel.note}</p>}
            </>
          ) : (
            <LinkRow intro="See hotel prices near the venue for your dates:" links={hotel.links} />
          )}
          {hotel.wanted && (
            <a href={hotel.toggleHref} className="mt-3 inline-block text-[13px] font-semibold text-ink-3 hover:text-accent">
              I don&apos;t need a hotel
            </a>
          )}
        </Step>

        {/* 3. Getting there */}
        <Step
          n={3}
          title={go === "none" ? "Getting there" : go === "flight" ? "Your flight" : `Your ${MODE_LABEL[go].toLowerCase()}`}
          price={go === "none" ? (sameCity ? "You're local" : "Not needed") : flightPicked ? money(flightPicked.price * travellers) : null}
          money={money}
        >
          {go === "none" ? (
            <p className="text-[15px] text-ink-2">
              {sameCity ? "You're coming from the same city, so no travel is added." : "No travel in this trip."}{" "}
              <a href={travel.toggleHref} className="font-semibold text-accent hover:underline">
                Add travel
              </a>
            </p>
          ) : travel.needsOrigin ? (
            <p className="text-[15px] text-ink-2">
              <span className="font-semibold text-ink">Pick your city above</span> and we&apos;ll show the cheapest fare for these exact dates.
            </p>
          ) : travel.choices.length ? (
            <ChoiceCards choices={travel.choices} money={money} />
          ) : travel.nearby ? (
            <div>
              <div className="flex flex-col gap-3 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-ink-3">Nearest fare we found</p>
                  <p className="mt-0.5 text-[15px]">
                    <span className="tabular text-[22px] font-extrabold">{money(travel.nearby.perPerson)}</span>{" "}
                    <span className="text-ink-3">per person, round trip</span>
                  </p>
                  <p className="text-[13px] text-ink-2">
                    {shortDay(travel.nearby.departOn)} → {shortDay(travel.nearby.returnOn)} · {travel.nearby.airline}, {travel.nearby.stopsLabel.toLowerCase()}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-3">These dates are close to yours, not the same, so it isn&apos;t added to your total.</p>
                </div>
                <a href={travel.nearby.url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-center text-[14px] font-bold text-white hover:bg-accent">
                  See this fare ↗
                </a>
              </div>
              <div className="mt-3">
                <LinkRow intro="Or check fares for your exact dates:" links={travel.links} />
              </div>
            </div>
          ) : (
            <LinkRow
              intro={
                go === "flight"
                  ? "We don't have a fare saved for these exact dates yet. Live fares, one tap away:"
                  : `${MODE_LABEL[go]} prices for your dates, one tap away:`
              }
              links={travel.links}
            />
          )}
          {modes.length > 1 && go !== "none" && !travel.needsOrigin && (
            <p className="mt-3 flex flex-wrap gap-2 text-[13px]">
              {modes.map((m) => (
                <a
                  key={m}
                  href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(hidden).filter(([, v]) => v)), origin, travellers: String(travellers), nights: String(nights), go: m })}#trip`}
                  className={`rounded-full border px-3 py-1 font-semibold ${m === go ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:border-accent hover:text-accent"}`}
                >
                  {MODE_LABEL[m]}
                </a>
              ))}
            </p>
          )}
          {go !== "none" && (
            <a href={travel.toggleHref} className="mt-3 inline-block text-[13px] font-semibold text-ink-3 hover:text-accent">
              I don&apos;t need to travel
            </a>
          )}
        </Step>
      </ol>

      {/* The answer */}
      <div className="glow mt-4 flex flex-col gap-1 rounded-2xl px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between" style={{ ["--glow" as string]: "#4f46e5" }}>
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-white/70">Your trip · {people}</p>
          <p className="text-[15px] text-white/85">
            {total.parts.join(" + ")}
            {total.missing.length > 0 && <> · still to add: {total.missing.join(", ")}</>}
          </p>
        </div>
        <p className="tabular text-[40px] font-extrabold leading-none">
          {money(total.amount)}
          {total.feesExtra && <span className="text-[14px] font-semibold text-sun"> + any fees</span>}
        </p>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">
        Cheapest prices listed when we checked. Hotel prices are before taxes. Prices change fast, so confirm on each site before you pay.
      </p>
    </section>
  );
}

const shortDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function Step({ n, title, price, children }: { n: number; title: string; price: string | null; money: (n: number) => string; children: ReactNode }) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-4 shadow-xs sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-[16px] font-extrabold text-white">{n}</span>
        <h3 className="min-w-0 flex-1 text-[18px] font-bold">{title}</h3>
        {price && <span className="tabular shrink-0 text-[18px] font-extrabold">{price}</span>}
      </div>
      {children}
    </li>
  );
}

function LinkRow({ intro, links }: { intro: string; links: TravelLinkLite[] }) {
  return (
    <div>
      <p className="text-[15px] text-ink-2">{intro}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-line px-4 py-2 text-[14px] font-bold hover:border-accent hover:text-accent">
            {l.site} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

function ChoiceCards({ choices, money, selectable = true }: { choices: Choice[]; money: (n: number) => string; selectable?: boolean }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {choices.map((c) => (
        <li
          key={c.chooseHref}
          className={`flex flex-col rounded-xl border p-3 ${c.selected ? "border-accent bg-accent/[0.05] ring-1 ring-accent" : "border-line"}`}
        >
          <span className="flex flex-wrap gap-1">
            {c.tags.map((t) => (
              <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-ink-2">
                {TAG_LABEL[t] ?? t}
              </span>
            ))}
            {c.freeCancellation && <span className="rounded-full bg-positive/10 px-2 py-0.5 text-[11px] font-bold text-positive">Free cancellation</span>}
          </span>
          <span className="mt-2 line-clamp-2 text-[15px] font-bold leading-snug">{c.title}</span>
          <span className="mt-0.5 text-[12px] text-ink-3">{c.facts.join(" · ")}</span>
          <span className="mt-2 flex items-baseline gap-1">
            <span className="tabular text-[20px] font-extrabold">{money(c.price)}</span>
            <span className="text-[12px] text-ink-3">{c.priceNote}</span>
          </span>
          <span className="mt-auto flex gap-2 pt-3">
            {selectable && choices.length > 1 &&
              (c.selected ? (
                <span className="flex-1 whitespace-nowrap rounded-lg bg-accent px-2 py-2 text-center text-[13px] font-bold text-white">✓ Chosen</span>
              ) : (
                <a href={c.chooseHref} className="flex-1 rounded-lg border border-accent px-2 py-2 text-center text-[13px] font-bold text-accent hover:bg-accent hover:text-white">
                  Choose
                </a>
              ))}
            <a href={c.bookUrl} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg bg-ink px-2.5 py-2 text-center text-[13px] font-bold text-white hover:bg-accent">
              {c.bookLabel} ↗
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
