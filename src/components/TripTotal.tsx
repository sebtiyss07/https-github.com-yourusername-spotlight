import type { ReactNode } from "react";
import { formatPrice } from "@/lib/format";
import type { FlightResult, HotelQuote } from "@/lib/providers/livePrices";

interface Link {
  site: string;
  url: string;
}

/**
 * What the whole trip costs, added up from the cheapest real prices: the
 * cheapest ticket listed, the cheapest round-trip fare found, and the cheapest
 * hotel near the venue for these dates. Only the parts the visitor asked for
 * are counted. A part we couldn't price is shown as missing, never estimated,
 * and the total says it's incomplete.
 */
export function TripTotal({
  currency,
  ticketPrice,
  ticketSite,
  ticketUrl,
  ticketNoun = "Match ticket",
  travellers,
  nights,
  rooms,
  venueName,
  travelMode,
  includeHotel,
  flight,
  hotel,
  flightLinks,
  groundLinks,
  hotelLinks,
  needsOrigin,
  noFlightNeeded,
  icons,
}: {
  currency: string;
  ticketPrice: number | null;
  ticketSite: string | null;
  ticketUrl: string | null;
  /** "Match ticket", "Game ticket" or "Race ticket". */
  ticketNoun?: string;
  travellers: number;
  nights: number;
  rooms: number;
  venueName: string;
  /** How they travel; "none" leaves travel out of the total. */
  travelMode: "flight" | "train" | "coach" | "drive" | "none";
  includeHotel: boolean;
  flight: FlightResult | null;
  hotel: HotelQuote | null;
  flightLinks: Link[];
  /** Train, coach or driving links, for those modes. */
  groundLinks: Link[];
  hotelLinks: Link[];
  needsOrigin: boolean;
  noFlightNeeded: boolean;
  icons: { ticket: ReactNode; flight: ReactNode; hotel: ReactNode };
}) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const money = (n: number) => formatPrice(n, currency);
  const people = `${travellers} ${travellers === 1 ? "person" : "people"}`;
  const includeFlight = travelMode === "flight";
  const ground = travelMode === "train" || travelMode === "coach" || travelMode === "drive";

  const tickets = ticketPrice !== null ? round(ticketPrice * travellers) : null;
  const flightAmount = !includeFlight
    ? null
    : noFlightNeeded
      ? 0
      : flight?.status === "ok"
        ? round(flight.quote.perPerson * travellers)
        : null;
  // Booking.com's price for the whole stay, one room; times the rooms needed.
  const hotelAmount = includeHotel && hotel ? round(hotel.total * rooms) : null;

  const parts = [
    tickets,
    ...(includeFlight ? [flightAmount] : []),
    ...(includeHotel ? [hotelAmount] : []),
  ];
  const total = round(parts.reduce<number>((a, b) => a + (b ?? 0), 0));
  const complete = parts.every((p) => p !== null);

  const what = [
    travellers === 1 ? "Ticket" : "Tickets",
    includeFlight && "flight",
    includeHotel && "hotel",
  ].filter(Boolean);
  const whatLabel =
    what.length === 1 ? `${what[0]} only` : `${what.slice(0, -1).join(", ")} and ${what.at(-1)}`;

  let note: string;
  if (includeFlight && needsOrigin) note = "The flight is added once you choose where you fly from.";
  else if (ground && needsOrigin) note = "Choose where you're travelling from above.";
  else if (ground)
    note = `${whatLabel}. ${GROUND[travelMode as "train"].noun} fares aren't in the total: check them in one tap below.`;
  else if (!complete) note = "So far. One part couldn't be priced yet, see below.";
  else if (travellers > 1) note = `${money(round(total / travellers))} per person`;
  else note = `${whatLabel}, at the cheapest prices when we checked`;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-md md:grid md:grid-cols-[300px_1fr]">
      <div className="glow flex flex-col justify-center px-6 py-6" style={{ ["--glow" as string]: "#4f46e5" }}>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-white/70">
          Your total · {people}
        </p>
        <p className="tabular mt-1.5 text-[40px] font-semibold leading-none">{money(total)}</p>
        <p className="mt-2 text-[14px] text-white/80">{note}</p>
      </div>

      <div className="divide-y divide-line">
        <Line
          icon={icons.ticket}
          label={travellers === 1 ? ticketNoun : `Tickets × ${travellers}`}
          value={tickets !== null ? money(tickets) : "—"}
          detail={
            ticketPrice !== null
              ? `${money(ticketPrice)} each on ${ticketSite}, the cheapest site. Compare all sites below.`
              : "No listed price yet. See the ticket sites below."
          }
          href={ticketUrl ?? undefined}
          action="Buy tickets"
        />

        {includeFlight && (
          <Line
            icon={icons.flight}
            label="Round-trip flight"
            value={
              noFlightNeeded ? money(0) : needsOrigin ? "Add city" : flightAmount !== null ? money(flightAmount) : "—"
            }
            detail={
              noFlightNeeded
                ? "You're already in this city, so no flight is needed."
                : needsOrigin
                  ? "Choose where you fly from above."
                  : flight?.status === "ok"
                    ? `${money(flight.quote.perPerson)} per person · ${flight.quote.airline}${flight.quote.stopsLabel ? `, ${flight.quote.stopsLabel.toLowerCase()}` : ""} · ${flight.quote.source}`
                    : "No recent fare saved for these dates. Check the price on:"
            }
            href={flight?.status === "ok" ? flight.quote.url : undefined}
            action="See flight"
            links={flight?.status === "ok" || needsOrigin || noFlightNeeded ? [] : flightLinks}
          />
        )}

        {ground && (
          <Line
            icon={icons.flight}
            label={GROUND[travelMode as "train"].label}
            value={needsOrigin ? "Add city" : "See fares"}
            detail={needsOrigin ? "Choose where you travel from above." : groundLinks.length ? GROUND[travelMode as "train"].detail : "No direct route we can link to for this city. Try another way to travel."}
            href={groundLinks[0]?.url}
            action={GROUND[travelMode as "train"].action}
            links={groundLinks.slice(1)}
          />
        )}

        {includeHotel && (
          <Line
            icon={icons.hotel}
            label={`Hotel · ${nights} ${nights === 1 ? "night" : "nights"}${rooms > 1 ? ` · ${rooms} rooms` : ""}`}
            value={hotelAmount !== null ? money(hotelAmount) : "—"}
            detail={
              hotel
                ? `Cheapest on ${hotel.site}: ${hotel.name}${hotel.room ? ` (${hotel.room})` : ""}, ${hotel.distance} from ${venueName}. ${money(hotel.total)} for ${hotel.nights} ${hotel.nights === 1 ? "night" : "nights"} (${money(hotel.perNight)} a night on average) before taxes${travellers > 1 ? `, per room for 2 people` : ""}. Checked ${hotel.checkedOn}.`
                : "No saved price for these dates and group size. Cheapest hotels near the venue on:"
            }
            href={hotel?.url}
            action={hotel ? `Book on ${hotel.site}` : "See hotels"}
            links={hotel ? [{ site: `All ${hotel.found ?? ""} hotels nearby, cheapest first`.replace("  ", " "), url: hotel.searchUrl }, ...hotelLinks.filter((l) => l.site !== hotel.site)] : hotelLinks}
          />
        )}

        <p className="px-5 py-3 text-[12px] text-ink-3">
          Cheapest prices listed when we checked.
          {includeHotel && " Hotel prices are before local taxes."} Prices change fast, so
          confirm on the booking site.
        </p>
      </div>
    </section>
  );
}

