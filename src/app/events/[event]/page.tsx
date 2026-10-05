import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { convertUsd, getEvent, getEventContext, getPriceHistory, getTicketSellers } from "@/lib/repositories";
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
import { GameActions } from "@/components/GameActions";
import { PriceHistory } from "@/components/PriceHistory";
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
  const history = await getPriceHistory(event.id, context.prices.currency);
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
          adults: travellers,
          bookUrl: flights[0]?.url ?? "https://www.expedia.com/Flights",
        })
      : Promise.resolve(null),
    wantHotel
      ? cheapestHotelNear({
          eventId: event.id,
          venueName: `${venue.name}, ${venue.city}`,
          lat: venue.lat,
          lon: venue.lon,
          country: venue.country,
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

  const ticketNoun = isRace ? "weekend pass" : "ticket";
  const pricedSites = prices.offers.filter((o) => o.amount !== null).length;

  return (
    <>
      {/* The event, and the answer: its cheapest ticket */}
      <section className="glow relative overflow-hidden" style={{ ["--glow" as string]: accent }}>
        {photo && !isRace && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.large}
              alt={`${venue.name}, ${venue.city}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-night/95 via-night/85 to-night/50" />
          </>
        )}
        {photo && isRace && (
          // The circuit's shape as a white outline behind the title.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.large}
            alt={`${venue.name} track map`}
            className="pointer-events-none absolute -right-10 top-1/2 hidden h-[125%] -translate-y-1/2 opacity-25 [filter:brightness(0)_invert(1)] md:block"
          />
        )}
        {photo && <PhotoCredit photo={photo} className="absolute bottom-3 right-3 z-10" />}
        <div className="relative mx-auto grid max-w-6xl gap-8 px-5 pb-14 pt-6 sm:px-6 md:grid-cols-[1fr_360px] md:items-start md:pt-8">
          <div className="min-w-0">
            <Link
              href={`/leagues/${event.leagueId}`}
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white/75 transition-colors hover:text-white"
            >
              ← All {context.league?.shortName ?? ""} {isRace ? "races" : isFootball ? "matches" : "games"}
            </Link>
            <p className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-white/65">
              {context.league?.name}
            </p>
            <h1 className="mt-2 text-[30px] font-extrabold leading-[1.08] text-white sm:text-[44px]">
              {context.title}
            </h1>
            <ul className="mt-5 space-y-1.5 text-[16px] text-white/90">
              <li className="flex items-start gap-2.5">
                <CalendarIcon />
                <span>
                  {event.endsAt
                    ? formatDateRange(event.startsAt, event.endsAt, venue.timeZone)
                    : `${formatFullDate(event.startsAt, venue.timeZone)} · ${formatTime(event.startsAt, venue.timeZone)} local time`}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <PinIcon />
                <span>
                  {venue.name}, {venue.city}
                </span>
              </li>
            </ul>
            <GameActions
              game={{
                id: event.id,
                title: context.title,
                startsAt: event.startsAt,
                place: `${venue.name}, ${venue.city}`,
                price: prices.cheapest?.amount ?? null,
                currency: prices.currency,
              }}
            />
          </div>

          {/* The answer first: the cheapest ticket, one tap from buying. */}
          <div className="rounded-2xl bg-surface p-5 text-ink shadow-lg">
            {prices.cheapest ? (
              <>
                <p className="text-[14px] font-semibold text-ink-3">
                  Cheapest {ticketNoun}
                  {pricedSites > 1 ? ` · ${pricedSites} sites compared` : ""}
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="tabular font-display text-[40px] font-extrabold leading-none text-positive">
                    {formatPrice(prices.cheapest.amount!, prices.currency)}
                  </span>
                  <span className="text-[15px] text-ink-2">on {prices.cheapest.label}</span>
                </p>
                <a
                  href={prices.cheapest.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-5 py-3.5 text-[16px] font-bold text-white transition-colors hover:bg-accent-2"
                >
                  Buy on {prices.cheapest.label} ↗
                </a>
                <a
                  href="#tickets"
                  className="mt-2 flex w-full items-center justify-center rounded-xl border border-line px-5 py-3 text-[15px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  Compare all {prices.offers.length} sites ↓
                </a>
                <TripPeek
                  money={(n) => formatPrice(n, prices.currency)}
                  ticket={prices.cheapest.amount!}
                  travellers={travellers}
                  nights={dates.nights}
                  rooms={rooms}
                  hotel={wantHotel ? (hotelQuote ? { ...hotelQuote, perNight: convertUsd(hotelQuote.perNight, prices.currency), total: convertUsd(hotelQuote.total, prices.currency) } : null) : undefined}
                  go={go}
                  origin={resolvedOrigin?.city ?? null}
                  sameCity={sameCity}
                  flight={flightQuote?.status === "ok" ? { perPerson: convertUsd(flightQuote.quote.perPerson, prices.currency) } : null}
                  keep={{ travellers: String(travellers), nights: String(nights), go: query.go || query.flight === "0" ? go : "", hotel: wantHotel ? "" : "0" }}
                />
              </>
            ) : prices.offers.length > 0 ? (
              <>
                <p className="text-[16px] font-bold">No price listed yet</p>
                <p className="mt-1 text-[14px] text-ink-3">
                  None of the sites we read had a price when we checked. See each site below.
                </p>
                <a
                  href="#tickets"
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3.5 text-[16px] font-bold text-white hover:bg-accent-2"
                >
                  See ticket sites ↓
                </a>
              </>
            ) : (
              <>
                <p className="text-[16px] font-bold">Not on the ticket sites yet</p>
                <p className="mt-1 text-[14px] text-ink-3">
                  None of the ticket sites we compare lists this {isRace ? "race" : isFootball ? "match" : "game"} yet.
                  Resale tickets usually appear closer to the date, so check back soon.
                </p>
                <Link
                  href={`/leagues/${event.leagueId}`}
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3.5 text-[16px] font-bold text-white hover:bg-accent-2"
                >
                  See other {context.league?.shortName ?? ""} {isRace ? "races" : isFootball ? "matches" : "games"}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        {/* 1. Every site's price, cheapest first. */}
        <section id="tickets" className="mt-8 min-w-0 scroll-mt-32">
          <h2 className="text-[24px] font-extrabold sm:text-[28px]">
            Ticket prices on every site
          </h2>
          <p className="mt-1 max-w-3xl text-ink-2">
            {isRace
              ? "The lowest price for one ticket on every site that sells this race, cheapest first. Switch between full-weekend passes and race-day tickets."
              : isFootball
                ? "The lowest price for one ticket on every site that sells this match, cheapest first."
                : "The cheapest single ticket on every site, fees included, cheapest first. Parking, tailgate passes and add-ons are left out. The cheapest ticket may be standing room where the venue sells it."}
          </p>
          <div className="mt-5">
            {priceGroups.some((g) => g.comparison.offers.length > 0) ? (
              <>
                <PriceCompare groups={priceGroups} />
                {!isRace && <PriceHistory points={history} currency={prices.currency} />}
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-line-bright bg-surface px-5 py-6 text-ink-2">
                No ticket site we compare lists this {isRace ? "race" : isFootball ? "match" : "game"} yet. We check
                again as sites add it.
              </p>
            )}
          </div>

          {sellers.length > 0 && (
            <details className="group mt-4 rounded-2xl border border-line bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold">
                Official club ticket offices
                <span className="text-[13px] font-normal text-ink-3 group-open:hidden">
                  Face value, usually members first ▾
                </span>
              </summary>
              <div className="space-y-1 border-t border-line p-3">
                {sellers.map((seller) => (
                  <a
                    key={seller.url}
                    href={seller.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/row flex items-center gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold group-hover/row:text-accent">
                        {seller.label}
                      </span>
                      <span className="block text-[13px] text-ink-3">{seller.note}</span>
                    </span>
                    <span className="shrink-0 text-[14px] font-semibold text-accent">Visit ↗</span>
                  </a>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* 2. The whole trip. Plain links and a GET form, so it works without
            JavaScript and every trip is a link you can send. */}
        <section id="trip" className="mt-14 scroll-mt-32">
          <h2 className="text-[24px] font-extrabold sm:text-[28px]">Plan the whole trip</h2>
          <p className="mt-1 text-ink-2">
            Travelling to the {isRace ? "race" : isFootball ? "match" : "game"}? Add a hotel and a
            flight for the same dates and we&apos;ll add it all up. Live nearby? Switch them off.
          </p>

          <div className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
            <div className="grid gap-2 sm:grid-cols-3">
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

            <form method="get" action="#trip" className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-2 p-2 sm:flex-row">
              {(query.go || query.flight === "0") && <input type="hidden" name="go" value={go} />}
              {!wantHotel && <input type="hidden" name="hotel" value="0" />}
              {wantTravel && (
                <Field label="Travelling from" className="sm:flex-[2]">
                  <input
                    name="origin"
                    defaultValue={origin}
                    placeholder="Your city, e.g. Chicago"
                    autoComplete="address-level2"
                    className="w-full bg-transparent text-[16px] font-medium text-ink placeholder:font-normal placeholder:text-ink-3 outline-none"
                  />
                </Field>
              )}
              <Field label="Tickets" className="sm:flex-1">
                <select
                  name="travellers"
                  defaultValue={travellers}
                  className="w-full bg-transparent text-[16px] font-medium text-ink outline-none"
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
                    className="w-full bg-transparent text-[16px] font-medium text-ink outline-none"
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
                className="rounded-xl bg-accent px-6 py-3.5 text-[16px] font-bold text-white transition-colors hover:bg-accent-2"
              >
                Update total
              </button>
            </form>

            {wantTravel && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
                <span className="text-ink-3">Travelling from:</span>
                {POPULAR_ORIGINS.map((city) => (
                  <Link
                    key={city}
                    href={`${tripHref({ origin: city })}#trip`}
                    scroll={false}
                    className={`rounded-full border px-3 py-1 font-semibold transition-colors ${
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

            {wantTravel && (available.length > 1 || !resolvedOrigin) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
                <span className="text-ink-3">Getting there by:</span>
                {available.map((mode) => (
                  <Link
                    key={mode}
                    href={`${tripHref({ go: mode })}#trip`}
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
                      ? "Train, coach and driving appear once you pick a UK city."
                      : "Driving appears once you pick where you're travelling from."}
                  </span>
                )}
              </div>
            )}

            {wantTravel && originUnresolved && (
              <p className="mt-3 text-[15px] font-semibold text-hot">
                We couldn&apos;t find &ldquo;{origin}&rdquo;. Try a big city nearby, like New York,
                London or Paris.
              </p>
            )}
          </div>

          <div className="mt-4">
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
        </section>
      </div>

      {/* Phones: the cheapest ticket stays one tap away while scrolling. */}
      {prices.cheapest && (
        <>
          <div aria-hidden className="h-20 md:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-xl md:hidden">
            <div className="mx-auto flex max-w-6xl items-center gap-3">
              <p className="min-w-0 flex-1 leading-tight">
                <span className="block text-[12px] text-ink-3">Cheapest {ticketNoun}</span>
                <span className="tabular text-[20px] font-extrabold text-positive">
                  {formatPrice(prices.cheapest.amount!, prices.currency)}
                </span>
                <span className="truncate text-[13px] text-ink-2"> on {prices.cheapest.label}</span>
              </p>
              <a
                href={prices.cheapest.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-xl bg-accent px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-accent-2"
              >
                Buy ↗
              </a>
            </div>
          </div>
        </>
      )}
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

/**
 * The trip at a glance, under the ticket price: the hotel and the flight with
 * their prices, and the whole-trip total once every part is priced. Each row
 * jumps to the full trip planner below; a city can be typed right here.
 */
function TripPeek({
  money,
  ticket,
  travellers,
  nights,
  rooms,
  hotel,
  go,
  origin,
  sameCity,
  flight,
  keep,
}: {
  money: (n: number) => string;
  ticket: number;
  travellers: number;
  nights: number;
  rooms: number;
  /** undefined: hotel switched off; null: no saved price. */
  hotel: { perNight: number; total: number; forYourDates?: boolean } | null | undefined;
  go: TravelMode | "none";
  origin: string | null;
  sameCity: boolean;
  /** A fare for the visitor's exact dates and airports, or null. */
  flight: { perPerson: number } | null;
  /** The other trip settings, kept when a city is typed here. */
  keep: Record<string, string>;
}) {
  const hotelPriced = hotel?.forYourDates ? hotel : null;
  const flightNeeded = go === "flight" && !sameCity;
  const flightPriced = flightNeeded && origin ? flight : null;
  const parts = [
    ticket * travellers,
    ...(hotel !== undefined ? [hotelPriced ? hotelPriced.total * rooms : null] : []),
    ...(flightNeeded ? [flightPriced ? flightPriced.perPerson * travellers : null] : []),
  ];
  // Train, coach and driving costs aren't priced, so those trips get no total here.
  const complete = parts.every((p) => p !== null) && parts.length > 1 && (go === "flight" || go === "none");
  const total = Math.round(parts.reduce<number>((a, b) => a + (b ?? 0), 0) * 100) / 100;

  const row = "flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2";
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="px-2 text-[13px] font-semibold text-ink-3">
        Your trip · {nights} {nights === 1 ? "night" : "nights"}, {travellers} {travellers === 1 ? "person" : "people"}
      </p>

      {hotel !== undefined && (
        <a href="#trip" className={row}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
            <BedIcon />
          </span>
          <span className="min-w-0 flex-1 text-[14px] font-semibold">Hotel near the venue</span>
          <span className="shrink-0 text-right text-[14px]">
            {hotelPriced ? (
              <>
                <span className="tabular font-bold">{money(hotelPriced.perNight)}</span>
                <span className="text-ink-3">/night</span>
              </>
            ) : (
              <span className="font-semibold text-accent">See prices</span>
            )}
          </span>
        </a>
      )}

      {go !== "none" &&
        (go === "flight" && !origin && !sameCity ? (
          <form method="get" className="flex items-center gap-2 rounded-xl px-2 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
              <PlaneIcon />
            </span>
            {Object.entries(keep)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <input
              name="origin"
              placeholder="Flying from? Your city"
              aria-label="Flying from"
              autoComplete="address-level2"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[14px] outline-none placeholder:text-ink-3 focus:border-accent focus:bg-surface"
            />
            <button type="submit" className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-[14px] font-bold text-white hover:bg-accent">
              Add
            </button>
          </form>
        ) : (
          <a href="#trip" className={row}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
              <PlaneIcon />
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-semibold">
              {go === "flight" ? (sameCity ? "No flight needed" : `Flight from ${origin}`) : MODE_LABEL[go].replace(/^\S+\s/, "") + (origin ? ` from ${origin}` : "")}
            </span>
            <span className="shrink-0 text-right text-[14px]">
              {go !== "flight" ? (
                <span className="font-semibold text-accent">{go === "drive" ? "Directions" : "See fares"}</span>
              ) : sameCity ? (
                <span className="font-semibold text-ink-3">{money(0)}</span>
              ) : flightPriced ? (
                <>
                  <span className="tabular font-bold">{money(flightPriced.perPerson)}</span>
                  <span className="text-ink-3"> return</span>
                </>
              ) : (
                <span className="font-semibold text-accent">See fares</span>
              )}
            </span>
          </a>
        ))}

      <a
        href="#trip"
        className="mt-1 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-[14px] transition-colors hover:bg-surface-3"
      >
        {complete ? (
          <>
            <span className="font-semibold">Whole trip</span>
            <span className="tabular text-[17px] font-extrabold">{money(total)}</span>
          </>
        ) : (
          <>
            <span className="font-semibold">Plan the whole trip</span>
            <span className="font-semibold text-accent">↓</span>
          </>
        )}
      </a>
    </div>
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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden className="mt-0.5 shrink-0 text-white/60">
      <rect x="3.5" y="5" width="17" height="15" rx="2" {...ICON_STROKE} />
      <path d="M3.5 10h17M8 3v4M16 3v4" {...ICON_STROKE} />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden className="mt-0.5 shrink-0 text-white/60">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" {...ICON_STROKE} />
      <circle cx="12" cy="10" r="2.3" {...ICON_STROKE} />
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
