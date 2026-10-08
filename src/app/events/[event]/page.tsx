import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { convertUsd, getEvent, getEventContext, getTicketSellers } from "@/lib/repositories";
import { PriceCompare, type PriceGroup } from "@/components/PriceCompare";
import { roomsFor, tripDates } from "@/lib/trip";
import { localDate } from "@/lib/dates";
import {
  AIRPORTS_BY_IATA,
  flightSearchCode,
  resolveOrigin,
} from "@/lib/providers/geo";
import { airlineLink, flightLinks, hotelLinks, type TravelLink } from "@/lib/providers/travelLinks";
import { coachLinks, driveLink, groundTravelPossible, trainLink } from "@/lib/providers/ground";
import { GameActions } from "@/components/GameActions";
import { TripSteps } from "@/components/TripSteps";
import { PhotoCredit } from "@/components/ui";
import { TeamMark } from "@/components/TeamMark";
import { cheapestFlight, cheapestHotelNear, nearbyFlight } from "@/lib/providers/livePrices";
import {
  formatDateRange,
  formatFullDate,
  formatPrice,
  formatTime,
  formatShortDate,
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
  /** Which hotel choice is in the trip (0 = cheapest). */
  stay?: string;
  /** Which flight choice is in the trip (0 = cheapest). */
  fly?: string;
}