function Line({
  icon,
  label,
  value,
  detail,
  href,
  action,
  links = [],
  linksLabel,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  href?: string;
  action: string;
  links?: Link[];
  linksLabel?: string;
}) {
  return (
    <div className="flex gap-3 px-5 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-semibold">{label}</p>
          <p className="tabular shrink-0 text-[18px] font-semibold">{value}</p>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 text-[13px] text-ink-3">{detail}</p>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent"
            >
              {action} ↗
            </a>
          )}
        </div>
        {links.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {linksLabel && <span className="text-[12px] text-ink-3">{linksLabel}</span>}
            {links.map((l) => (
              <a
                key={l.site}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-line px-2.5 py-0.5 text-[12px] font-semibold text-ink-2 transition-colors hover:border-accent hover:text-accent"
              >
                {l.site} ↗
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const GROUND = {
  train: {
    label: "Train, return",
    noun: "Train",
    detail: "National Rail's official planner, with your stations, dates and people filled in. It shows the real fares.",
    action: "See trains",
  },
  coach: {
    label: "Coach",
    noun: "Coach",
    detail: "Coach routes and fares to the match city.",
    action: "See coaches",
  },
  drive: {
    label: "Drive",
    noun: "Driving",
    detail: "Door-to-stadium directions with drive time. Fuel and parking aren't included.",
    action: "Directions",
  },
} as const;
