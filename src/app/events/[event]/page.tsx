import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { TicketListing } from "@/lib/domain/types";
import { getEvent, getEventContext, getVenue } from "@/lib/repositories";
import { bestValue, buildTrip, tripBreakdown } from "@/lib/trip";
import { MARKETPLACE_LABELS } from "@/lib/providers/tickets/seeded";
import { AIRPORTS_BY_IATA, resolveOrigin } from "@/lib/providers/geo";
import { transportSurchargePerNight } from "@/lib/providers/stays/seeded";
import {
  approachDescription,
  formatDateRange,
  formatDistance,
  formatDuration,
  formatMoney,
  formatMoneyCents,
  formatTime,
} from "@/lib/format";
import { Badge, Breadcrumbs, EmptyState, SectionHeading, TeamMark } from "@/components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ event: string }>;
}): Promise<Metadata> {
  const { event: eventId } = await params;
  const event = await getEvent(eventId);
  if (!event) return {};
  const context = await getEventContext(event);
  return {
    title: context.title,
    description: `Cheapest tickets for ${context.title} across every marketplace, plus flights and stays near ${context.venue?.name ?? "the venue"}.`,
  };
}

interface SearchParams {
  origin?: string;
  travellers?: string;
  nights?: string;
}

/** Clamps user-supplied numbers so a hand-edited URL can't blow up the maths. */
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

  const context = await getEventContext(event);
  const venue = await getVenue(event.venueId);
  if (!venue) notFound();

  const origin = query.origin?.trim() ?? "";
  const travellers = toInt(query.travellers, 2, 1, 12);
  const nights = toInt(query.nights, 2, 1, 14);

  const trip = await buildTrip({ event, venue, origin, travellers, nights });
  const { estimate, tickets, travel, stays } = trip;

  const resolvedOrigin = origin ? resolveOrigin(origin) : null;
  const originUnresolved = origin.length > 0 && resolvedOrigin === null;
  const destination = AIRPORTS_BY_IATA.get(venue.nearestAirport);

  const accent = context.sport?.accent ?? "#3b82f6";
  const value = bestValue(tickets);

  // Local transport is part of the total, so it needs its own column — without
  // one, tickets + travel + stay visibly fail to add up to the figure shown.
  const showsLocalTransport =
    estimate.localTransport !== null && estimate.localTransport.amount > 0;

  // Render from the shared breakdown rather than formatting each component
  // independently. Rounding four values separately and printing an
  // independently-rounded total left the visible column short by a unit — small,
  // but the kind of small wrongness that makes a price comparison untrustworthy.
  const breakdown = tripBreakdown(estimate, travellers, nights);
  const [ticketPart, travelPart, stayPart, transportPart] = breakdown.parts;

  // Cheapest listing per marketplace — the core comparison.
  const byMarketplace = new Map<string, TicketListing>();
  for (const listing of tickets) {
    const current = byMarketplace.get(listing.marketplace);
    if (!current || listing.total.amount < current.total.amount) {
      byMarketplace.set(listing.marketplace, listing);
    }
  }
  const marketplaceRows = [...byMarketplace.values()].sort(
    (a, b) => a.total.amount - b.total.amount,
  );
  const bestTotal = marketplaceRows[0]?.total.amount ?? 0;

  // Cheapest listing per seating tier, so "cheap" and "good" are both visible.
  const byTier = new Map<string, TicketListing>();
  for (const listing of tickets) {
    const current = byTier.get(listing.section);
    if (!current || listing.total.amount < current.total.amount) {
      byTier.set(listing.section, listing);
    }
  }
  // Only listings that actually report a seat quality belong in the "where to
  // sit" breakdown — a live provider returning aggregate prices has no seat
  // detail to place, and a rendered quality bar there would be invented.
  const tierRows = [...byTier.values()]
    .filter((l): l is typeof l & { seatQuality: number } => l.seatQuality !== null)
    .sort((a, b) => a.seatQuality - b.seatQuality);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="wash" style={{ ["--wash-color" as string]: accent }} />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <Breadcrumbs
            items={[
              { label: "Sports", href: "/" },
              {
                label: context.sport?.name ?? "Sport",
                href: `/sports/${event.sportId}`,
              },
              {
                label: context.league?.shortName ?? "League",
                href: `/leagues/${event.leagueId}`,
              },
              { label: context.title },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            {event.isMarquee && <Badge tone="warn">Championship</Badge>}
            {event.kind === "playoff" && <Badge tone="accent">Playoff</Badge>}
            {event.demandScore >= 85 && <Badge tone="hot">High demand</Badge>}
          </div>

          <div className="mt-4 flex items-start gap-4">
            {context.homeTeam && context.awayTeam && (
              <div className="hidden shrink-0 items-center -space-x-2 sm:flex">
                <TeamMark
                  name={context.awayTeam.name}
                  abbreviation={context.awayTeam.abbreviation}
                  logoUrl={context.awayTeam.logoUrl}
                  primary={context.awayTeam.primaryColor}
                  secondary={context.awayTeam.secondaryColor}
                  size={48}
                />
                <TeamMark
                  name={context.homeTeam.name}
                  abbreviation={context.homeTeam.abbreviation}
                  logoUrl={context.homeTeam.logoUrl}
                  primary={context.homeTeam.primaryColor}
                  secondary={context.homeTeam.secondaryColor}
                  size={48}
                />
              </div>
            )}
            <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">
              {context.title}
            </h1>
          </div>

          <p className="mt-4 text-[15px] text-ink-2">
            {formatDateRange(event.startsAt, event.endsAt)}
            {!event.endsAt && ` · ${formatTime(event.startsAt)}`}
          </p>
          <p className="text-[14px] text-ink-3">
            {venue.name}, {venue.city} · capacity{" "}
            {venue.capacity.toLocaleString("en-US")}
          </p>

          {event.notes && (
            <p className="mt-6 max-w-2xl border-l-2 border-line-bright pl-4 text-[13.5px] leading-relaxed text-ink-2">
              {event.notes}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        {/* Trip planner — a plain GET form, so it works without JavaScript
            and every configured trip is a shareable URL. */}
        <form
          method="get"
          className="border-b border-line pb-8"
        >
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-2 block text-[12.5px] text-ink-3">
                Travelling from
              </span>
              <input
                name="origin"
                defaultValue={origin}
                placeholder="London, Tokyo, LAX…"
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[12.5px] text-ink-3">
                Travellers
              </span>
              <input
                name="travellers"
                type="number"
                min={1}
                max={12}
                defaultValue={travellers}
                className="tabular w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[12.5px] text-ink-3">
                Nights
              </span>
              <input
                name="nights"
                type="number"
                min={1}
                max={14}
                defaultValue={nights}
                className="tabular w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-accent"
              />
            </label>

            <button
              type="submit"
              className="rounded-lg bg-ink px-5 py-2.5 text-[14px] font-semibold text-surface transition-opacity hover:opacity-90"
            >
              Price the trip
            </button>
          </div>

          {originUnresolved && (
            <p className="mt-3 text-[13px] text-warn">
              Couldn&apos;t match &ldquo;{origin}&rdquo; to an airport. Try a
              major city or an IATA code (LHR, JFK, NRT).
            </p>
          )}
        </form>

        {/* Total cost */}
        <section className="mt-10">
          <div>
            <h2 className="text-[22px] font-bold tracking-[-0.02em]">
              What it costs to be there
            </h2>
            <p className="mt-1 text-[13px] text-ink-3">
              {travellers} {travellers === 1 ? "traveller" : "travellers"} ·{" "}
              {nights} {nights === 1 ? "night" : "nights"}
              {resolvedOrigin
                ? ` · from ${resolvedOrigin.city} (${resolvedOrigin.iata})`
                : " · tickets only, add an origin for travel"}
            </p>
          </div>

          <div
            className={`mt-7 grid gap-y-7 border-t border-line pt-7 sm:gap-x-8 ${
              showsLocalTransport ? "sm:grid-cols-5" : "sm:grid-cols-4"
            }`}
          >
            <CostCell
              label="Tickets"
              sub={
                estimate.ticket
                  ? `${travellers} × ${formatMoney(estimate.ticket.total)} · ${MARKETPLACE_LABELS[estimate.ticket.marketplace]}`
                  : "No listings"
              }
              value={ticketPart.value ? formatMoney(ticketPart.value) : "—"}
            />
            <CostCell
              label="Getting there"
              sub={
                estimate.travel
                  ? `${estimate.travel.carrier} · ${formatDuration(estimate.travel.durationMinutes)}`
                  : resolvedOrigin
                    ? "Already local"
                    : "Add an origin"
              }
              value={travelPart.value ? formatMoney(travelPart.value) : "—"}
            />
            <CostCell
              label="Stay"
              sub={
                estimate.stay
                  ? `${nights} × ${formatMoney(estimate.stay.pricePerNight)} · ${approachDescription(estimate.stay.distanceToVenueM)}`
                  : "No stays found"
              }
              value={stayPart.value ? formatMoney(stayPart.value) : "—"}
            />
            {showsLocalTransport && (
              <CostCell
                label="Local transport"
                sub={`${nights} × return trip to the ground`}
                value={transportPart.value ? formatMoney(transportPart.value) : "—"}
              />
            )}

            <div>
              <p className="text-[12.5px] font-medium text-ink">Total</p>
              {breakdown.total ? (
                <>
                  <p
                    className="tabular mt-1 text-2xl font-black tracking-tight"
                    style={{ color: accent }}
                  >
                    {formatMoney(breakdown.total)}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-3">
                    everything in
                  </p>
                </>
              ) : (
                // Components came back in different currencies. Converting
                // without a live FX rate would be a guess, and adding the
                // numbers regardless would be a lie — so say what happened.
                <>
                  <p className="mt-1 text-lg font-bold tracking-tight text-warn">
                    Mixed currencies
                  </p>
                  <p className="mt-1 text-[12px] text-ink-3">
                    Priced in {estimate.totalCurrencies.join(" + ")} — no single
                    total without a conversion rate
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Marketplace comparison */}
        <section className="mt-14">
          {trip.ticketsSynthetic ? (
            <p className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-warn/25 bg-warn/[0.06] px-4 py-3 text-[13px] text-warn">
              <Badge tone="warn">Modelled</Badge>
              These prices are generated, not live quotes. Add a marketplace API
              key to <code className="font-mono">.env.local</code> to show real
              inventory.
            </p>
          ) : (
            <p className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-positive/25 bg-positive/[0.06] px-4 py-3 text-[13px] text-positive">
              <Badge tone="positive">Live</Badge>
              Prices fetched from {trip.ticketSources.join(", ")}.
            </p>
          )}

          <SectionHeading
            eyebrow="Tickets"
            title={
              marketplaceRows.length === 1
                ? "Available pricing"
                : `Same event, ${marketplaceRows.length} prices`
            }
            action={
              trip.spreadPct > 0 && (
                <span className="text-[13px] text-ink-2">
                  <span className="font-semibold text-positive">
                    {formatMoneyCents(trip.savingVsWorst)} saved
                  </span>{" "}
                  vs the dearest site
                </span>
              )
            }
          />

          {marketplaceRows.length === 0 ? (
            <EmptyState
              title="No listings available"
              description="No marketplace currently has inventory for this event."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    <th className="px-5 py-3 font-semibold">Marketplace</th>
                    <th className="px-5 py-3 font-semibold">Cheapest seat</th>
                    <th className="px-5 py-3 text-right font-semibold">Face</th>
                    <th className="px-5 py-3 text-right font-semibold">Fees</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      All-in
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">Diff</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {marketplaceRows.map((listing, i) => {
                    const diff = listing.total.amount - bestTotal;
                    return (
                      <tr
                        key={listing.marketplace}
                        className={i === 0 ? "bg-positive/[0.04]" : undefined}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold">
                              {MARKETPLACE_LABELS[listing.marketplace]}
                            </span>
                            {i === 0 && <Badge tone="positive">Cheapest</Badge>}
                            {!listing.isResale && i !== 0 && (
                              <Badge tone="neutral">Primary</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-ink-2">
                          {listing.section}
                          {listing.row && (
                            <span className="text-ink-3"> · Row {listing.row}</span>
                          )}
                        </td>
                        <td className="tabular px-5 py-3.5 text-right text-[13px] text-ink-2">
                          {formatMoney(listing.price)}
                        </td>
                        <td className="tabular px-5 py-3.5 text-right text-[13px] text-ink-3">
                          +{formatMoney(listing.fees)}
                          {listing.feesEstimated && (
                            <span className="text-ink-3">*</span>
                          )}
                        </td>
                        <td className="tabular px-5 py-3.5 text-right text-[14px] font-bold">
                          {formatMoney(listing.total)}
                        </td>
                        <td className="tabular px-5 py-3.5 text-right text-[13px]">
                          {diff === 0 ? (
                            <span className="text-positive">best</span>
                          ) : (
                            <span className="text-hot">
                              +{formatMoneyCents(diff)}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <a
                            href={listing.deepLink}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-[13px] font-medium text-accent hover:underline"
                          >
                            Go →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {marketplaceRows.some((l) => l.feesEstimated) && (
            <p className="mt-4 text-[12.5px] text-ink-3">
              * Estimated from each marketplace&apos;s published fee rate. Most
              ticketing APIs return pre-fee prices, so the exact total is only
              confirmed at their checkout.
            </p>
          )}

          {value && (
            <p className="mt-5 text-[13.5px] leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">Best value:</span>{" "}
              {value.section} on {MARKETPLACE_LABELS[value.marketplace]} at{" "}
              <span className="tabular font-semibold">
                {formatMoney(value.total)}
              </span>{" "}
              — the most seat quality per dollar, not simply the cheapest row in
              the building.
            </p>
          )}
        </section>

        {/* Seating tiers */}
        {tierRows.length > 0 && (
          <section className="mt-14">
            <SectionHeading
              eyebrow="Where to sit"
              title="Cheapest in each part of the ground"
            />
            <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {tierRows.map((listing) => (
                <div
                  key={listing.section}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-semibold">{listing.section}</p>
                    <p className="tabular shrink-0 text-[15px] font-bold">
                      {formatMoney(listing.total)}
                    </p>
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${listing.seatQuality}%`,
                        background: accent,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[12px] text-ink-3">
                    View quality {listing.seatQuality}/100 ·{" "}
                    {MARKETPLACE_LABELS[listing.marketplace]}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Travel */}
        <section className="mt-14">
          <SectionHeading
            eyebrow="Getting there"
            title={
              resolvedOrigin
                ? `${resolvedOrigin.city} → ${destination?.city ?? venue.city}`
                : "Getting there"
            }
          />

          {!resolvedOrigin ? (
            <EmptyState
              title="Add where you're starting from"
              description="Enter any city or airport above and we'll price flights, rail, and coach timed to land before the event starts."
            />
          ) : travel.length === 0 ? (
            <EmptyState
              title="You're already there"
              description={`${resolvedOrigin.city} is the venue's local airport — no travel leg needed.`}
            />
          ) : (
            <div className="divide-y divide-line border-y border-line">
              {travel.map((option) => (
                <div
                  key={option.id}
                  className="flex flex-wrap items-center gap-4 py-4"
                >
                  <span className="w-16 shrink-0 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                    {option.mode}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold">{option.carrier}</p>
                    <p className="tabular text-[12.5px] text-ink-3">
                      {option.fromCode} → {option.toCode} ·{" "}
                      {formatDuration(option.durationMinutes)} ·{" "}
                      {option.stops === 0
                        ? "direct"
                        : `${option.stops} stop${option.stops > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-[15px] font-bold">
                      {formatMoney(option.price)}
                    </p>
                    <p className="text-[11.5px] text-ink-3">
                      {travellers} {travellers === 1 ? "person" : "people"}
                    </p>
                  </div>
                  <a
                    href={option.deepLink}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-[13px] font-medium text-accent hover:underline"
                  >
                    Book →
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Stays */}
        <section className="mt-14">
          <SectionHeading
            eyebrow="Somewhere to sleep"
            title={`Stays near ${venue.name}`}
            action={
              <span className="text-[13px] text-ink-3">
                Ranked by true cost — room plus getting to the ground
              </span>
            }
          />

          <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {stays.slice(0, 9).map((stay) => {
              const surcharge = transportSurchargePerNight(stay.distanceToVenueM);
              return (
              <a
                key={stay.id}
                href={stay.deepLink}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="group -mx-3 rounded-lg border-t border-line px-3 pb-4 pt-4 transition-colors hover:bg-surface-2/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">
                      {stay.name}
                    </p>
                    <p className="text-[12px] capitalize text-ink-3">{stay.kind}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-[15px] font-bold">
                      {formatMoney(stay.pricePerNight)}
                    </p>
                    <p className="text-[11px] text-ink-3">per night</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 text-[12px]">
                  <span className="tabular rounded-md bg-surface-3 px-1.5 py-0.5 font-semibold">
                    {stay.rating.toFixed(1)}
                  </span>
                  <span className="text-ink-3">
                    {stay.reviewCount.toLocaleString("en-US")} reviews
                  </span>
                </div>

                <p className="mt-2.5 text-[12.5px] text-ink-2">
                  {formatDistance(stay.distanceToVenueM)} from the ground ·{" "}
                  {approachDescription(stay.distanceToVenueM)}
                </p>

                {surcharge > 0 ? (
                  <p className="mt-1 text-[12px] text-warn">
                    + about {formatMoneyCents(surcharge)}/night getting there and
                    back
                  </p>
                ) : (
                  <p className="mt-1 text-[12px] text-positive">
                    Walkable — no transport needed
                  </p>
                )}

                <p className="mt-2 truncate text-[11.5px] text-ink-3">
                  {stay.amenities.join(" · ")}
                </p>
              </a>
              );
            })}
          </div>
        </section>

        {trip.notices.length > 0 && (
          <p className="mt-10 rounded-xl border border-warn/25 bg-warn/[0.06] px-4 py-3 text-[13px] text-warn">
            Some providers didn&apos;t respond: {trip.notices.join("; ")}. Prices
            shown are from the providers that did.
          </p>
        )}

        <div className="mt-12 flex flex-wrap gap-3 text-[13px]">
          {context.homeTeam && (
            <Link
              href={`/teams/${context.homeTeam.id}`}
              className="rounded-lg border border-line bg-surface px-4 py-2 font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              All {context.homeTeam.name} fixtures
            </Link>
          )}
          {context.awayTeam && (
            <Link
              href={`/teams/${context.awayTeam.id}`}
              className="rounded-lg border border-line bg-surface px-4 py-2 font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              All {context.awayTeam.name} fixtures
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

function CostCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <p className="text-[12.5px] text-ink-3">{label}</p>
      <p className="tabular mt-1.5 text-[22px] font-semibold tracking-[-0.02em]">
        {value}
      </p>
      <p className="mt-1 text-[12.5px] leading-snug text-ink-3">{sub}</p>
    </div>
  );
}