/** Clamps user-supplied numbers so a hand-edited URL can't break the links. */
function toInt(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
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
  const destination = AIRPORTS_BY_IATA.get(venue.nearestAirport);
  // Coming from the same city as the venue: no travel and no hotel by
  // default (both can still be switched on).
  const sameCity =
    resolvedOrigin && destination
      ? flightSearchCode(resolvedOrigin) === flightSearchCode(destination)
      : false;
  const go: TravelMode | "none" =
    requested === "none" || query.flight === "0" || (sameCity && !requested)
      ? "none"
      : requested && available.includes(requested)
        ? requested
        : groundOk
          ? "train"
          : "flight";
  // A trip that starts today (a game today or tomorrow night) can't be flown
  // to: the flight would have to leave today, often already gone. No fare,
  // no links, just say so.
  const flightTooSoon = go === "flight" && dates.checkIn <= localDate(new Date().toISOString(), venue.timeZone);
  const wantFlight = go === "flight" && !flightTooSoon;
  const wantHotel = query.hotel === "1" ? true : query.hotel === "0" ? false : !sameCity;
  /** A link to this page with some trip settings changed, keeping the rest. */
  const tripHref = (change: Partial<Record<keyof SearchParams, string>>) => {
    const next: Record<string, string> = {
      origin,
      travellers: String(travellers),
      nights: String(nights),
      go: query.go || query.flight === "0" ? go : "",
      hotel: query.hotel ?? "",
      stay: query.stay ?? "",
      fly: query.fly ?? "",
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

  const flights =
    resolvedOrigin && destination && !sameCity && !flightTooSoon
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
  const [flightFound, hotelQuote] = await Promise.all([
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
          pick: toInt(query.stay, 0, 0, 2),
        })
      : Promise.resolve(null),
  ]);
  // The flight the visitor picked from the choices (the cheapest by default).
  const flightOptions = flightFound?.status === "ok" ? (flightFound.options ?? [flightFound.quote]) : [];
  const flyPick = Math.min(toInt(query.fly, 0, 0, 2), Math.max(0, flightOptions.length - 1));
  const flightQuote = flightFound?.status === "ok" ? { ...flightFound, quote: flightOptions[flyPick] ?? flightFound.quote } : flightFound;
  // No fare for the exact dates: the nearest real one, shown with its own dates.
  const nearby =
    wantFlight && resolvedOrigin && destination && !sameCity && !flightOptions.length
      ? await nearbyFlight({ from: flightSearchCode(resolvedOrigin), to: flightSearchCode(destination), departOn: dates.checkIn, returnOn: dates.checkOut, gameDay: localDate(event.startsAt, venue.timeZone) })
      : null;

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

  const money = (n: number) => formatPrice(n, prices.currency);
  // One total for the trip: what's priced, and what's still missing.
  const hotelTotal = wantHotel && hotelQuote?.forYourDates ? convertUsd(hotelQuote.total, prices.currency) * rooms : null;
  const flightTotal = go === "flight" && !sameCity && flightQuote?.status === "ok" ? convertUsd(flightQuote.quote.perPerson, prices.currency) * travellers : null;
  // No round trip for the exact dates: two one-way fares on those dates, or a
  // same-length trip a day or two off, goes in the total marked "est.".
  const flightEstimate =
    go === "flight" && !sameCity && flightTotal === null && nearby
      ? convertUsd(nearby.perPerson, prices.currency) * travellers
      : null;
  const ticketTotal = prices.cheapest ? prices.cheapest.amount! * travellers : 0;
  const tripTotal = {
    amount: Math.round((ticketTotal + (hotelTotal ?? 0) + (flightTotal ?? flightEstimate ?? 0)) * 100) / 100,
    parts: [
      travellers > 1 ? `${travellers} tickets` : "ticket",
      hotelTotal !== null ? "hotel" : "",
      flightTotal !== null ? "flight" : flightEstimate !== null ? "flight (est.)" : "",
    ].filter(Boolean),
    missing: [
      wantHotel && hotelTotal === null ? "the hotel" : "",
      go === "flight" && !sameCity && !flightTooSoon && flightTotal === null && flightEstimate === null ? (resolvedOrigin ? "the flight" : "your flight (pick your city)") : "",
      go === "train" || go === "coach" || go === "drive" ? "getting there" : "",
    ].filter(Boolean),
    feesExtra: !!prices.cheapest && prices.cheapest.fees.included !== "yes",
  };

  return (
    <>
      {/* The event, and the answer: its cheapest ticket */}
      <section className="glow relative overflow-hidden [clip-path:polygon(0_0,100%_0,100%_calc(100%-36px),0_100%)]" style={{ ["--glow" as string]: accent }}>
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
            {context.homeTeam && context.awayTeam ? (
              // A scoreboard: away team, then home team, each in its colours.
              <h1 className="mt-3 flex flex-col gap-2 text-white sm:gap-2.5">
                <span className="sr-only">{context.title}</span>
                {[
                  { team: context.awayTeam, side: "Away" },
                  { team: context.homeTeam, side: "Home" },
                ].map(({ team, side }, i) => (
                  <span key={team.id} aria-hidden className="flex items-center gap-3">
                    <span className="h-10 w-1.5 shrink-0 skew-x-[-12deg] sm:h-12" style={{ backgroundColor: team.primaryColor }} />
                    <TeamMark name={team.name} primary={team.primaryColor} secondary={team.secondaryColor} abbreviation={team.abbreviation} size={44} />
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold tracking-[0.18em] text-white/55">{side}</span>
                      <span className="block truncate text-[32px] leading-[0.95] sm:text-[46px]">{team.name}</span>
                    </span>
                  </span>
                ))}
              </h1>
            ) : (
              <h1 className="mt-2 text-[34px] text-white sm:text-[52px]">{context.title}</h1>
            )}
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

          {/* The answer first: the whole trip as a boarding pass, priced, with the ticket one tap away. */}
          <div className="drop-shadow-xl">
            {prices.cheapest ? (
              <>
                <div className="pass-top rounded-t-2xl bg-surface p-5 pb-4 text-ink">
                  <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
                    <span>Your trip</span>
                    <span>
                      {travellers} {travellers === 1 ? "fan" : "fans"} · {dates.nights} {dates.nights === 1 ? "night" : "nights"}
                    </span>
                  </p>
                  {/* The route, like a boarding pass: home city ✈ game city. */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="min-w-0">
                      <p className="score text-[36px] leading-none">
                        {resolvedOrigin && !sameCity ? flightSearchCode(resolvedOrigin) : "···"}
                      </p>
                      <p className="mt-1 truncate text-[12px] text-ink-3">
                        {resolvedOrigin ? resolvedOrigin.city : <a href="#trip" className="font-semibold text-accent">Add your city</a>}
                      </p>
                    </div>
                    <div className="flight-path relative h-6 flex-1 text-line-bright" aria-hidden>
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface px-1 text-[18px] leading-none">✈️</span>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="score text-[36px] leading-none">{destination ? flightSearchCode(destination) : venue.city.slice(0, 3).toUpperCase()}</p>
                      <p className="mt-1 truncate text-[12px] text-ink-3">{venue.city}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] font-semibold text-ink-2">
                    {formatShortDate(dates.checkIn)} → {formatShortDate(dates.checkOut)}
                  </p>
                  <ul className="mt-4 space-y-2 border-t border-line pt-3 text-[15px]">
                    <li className="flex items-center gap-3">
                      <span aria-hidden className="w-5 text-center">🎟️</span>
                      <a href="#step-1" className="flex-1 hover:text-accent">Ticket on {prices.cheapest.label}</a>
                      <span className="tabular font-bold">{money(ticketTotal)}</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span aria-hidden className="w-5 text-center">🏨</span>
                      <a href="#step-2" className="flex-1 hover:text-accent">Hotel</a>
                      <span className="tabular font-bold">{!wantHotel ? "—" : hotelTotal !== null ? money(hotelTotal) : <a href="#step-2" className="text-accent">Add</a>}</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span aria-hidden className="w-5 text-center">{go === "flight" || go === "none" ? "✈️" : go === "train" ? "🚆" : go === "coach" ? "🚌" : "🚗"}</span>
                      <a href="#step-3" className="flex-1 hover:text-accent">{go === "flight" ? "Flight" : "Travel"}</a>
                      <span className="tabular font-bold">
                        {go === "none" || sameCity ? (
                          "—"
                        ) : flightTotal !== null ? (
                          money(flightTotal)
                        ) : flightEstimate !== null ? (
                          <a href="#step-3" className="text-ink-2">
                            ≈ {money(flightEstimate)}
                          </a>
                        ) : flightTooSoon ? (
                          "—"
                        ) : (
                          <a href="#step-3" className="text-accent">Add</a>
                        )}
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="bg-surface">
                  <div className="pass-tear" />
                </div>
                <div className="pass-stub rounded-b-2xl bg-surface p-5 pt-4 text-ink">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-semibold text-ink-3">{tripTotal.missing.length ? "Trip so far" : "Trip total"}</span>
                    <span className="score text-[46px] leading-none text-positive">{money(tripTotal.amount)}</span>
                  </p>
                  <a
                    href="#trip"
                    className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3.5 text-[16px] font-bold text-white transition-colors hover:bg-accent-2"
                  >
                    Book your trip ↓
                  </a>
                  <a href={prices.cheapest.url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-[13px] font-semibold text-ink-3 hover:text-accent">
                    or just buy the ticket on {prices.cheapest.label} ↗
                  </a>
                </div>
              </>
            ) : prices.offers.length > 0 ? (
              <div className="rounded-2xl bg-surface p-5 text-ink">
                <p className="text-[16px] font-bold">No price listed yet</p>
                <p className="mt-1 text-[14px] text-ink-3">
                  No site had a price when we checked.
                </p>
                <a
                  href="#step-1"
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3.5 text-[16px] font-bold text-white hover:bg-accent-2"
                >
                  See ticket sites ↓
                </a>
              </div>
            ) : (
              <div className="rounded-2xl bg-surface p-5 text-ink">
                <p className="text-[16px] font-bold">Not on the ticket sites yet</p>
                <p className="mt-1 text-[14px] text-ink-3">
                  No ticket site lists it yet. Check back closer to the date.
                </p>
                <Link
                  href={`/leagues/${event.leagueId}`}
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3.5 text-[16px] font-bold text-white hover:bg-accent-2"
                >
                  See other {context.league?.shortName ?? ""} {isRace ? "races" : isFootball ? "matches" : "games"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <TripSteps
          money={money}
          hidden={{ go: query.go || query.flight === "0" ? go : "", hotel: query.hotel ?? "", stay: query.stay ?? "", fly: query.fly ?? "" }}
          origin={origin}
          originUnresolved={originUnresolved}
          travellers={travellers}
          nights={dates.nights}
          modes={resolvedOrigin && !sameCity ? available : []}
          go={go}
          sameCity={sameCity}
          ticket={
            prices.cheapest
              ? {
                  price: prices.cheapest.amount!,
                  site: prices.cheapest.label,
                  url: prices.cheapest.url,
                  feesExtra: prices.cheapest.fees.included !== "yes",
                  sites: pricedSites,
                  noun: ticketNoun,
                }
              : null
          }
          ticketChoices={prices.offers
            .filter((o) => o.amount !== null)
            .slice(0, 3)
            .map((o, i) => ({
              tags: i === 0 ? ["cheapest"] : [],
              title: o.label,
              facts: [o.fees.included === "yes" ? "Fees included" : o.fees.included === "no" ? "Fees added at checkout" : "Fees may be added", o.ticket && !/listed price/i.test(o.ticket) ? o.ticket : ""].filter(Boolean),
              price: o.amount! * travellers,
              priceNote: travellers > 1 ? `for ${travellers}` : "per ticket",
              selected: i === 0,
              chooseHref: o.url,
              bookUrl: o.url,
              bookLabel: "Buy",
            }))}
          compare={
            <>
              {priceGroups.some((g) => g.comparison.offers.length > 0) ? (
                <PriceCompare groups={priceGroups} />
              ) : (
                <p className="rounded-2xl border border-dashed border-line-bright bg-surface px-5 py-6 text-ink-2">
                  No ticket site we compare lists this {isRace ? "race" : isFootball ? "match" : "game"} yet.
                </p>
              )}
              {sellers.length > 0 && (
                <div className="mt-3 rounded-2xl border border-line bg-surface p-3">
                  <p className="px-3 pt-1 text-[14px] font-semibold">Official club ticket offices (face value, usually members first)</p>
                  {sellers.map((seller) => (
                    <a key={seller.url} href={seller.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                      <span className="min-w-0 flex-1 text-[15px] font-semibold">{seller.label}</span>
                      <span className="shrink-0 text-[14px] font-semibold text-accent">Visit ↗</span>
                    </a>
                  ))}
                </div>
              )}
            </>
          }
          hotel={{
            wanted: wantHotel,
            choices: hotelQuote?.forYourDates
              ? hotelQuote.options.map((h, i) => ({
                  tags: hotelQuote.options.length > 1 ? h.tags : [],
                  title: h.name,
                  facts: [
                    h.score ? `${h.score}/10${h.reviews ? ` · ${h.reviews.toLocaleString("en-US")} reviews` : ""}` : "",
                    h.distance ? `${h.distance} from the stadium` : "",
                  ].filter(Boolean),
                  price: convertUsd(h.total, prices.currency) * rooms,
                  priceNote: `${dates.nights} ${dates.nights === 1 ? "night" : "nights"}${rooms > 1 ? `, ${rooms} rooms` : ""}`,
                  freeCancellation: h.freeCancellation,
                  selected: i === hotelQuote.pick,
                  chooseHref: `${tripHref({ stay: String(i) })}#trip`,
                  bookUrl: h.url,
                  bookLabel: "Book",
                }))
              : [],
            links: hotels,
            toggleHref: `${tripHref({ hotel: wantHotel ? "0" : "1" })}#trip`,
            note: event.leagueId === "premier-league" ? "Tip: Premier League kick-off times can move for TV, so pick a rate with free cancellation." : undefined,
          }}
          travel={{
            choices:
              go === "flight"
                ? flightOptions.map((f, i) => ({
                    tags: flightOptions.length > 1 ? [i === 0 ? "cheapest" : f.stopsLabel === "Nonstop" ? "nonstop" : "other-airline"] : [],
                    title: f.airline,
                    facts: [f.stopsLabel, f.route ?? ""].filter(Boolean),
                    price: convertUsd(f.perPerson, prices.currency),
                    priceNote: "per person, round trip",
                    selected: i === flyPick,
                    chooseHref: `${tripHref({ fly: String(i) })}#trip`,
                    bookUrl: f.url,
                    bookLabel: "Book",
                  }))
                : [],
            links: go === "flight" ? flights : groundLinks,
            toggleHref: `${tripHref({ go: go === "none" ? (available.includes("flight") ? "flight" : "") : "none" })}#trip`,
            needsOrigin: go !== "none" && !resolvedOrigin,
            tooSoon: flightTooSoon && !!resolvedOrigin && !sameCity,
            nearby: nearby && {
              ...nearby,
              perPerson: convertUsd(nearby.perPerson, prices.currency),
              // The airline's own site first, then the same search on Expedia
              // and KAYAK: that fare's own dates, everyone travelling.
              links: [
                airlineLink(nearby.airline, { ...nearby.airports, departOn: nearby.departOn, returnOn: nearby.returnOn, adults: travellers }),
                ...flightLinks({
                  from: flightSearchCode(resolvedOrigin!),
                  to: flightSearchCode(destination!),
                  departOn: nearby.departOn,
                  returnOn: nearby.returnOn,
                  adults: travellers,
                }).filter((l) => ["Expedia", "KAYAK"].includes(l.site)),
              ].filter((l): l is TravelLink => l !== null),
            },
            estimate: flightEstimate,
          }}
          total={tripTotal}
        />
      </div>

      {/* Always on screen: the trip total, and a tap on each part jumps to it. */}
      {prices.cheapest && (
        <>
          <div aria-hidden className="h-20" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl items-center gap-3 sm:px-2">
              <p className="min-w-0 leading-tight">
                <span className="block text-[12px] text-ink-3">Your trip · {travellers} {travellers === 1 ? "person" : "people"}</span>
                <span className="score text-[28px] leading-none text-positive">{money(tripTotal.amount)}</span>
                {tripTotal.feesExtra && <span className="text-[13px] font-semibold text-hot"> + any fees</span>}
              </p>
              <nav aria-label="Jump to" className="ml-auto flex items-center gap-1.5 text-[14px] font-semibold">
                {[
                  { href: "#step-1", icon: "🎟️", label: money(ticketTotal) },
                  { href: "#step-2", icon: "🏨", label: !wantHotel ? "—" : hotelTotal !== null ? money(hotelTotal) : "Add" },
                  {
                    href: "#step-3",
                    icon: "✈️",
                    label: go === "none" || sameCity ? "—" : flightTotal !== null ? money(flightTotal) : flightEstimate !== null ? `≈${money(flightEstimate)}` : flightTooSoon ? "—" : "Add",
                  },
                ].map((p) => (
                  <a
                    key={p.href}
                    href={p.href}
                    className={`tabular hidden items-center gap-1 rounded-lg border px-2.5 py-2 sm:flex ${p.label === "Add" ? "border-accent text-accent" : "border-line text-ink hover:border-accent"}`}
                  >
                    <span aria-hidden>{p.icon}</span>
                    {p.label}
                  </a>
                ))}
                <a href="#trip" className="rounded-xl bg-accent px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-accent-2 sm:ml-1">
                  See my trip ↓
                </a>
              </nav>
            </div>
          </div>
        </>
      )}
    </>
  );
}

type TravelMode = "flight" | "train" | "coach" | "drive";

const ICON_STROKE = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

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

