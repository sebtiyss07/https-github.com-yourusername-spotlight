import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { convertUsd, getEvent, getEventContext, getTicketSellers } from "@/lib/repositories";
import { PriceCompare, type PriceGroup } from "@/components/PriceCompare";
import { roomsFor, tripDates } from "@/lib/trip";
import {
  AIRPORTS_BY_IATA,
  flightSearchCode,
  resolveOrigin,
} from "@/lib/providers/geo";
import { flightLinks, hotelLinks, type TravelLink } from "@/lib/providers/travelLinks";
import { coachLinks, driveLink, groundTravelPossible, trainLink } from "@/lib/providers/ground";
import { TripTotal } from "@/components/TripTotal";
import { PhotoCredit } from "@/components/ui";
import { cheapestFlight, cheapestHotelNear } from "@/lib/providers/livePrices";
import {
  formatDateRange,
  formatFullDate,
  formatPrice,
  formatTime,
} from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ event: string }>;
}): Promise<Metadata> {
  const { event: eventId } = await params;
  const event = await getEvent(eventId);
  if (!event) return {};
  const context = await getEventContext(event, { live: true });
  return {
    title: context.title,
    description: context.prices.cheapest
      ? `${context.title} tickets from ${formatPrice(context.prices.cheapest.amount!, context.prices.currency)}: prices compared across ticket sites, plus flights and a hotel for the exact dates.`
      : `Tickets for ${context.title}, plus flights and a hotel for the exact dates.`,
  };
}

interface SearchParams {
  origin?: string;
  travellers?: string;
  nights?: string;
  /** "0" when the visitor doesn't need a flight or a hotel (they live nearby). */
  flight?: string;
  /** How they travel: flight, train, coach, drive, or none. */
  go?: string;
  hotel?: string;
}

