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
    /** The flight would have to leave today: too late to fly in. */
    tooSoon?: boolean;
    /** No exact-date fare: the nearest real one, with its own dates (per person). */
    nearby?: {
      perPerson: number;
      departOn: string;
      returnOn: string;
      airline: string;
      stopsLabel: string;
      url: string;
      kind: "pair";
      /** The airline's own site (when we have a working link), Expedia and KAYAK, for that fare's dates. */
      links: TravelLinkLite[];
    } | null;
    /** The nearby fare as counted in the total (round trip, everyone). */
    estimate?: number | null;
  };
  total: { amount: number; parts: string[]; missing: string[]; feesExtra: boolean };
}) {
  const people = `${travellers} ${travellers === 1 ? "person" : "people"}`;
  const hotelPicked = hotel.choices.find((c) => c.selected);
  const flightPicked = travel.choices.find((c) => c.selected);

  return (
    <section id="trip" className="mt-8 scroll-mt-32">
      <h2 className="text-[24px] font-bold tracking-tight sm:text-[28px]">Book your trip in 3 steps</h2>

      {/* Settings: one row */}
      <form
        method="get"
        action="#trip"
        className={`mt-5 grid gap-2 rounded-xl border border-line bg-surface p-3 ${modes.length > 1 ? "sm:grid-cols-[2fr_1fr_1fr_1fr_auto]" : "sm:grid-cols-[2fr_1fr_1fr_auto]"}`}
      >
        {Object.entries(hidden)
          .filter(([k, v]) => v && !(k === "go" && modes.length > 1))
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
        {modes.length > 1 && (
          <label className="block rounded-xl bg-surface-2 px-4 py-2">
            <span className="block text-[12px] font-semibold text-ink-3">Getting there</span>
            <select name="go" defaultValue={go} className="w-full cursor-pointer bg-transparent text-[16px] font-semibold text-ink outline-none">
              {[...modes, "none" as const].map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
        )}
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
        <Step n={1} icon="🎟️" title={`Your ${ticket?.noun ?? "ticket"}${travellers > 1 ? `s × ${travellers}` : ""}`} price={ticket ? money(ticket.price * travellers) : null} money={money}>
          {ticketChoices.length ? (
            <Rows rows={ticketChoices} money={money} selectable={false} />
          ) : (
            <p className="text-[15px] text-ink-2">No prices yet.</p>
          )}
          <details className="group mt-3">
            <summary className="cursor-pointer list-none text-[14px] font-semibold text-accent hover:underline">
              <span className="group-open:hidden">Show all {ticket?.sites ?? ""} ticket sites ▾</span>
              <span className="hidden group-open:inline">Hide the full list ▴</span>
            </summary>
            <div className="mt-3">{compare}</div>
          </details>
        </Step>

        {/* 2. Hotel */}
        <Step
          n={2}
          icon="🏨"
          title={`Your hotel · ${nights} ${nights === 1 ? "night" : "nights"}`}
          price={hotel.wanted ? (hotelPicked ? money(hotelPicked.price) : null) : "Not needed"}
          money={money}
        >
          {!hotel.wanted ? (
            <p className="text-[15px] text-ink-2">
              No hotel.{" "}
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
            <LinkRow intro="Hotels near the venue, your dates:" links={hotel.links} />
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
          icon={go === "train" ? "🚆" : go === "coach" ? "🚌" : go === "drive" ? "🚗" : go === "none" ? "🏠" : "✈️"}
          title={go === "none" ? "Getting there" : go === "flight" ? "Your flight" : `Your ${MODE_LABEL[go].toLowerCase()}`}
          price={go === "none" ? (sameCity ? "You're local" : "Not needed") : flightPicked ? money(flightPicked.price * travellers) : travel.estimate ? `≈ ${money(travel.estimate)}` : null}
          money={money}
        >
          {go === "none" ? (
            <p className="text-[15px] text-ink-2">
              {sameCity ? "You're local." : "No travel."}{" "}
              <a href={travel.toggleHref} className="font-semibold text-accent hover:underline">
                Add travel
              </a>
            </p>
          ) : travel.tooSoon ? (
            <p className="text-[15px] text-ink-2">Too late to fly in: the flight would have to leave today.</p>
          ) : travel.needsOrigin ? (
            <p className="text-[15px] text-ink-2">
              <span className="font-semibold text-ink">Pick your city above</span> to see flights.
            </p>
          ) : travel.choices.length ? (
            <Rows rows={travel.choices} money={money} selectable={travel.choices.length > 1} />
          ) : travel.nearby ? (
            <div className="rounded-xl border border-line px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">
                    {shortDay(travel.nearby.departOn)} → {shortDay(travel.nearby.returnOn)}
                  </p>
                  <p className="text-[13px] text-ink-3">
                    {travel.nearby.airline} · {travel.nearby.stopsLabel.toLowerCase()} ·{" "}
                    your dates
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-[18px] font-bold leading-tight">≈ {money(travel.nearby.perPerson)}</p>
                  <p className="text-[12px] text-ink-3">per person, round trip</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-ink-3">See this flight on</span>
                {travel.nearby.links.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-accent px-3 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent hover:text-white"
                  >
                    {l.site} ↗
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-ink-3">Recent fare. Check today&apos;s price on each site.</p>
            </div>
          ) : (
            <LinkRow intro={go === "flight" ? "No price yet for your dates. See flights on:" : `${MODE_LABEL[go]} for your dates:`} links={travel.links.slice(0, 3)} />
          )}
          {go !== "none" && (
            <a href={travel.toggleHref} className="mt-3 inline-block text-[13px] font-semibold text-ink-3 hover:text-accent">
              I don&apos;t need to travel
            </a>
          )}
        </Step>

        {/* Game day: the whole trip, one total */}
        <li className="grid grid-cols-[40px_1fr] gap-3 sm:grid-cols-[48px_1fr] sm:gap-4">
          <RouteStop icon="🏟️" last />
          <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-night px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-white/70">Game day · your trip · {people}</p>
              <p className="text-[15px] text-white/85">
                {total.parts.join(" + ")}
                {total.missing.length > 0 && <> · still to add: {total.missing.join(", ")}</>}
              </p>
            </div>
            <p className="score text-[44px] leading-none">
              {money(total.amount)}
              {total.feesExtra && <span className="text-[14px] font-semibold text-sun"> + any fees</span>}
            </p>
          </div>
        </li>
      </ol>
      <p className="mt-2 text-[12px] text-ink-3">
        Prices when we last checked. Hotels are before taxes.
      </p>
    </section>
  );
}

const shortDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** One stop on the trip: an emoji stop on a dotted route line, then its card. */
function Step({ n, icon, title, price, children }: { n: number; icon: string; title: string; price: string | null; money: (n: number) => string; children: ReactNode }) {
  return (
    <li id={`step-${n}`} className="grid scroll-mt-28 grid-cols-[40px_1fr] gap-3 sm:grid-cols-[48px_1fr] sm:gap-4">
      <RouteStop icon={icon} />
      <div className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">Step {n}</p>
            <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
          </div>
          {price && <span className="score shrink-0 text-[24px] leading-none">{price}</span>}
        </div>
        {children}
      </div>
    </li>
  );
}

function RouteStop({ icon, last = false }: { icon: string; last?: boolean }) {
  return (
    <div className="relative flex justify-center">
      <span aria-hidden className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-surface text-[19px] shadow-sm ring-2 ring-accent/25 sm:h-12 sm:w-12 sm:text-[22px]">
        {icon}
      </span>
      {!last && <span aria-hidden className="absolute -bottom-4 left-1/2 top-10 -translate-x-1/2 border-l-2 border-dashed border-accent/30 sm:top-12" />}
    </div>
  );
}

/** A clean price list: one row per option, price and one button on the right. */
function Rows({ rows, money, selectable }: { rows: Choice[]; money: (n: number) => string; selectable: boolean }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {rows.map((r, i) => (
        <li key={`${r.bookUrl}-${i}`} className={`flex items-center gap-3 px-4 py-3 ${selectable && r.selected ? "bg-accent/[0.04]" : ""}`}>
          {selectable &&
            (r.selected ? (
              <span aria-label="In your trip" className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-accent">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              </span>
            ) : (
              <a href={r.chooseHref} aria-label={`Choose ${r.title}`} className="h-5 w-5 shrink-0 rounded-full border-2 border-line-bright hover:border-accent" />
            ))}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold">
              {r.title}
              {r.tags.map((t) => (
                <span
                  key={t}
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${t === "cheapest" ? "bg-positive/10 text-positive" : "bg-surface-2 text-ink-2"}`}
                >
                  {TAG_LABEL[t] ?? t}
                </span>
              ))}
            </p>
            <p className="truncate text-[13px] text-ink-3">{r.facts.join(" · ")}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tabular text-[18px] font-bold leading-tight">{money(r.price)}</p>
            <p className="text-[12px] text-ink-3">{r.priceNote}</p>
          </div>
          <a
            href={r.bookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-accent px-3.5 py-2 text-[14px] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
          >
            {r.bookLabel} ↗
          </a>
        </li>
      ))}
    </ul>
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
              <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">
                {TAG_LABEL[t] ?? t}
              </span>
            ))}
            {c.freeCancellation && <span className="rounded-md bg-positive/10 px-1.5 py-0.5 text-[11px] font-semibold text-positive">Free cancellation</span>}
          </span>
          <span className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug">{c.title}</span>
          <span className="mt-0.5 text-[12px] text-ink-3">{c.facts.join(" · ")}</span>
          <span className="mt-2 flex items-baseline gap-1">
            <span className="tabular text-[20px] font-bold tracking-tight">{money(c.price)}</span>
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