/** Clamps user-supplied numbers so a hand-edited URL can't break the links. */
function toInt(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function people(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

function nightsLabel(n: number): string {
  return `${n} ${n === 1 ? "night" : "nights"}`;
}


export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ event: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ event: eventId }, query] = await Promise.all([params, searchParams]);

  const event = await getEvent(eventId);
  if (!event) notFound();

  const context = await getEventContext(event, { live: true });
  const venue = context.venue;
  if (!venue) notFound();

  const isRace = event.sportId === "motorsport";
  // MLS is soccer but, like the NFL and NBA, calls them games.
  const isFootball = event.sportId === "soccer" && event.leagueId !== "mls";
  const origin = query.origin?.trim() ?? "";
  // One ticket first; people can pick more.
  const travellers = toInt(query.travellers, 1, 1, 8);
  // A race weekend runs Friday to Sunday; a match is one day.
  const nights = toInt(query.nights, isRace ? 3 : 2, 1, 7);

  const dates = tripDates(event, venue, nights);
  const rooms = roomsFor(travellers);
  const resolvedOrigin = origin ? resolveOrigin(origin) : null;
  // How the visitor gets there. Train and coach only within Great Britain;
  // driving only within one country.
  const groundOk = groundTravelPossible(resolvedOrigin?.country, venue.country);
  const driveOk = !!resolvedOrigin && resolvedOrigin.country === venue.country;
  const available: TravelMode[] = [
    "flight",
    ...(groundOk ? (["train", "coach"] as const) : []),
    ...(driveOk ? (["drive"] as const) : []),
  ];
  const requested = query.go as TravelMode | "none" | undefined;
  const go: TravelMode | "none" =
    requested === "none" || query.flight === "0"
      ? "none"
      : requested && available.includes(requested)
        ? requested
        : groundOk
          ? "train"
          : "flight";
  const wantTravel = go !== "none";
  const wantFlight = go === "flight";
  const wantHotel = query.hotel !== "0";
  /** A link to this page with some trip settings changed, keeping the rest. */
  const tripHref = (change: Partial<Record<keyof SearchParams, string>>) => {
    const next: Record<string, string> = {
      origin,
      travellers: String(travellers),
      nights: String(nights),
      go: query.go || query.flight === "0" ? go : "",
      hotel: wantHotel ? "" : "0",
      ...change,
    };
    return `?${new URLSearchParams(Object.entries(next).filter(([, v]) => v))}`;
  };
  const sellers = await getTicketSellers(event);
  const prices = context.prices;
  const priceGroups: PriceGroup[] = isRace
    ? [
        { key: "weekend", label: "Full weekend", comparison: prices },
        ...(context.raceDayPrices
          ? [{ key: "race-day", label: "Race day only", comparison: context.raceDayPrices }]
          : []),
      ]
    : [{ key: "match", label: "Match ticket", comparison: prices }];

  const originUnresolved = origin.length > 0 && resolvedOrigin === null;
  const destination = AIRPORTS_BY_IATA.get(venue.nearestAirport);
  const sameCity =
    resolvedOrigin && destination
      ? flightSearchCode(resolvedOrigin) === flightSearchCode(destination)
      : false;

  const flights =
    resolvedOrigin && destination && !sameCity
      ? flightLinks({
          from: flightSearchCode(resolvedOrigin),
          to: flightSearchCode(destination),
          departOn: dates.checkIn,
          returnOn: dates.checkOut,
          adults: travellers,
        })
      : [];

  const hotels = hotelLinks({
    destination: `${venue.name}, ${venue.city}`,
    lat: venue.lat,
    lon: venue.lon,
    checkIn: dates.checkIn,
    checkOut: dates.checkOut,
    adults: travellers,
  });

  // The cheapest real flight and hotel for these exact dates.
  const [flightQuote, hotelQuote] = await Promise.all([
    wantFlight && resolvedOrigin && destination && !sameCity
      ? cheapestFlight({
          from: flightSearchCode(resolvedOrigin),
          to: flightSearchCode(destination),
          departOn: dates.checkIn,
          returnOn: dates.checkOut,
        })
      : Promise.resolve(null),
    wantHotel
      ? cheapestHotelNear({
          eventId: event.id,
          venueName: `${venue.name}, ${venue.city}`,
          lat: venue.lat,
          lon: venue.lon,
          checkIn: dates.checkIn,
          checkOut: dates.checkOut,
          adults: travellers,
        })
      : Promise.resolve(null),
  ]);

  const groundLinks: TravelLink[] =
    !resolvedOrigin || go === "none" || go === "flight"
      ? []
      : go === "train"
        ? [
            trainLink({
              fromCity: resolvedOrigin.city,
              homeTeamId: event.homeTeamId ?? "",
              venueCity: venue.city,
              departOn: dates.checkIn,
              returnOn: dates.checkOut,
              adults: travellers,
            }),
          ].filter((l): l is TravelLink => l !== null)
        : go === "coach"
          ? coachLinks(resolvedOrigin.city, venue.city)
          : [driveLink(resolvedOrigin.city, venue.lat, venue.lon)];

  const accent = context.sport?.accent ?? "#4f46e5";
  const photo = context.photo;

  return (
    <>
      {/* The event, under its own floodlights */}
      <section className="glow relative overflow-hidden" style={{ ["--glow" as string]: accent }}>
        {photo && !isRace && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.large}
              alt={`${venue.name}, ${venue.city}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b0d1a]/95 via-[#0b0d1a]/75 to-[#0b0d1a]/35" />
          </>
        )}
        {photo && isRace && (
          // The circuit's shape as a white outline behind the title.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.large}
            alt={`${venue.name} track map`}
            className="pointer-events-none absolute -right-10 top-1/2 hidden h-[125%] -translate-y-1/2 opacity-30 [filter:brightness(0)_invert(1)] md:block"
          />
        )}
        {photo && <PhotoCredit photo={photo} className="absolute right-4 top-3 z-10" />}
        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8">
          <Link
            href={`/leagues/${event.leagueId}`}
            className="text-[14px] font-medium text-white/70 transition-colors hover:text-white"
          >
            ← All {context.league?.shortName ?? ""} {isRace ? "races" : isFootball ? "matches" : "games"}
          </Link>
          <p className="mt-8 text-[13px] font-semibold uppercase tracking-wide text-white/60">
            {context.league?.name}
          </p>
          <h1 className="mt-2 max-w-3xl text-[32px] font-semibold leading-[1.08] sm:text-[46px]">
            {context.title}
          </h1>
          <p className="mt-4 text-[16px] text-white/85">
            {event.endsAt
              ? formatDateRange(event.startsAt, event.endsAt, venue.timeZone)
              : `${formatFullDate(event.startsAt, venue.timeZone)} · ${isRace ? "Race starts" : isFootball ? "Kick-off" : "Starts"} ${formatTime(event.startsAt, venue.timeZone)} local time`}
          </p>
          <p className="text-[15px] text-white/60">
            {venue.name}, {venue.city}
          </p>

          {/* The answer first: the cheapest ticket, one tap from buying or
              comparing, before the trip planner below. */}
          {prices.cheapest && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <p className="rounded-2xl bg-white/12 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
                <span className="block text-[12px] font-medium text-white/70">
                  {isRace ? "Cheapest weekend pass" : "Cheapest ticket"}
                </span>
                <span className="tabular text-[24px] font-semibold leading-tight">
                  {formatPrice(prices.cheapest.amount!, prices.currency)}
                </span>
                <span className="text-[14px] text-white/80"> on {prices.cheapest.label}</span>
              </p>
              <a
                href="#tickets"
                className="rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-ink transition-colors hover:bg-accent hover:text-white"
              >
                Compare {prices.offers.length} ticket sites ↓
              </a>
              <a
                href={prices.cheapest.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full px-3 py-3 text-[15px] font-semibold text-white/90 underline-offset-4 hover:underline"
              >
                Buy on {prices.cheapest.label} ↗
              </a>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Step 1: what the visitor needs. Plain links and a GET form, so it
            works without JavaScript and every trip is a link you can send. */}
        <section className="relative -mt-10 rounded-2xl border border-line bg-surface p-4 shadow-lg sm:p-5">
          <h2 className="text-[18px] font-semibold">What do you need?</h2>
          <p className="text-[14px] text-ink-2">
            Tap to add or remove. Live nearby? Turn off the flight and hotel to see just the tickets.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <NeedTile icon={<TicketIcon />} label={isRace ? "Race tickets" : isFootball ? "Match tickets" : "Game tickets"} on />
            <NeedTile
              icon={<PlaneIcon />}
              label="Travel"
              on={wantTravel}
              href={tripHref({ go: wantTravel ? "none" : "" })}
            />
            <NeedTile
              icon={<BedIcon />}
              label="Hotel"
              on={wantHotel}
              href={tripHref({ hotel: wantHotel ? "0" : "" })}
            />
          </div>

          <form method="get" className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-2 p-2 sm:flex-row">
            {(query.go || query.flight === "0") && <input type="hidden" name="go" value={go} />}
            {!wantHotel && <input type="hidden" name="hotel" value="0" />}
            {wantTravel && (
              <Field label="Travelling from" className="sm:flex-[2]">
                <input
                  name="origin"
                  defaultValue={origin}
                  placeholder="Your city, e.g. New York"
                  className="w-full bg-transparent text-[15px] font-medium text-ink placeholder:font-normal placeholder:text-ink-3 outline-none"
                />
              </Field>
            )}
            <Field label="Tickets" className="sm:flex-1">
              <select
                name="travellers"
                defaultValue={travellers}
                className="w-full bg-transparent text-[15px] font-medium text-ink outline-none"
              >
                {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "ticket" : "tickets"} · {people(n)}
                  </option>
                ))}
              </select>
            </Field>
            {(wantTravel || wantHotel) && (
              <Field label={wantHotel ? "Hotel" : "Time away"} className="sm:flex-1">
                <select
                  name="nights"
                  defaultValue={nights}
                  className="w-full bg-transparent text-[15px] font-medium text-ink outline-none"
                >
                  {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {nightsLabel(n)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <button
              type="submit"
              className="rounded-xl bg-accent px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-accent-2"
            >
              Update total
            </button>
          </form>

          {wantTravel && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-ink-3">How are you getting there?</span>
              {available.map((mode) => (
                <Link
                  key={mode}
                  href={tripHref({ go: mode })}
                  scroll={false}
                  className={`rounded-full border px-3.5 py-1 font-semibold transition-colors ${
                    go === mode
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-ink-2 hover:border-accent hover:text-accent"
                  }`}
                >
                  {MODE_LABEL[mode]}
                </Link>
              ))}
              {!resolvedOrigin && (
                <span className="text-ink-3">
                  {venue.country === "GB"
                    ? "Train, coach and drive appear once you pick a UK city."
                    : "Driving appears once you pick where you're travelling from."}
                </span>
              )}
            </div>
          )}

          {wantTravel && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-ink-3">Travelling from</span>
              {POPULAR_ORIGINS.map((city) => (
                <Link
                  key={city}
                  href={tripHref({ origin: city })}
                  scroll={false}
                  className={`rounded-full border px-3 py-1 font-medium transition-colors ${
                    resolvedOrigin?.city === city
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-ink-2 hover:border-accent hover:text-accent"
                  }`}
                >
                  {city}
                </Link>
              ))}
            </div>
          )}

          {wantTravel && originUnresolved && (
            <p className="mt-3 text-[14px] font-medium text-hot">
              We couldn&apos;t find &ldquo;{origin}&rdquo;. Try a big city nearby,
              like New York, London or Paris.
            </p>
          )}
        </section>

        {/* Step 2: the answer. Everything added up, one button per thing to book. */}
        <div className="mt-6">
          <TripTotal
            currency={prices.currency}
            ticketPrice={prices.cheapest?.amount ?? null}
            ticketSite={prices.cheapest?.label ?? null}
            ticketUrl={prices.cheapest?.url ?? null}
            ticketNoun={isRace ? "Race ticket" : isFootball ? "Match ticket" : "Game ticket"}
            travellers={travellers}
            nights={dates.nights}
            rooms={rooms}
            venueName={venue.name}
            travelMode={go}
            includeHotel={wantHotel}
            flight={
              flightQuote?.status === "ok"
                ? { ...flightQuote, quote: { ...flightQuote.quote, perPerson: convertUsd(flightQuote.quote.perPerson, prices.currency) } }
                : flightQuote
            }
            hotel={hotelQuote && { ...hotelQuote, perNight: convertUsd(hotelQuote.perNight, prices.currency), total: convertUsd(hotelQuote.total, prices.currency) }}
            flightLinks={flights}
            groundLinks={groundLinks}
            hotelLinks={hotels}
            needsOrigin={!resolvedOrigin}
            noFlightNeeded={sameCity}
            icons={{ ticket: <TicketIcon />, flight: <PlaneIcon />, hotel: <BedIcon /> }}
          />
        </div>

        {/* Tickets in detail. */}
        <section
          id="tickets"
          className="mt-6 mb-10 min-w-0 scroll-mt-32 sm:scroll-mt-24 rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6"
        >
          <h2 className="text-[20px] font-semibold">Compare ticket prices</h2>
          <p className="mt-1 text-[14px] text-ink-2">
            {isRace
              ? "The lowest price for one ticket on every site that sells this race, cheapest first. Switch between full-weekend passes and race-day tickets."
              : isFootball
                ? "The lowest price for one ticket on every site that sells this match, cheapest first."
                : "The cheapest single ticket on every site that sells this game, cheapest first. Parking, tailgate passes and add-ons are left out. Where the venue sells standing room, the cheapest ticket may be standing room, not a seat."}
          </p>
          <div className="mt-5">
            <PriceCompare groups={priceGroups} />
          </div>

          {sellers.length > 0 && (
            <details className="group mt-6 rounded-xl border border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-[14px] font-semibold">
                Official club ticket offices
                <span className="text-[13px] font-normal text-ink-3 group-open:hidden">
                  Face value, usually members first ▾
                </span>
              </summary>
              <div className="space-y-2 border-t border-line p-3">
                {sellers.map((seller) => (
                  <a
                    key={seller.url}
                    href={seller.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/row flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold group-hover/row:text-accent">
                        {seller.label}
                      </span>
                      <span className="block text-[13px] text-ink-3">{seller.note}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-accent">Visit ↗</span>
                  </a>
                ))}
              </div>
            </details>
          )}
        </section>
      </div>
    </>
  );
}

type TravelMode = "flight" | "train" | "coach" | "drive";

const MODE_LABEL: Record<TravelMode, string> = {
  flight: "✈ Flight",
  train: "🚆 Train",
  coach: "🚌 Coach",
  drive: "🚗 Drive",
};

const POPULAR_ORIGINS = ["New York", "Los Angeles", "Chicago", "Toronto", "London", "Manchester"];


/** One thing the trip can include. Tapping it switches it on or off. */
function NeedTile({
  icon,
  label,
  on,
  href,
}: {
  icon: ReactNode;
  label: string;
  on: boolean;
  /** Missing for tickets, which are always included. */
  href?: string;
}) {
  const body = (
    <>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          on ? "bg-accent text-white" : "bg-surface-2 text-ink-3"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold ${on ? "text-ink" : "text-ink-3"}`}>{label}</span>
        <span className="block text-[13px] text-ink-3">
          {!href ? "Always included" : on ? "Included · tap to remove" : "Not needed · tap to add"}
        </span>
      </span>
      <span
        aria-hidden
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-bold ${
          on ? "bg-accent text-white" : "border-2 border-line"
        }`}
      >
        {on ? "✓" : ""}
      </span>
    </>
  );
  const cls = `flex items-center gap-3 rounded-xl border-2 px-3 py-3 transition-colors ${
    on ? "border-accent bg-accent/5" : "border-dashed border-line bg-surface hover:border-accent"
  }`;
  return href ? (
    <Link href={href} scroll={false} className={cls} aria-pressed={on}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block rounded-xl bg-surface px-4 py-2 ${className}`}>
      <span className="block text-[12px] font-semibold text-ink-3">{label}</span>
      {children}
    </label>
  );
}

const ICON_STROKE = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path
        d="M3.5 9.5a2 2 0 0 0 0 5V17a1.5 1.5 0 0 0 1.5 1.5h14A1.5 1.5 0 0 0 20.5 17v-2.5a2 2 0 0 1 0-5V7A1.5 1.5 0 0 0 19 5.5H5A1.5 1.5 0 0 0 3.5 7z"
        {...ICON_STROKE}
      />
      <path d="M14 5.5v13" {...ICON_STROKE} strokeDasharray="2 2.5" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path
        d="M11.2 4.2l1.1 5.6 6-1.8c.8-.24 1.5.5 1.2 1.26-.16.4-.5.7-.9.82l-5.9 1.77.9 4.56 2 1.1c.3.16.3.6 0 .78l-1.5.8-1.9-1.4-1.9 1.4-1.5-.8c-.3-.18-.3-.62 0-.78l2-1.1.9-4.56-5.9-1.77a1.08 1.08 0 0 1-.9-.82c-.3-.76.4-1.5 1.2-1.26l6 1.8 1.1-5.6a1.08 1.08 0 0 1 2.1 0z"
        {...ICON_STROKE}
      />
    </svg>
  );
}

function BedIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path d="M3 18.5v-9M3 18.5h18M21 18.5v-6a2 2 0 0 0-2-2h-8v5" {...ICON_STROKE} />
      <path d="M3 15.5V9a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 10 9v.5" {...ICON_STROKE} />
      <circle cx="6.2" cy="10.6" r="1.1" {...ICON_STROKE} />
    </svg>
  );
}
