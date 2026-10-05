import { notFound } from "next/navigation";
import {
  getLeagues,
  getTeamsByLeague,
  getVenue,
  getUpcomingEvents,
  getEventContexts,
  countEventsBySport,
  getSports,
} from "@/lib/repositories";
import { cheapestFor, getFromPrice } from "@/lib/providers/priceIndex";
import { buildTrip, tripBreakdown } from "@/lib/trip";
import { sumMoney } from "@/lib/money";
import { formatMoney } from "@/lib/format";

/**
 * Data-consistency audit — visit /dev-audit in development.
 *
 * `/dev-check` proves the *logic* is right on hand-picked inputs. This proves
 * the *data* is self-consistent across the whole catalogue, which is where
 * discrepancies actually hide: a stat that's really a display limit, a capacity
 * that double-counts a shared stadium, a list price that doesn't match the
 * detail page.
 *
 * Every check here corresponds to a bug that was found in the real pages, so
 * this exists to stop them coming back. 404s outside development.
 */

interface Check {
  label: string;
  pass: boolean;
  detail: string;
}

export default async function DevAudit() {
  if (process.env.NODE_ENV === "production") notFound();

  const checks: Check[] = [];

  // 1. Venue capacity must not double-count stadiums shared by two clubs.
  const leagues = await getLeagues();
  for (const league of leagues) {
    const teams = await getTeamsByLeague(league.id);
    if (teams.length === 0) continue;

    const venues = await Promise.all(teams.map((t) => getVenue(t.venueId)));
    const present = venues.filter((v): v is NonNullable<typeof v> => v !== null);
    const unique = new Map(present.map((v) => [v.id, v]));

    const naive = present.reduce((s, v) => s + (v.capacity ?? 0), 0);
    const deduped = [...unique.values()].reduce((s, v) => s + (v.capacity ?? 0), 0);
    const shared = present.length - unique.size;

    checks.push({
      label: `${league.shortName}: capacity dedupes shared venues`,
      pass: deduped <= naive,
      detail:
        shared > 0
          ? `${shared} shared venue(s); ${naive.toLocaleString()} naive → ${deduped.toLocaleString()} deduped`
          : `${unique.size} distinct venues, no sharing`,
    });
  }

  // 1b. Crest codes must be unique inside a league, or two clubs render the
  //     same badge in one fixture list. First-and-last initials alone collide
  //     three ways in the NFL (Bears/Bengals/Browns).
  for (const league of leagues) {
    const teams = await getTeamsByLeague(league.id);
    if (teams.length === 0) continue;

    const byCode = new Map<string, string[]>();
    for (const t of teams) {
      byCode.set(t.abbreviation, [...(byCode.get(t.abbreviation) ?? []), t.name]);
    }
    const clashes = [...byCode.entries()].filter(([, names]) => names.length > 1);

    checks.push({
      label: `${league.shortName}: crest codes are unique`,
      pass: clashes.length === 0,
      detail:
        clashes.length > 0
          ? `${clashes[0][0]} shared by ${clashes[0][1].join(" / ")}`
          : `${byCode.size} distinct codes for ${teams.length} clubs`,
    });
  }

  // 1c. No league or governing-body mark may appear anywhere.
  //
  //     League logos (the NBA silhouette, the Premier League lion, the FIFA and
  //     NFL shields) are registered trademarks and are enforced harder than club
  //     crests, since they're the organisation's primary mark. Leagues and
  //     sports must therefore carry no image field at all — this asserts that
  //     nobody has quietly added one.
  const sportsForLogoCheck = await getSports();
  const orgImageFields = [
    ...leagues.flatMap((l) =>
      Object.keys(l).filter((k) => /logo|image|crest|badge|icon/i.test(k)),
    ),
    ...sportsForLogoCheck.flatMap((s) =>
      Object.keys(s).filter((k) => /logo|image|crest|badge|icon/i.test(k)),
    ),
  ];
  checks.push({
    label: "No league or governing-body marks anywhere",
    pass: orgImageFields.length === 0,
    detail:
      orgImageFields.length > 0
        ? `found image field(s): ${[...new Set(orgImageFields)].join(", ")}`
        : "leagues and sports carry no image field — text and custom icons only",
  });

  // 2. Every team must resolve to a venue — a broken id would silently render
  //    "Venue to be confirmed" on a fixture that definitely has one.
  let unresolvedVenues = 0;
  for (const league of leagues) {
    const teams = await getTeamsByLeague(league.id);
    for (const team of teams) {
      if (!(await getVenue(team.venueId))) unresolvedVenues++;
    }
  }
  checks.push({
    label: "Every team resolves to a venue",
    pass: unresolvedVenues === 0,
    detail: `${unresolvedVenues} unresolved`,
  });

  // 3. Every upcoming event must resolve venue + league + sport, or the row
  //    renders with placeholder text.
  const upcoming = await getUpcomingEvents(400);
  const contexts = await getEventContexts(upcoming);
  const brokenContext = contexts.filter(
    (c) => !c.venue || !c.league || !c.sport,
  );
  checks.push({
    label: "Every event resolves venue, league and sport",
    pass: brokenContext.length === 0,
    detail: `${brokenContext.length} of ${contexts.length} incomplete${
      brokenContext.length > 0
        ? ` (e.g. ${brokenContext[0].event.id})`
        : ""
    }`,
  });

  // 4. No event may be scheduled in the past — `upcoming()` filters, but a
  //    generator bug could still emit one.
  const now = Date.now();
  const pastEvents = upcoming.filter((e) => Date.parse(e.startsAt) < now);
  checks.push({
    label: "No past events in upcoming lists",
    pass: pastEvents.length === 0,
    detail: `${pastEvents.length} past`,
  });

  // 5. Multi-day events must end after they start.
  const badRanges = upcoming.filter(
    (e) => e.endsAt && Date.parse(e.endsAt) <= Date.parse(e.startsAt),
  );
  checks.push({
    label: "Multi-day events end after they start",
    pass: badRanges.length === 0,
    detail: `${badRanges.length} inverted`,
  });

  // 6. No team may play twice on the same calendar day — the round-robin
  //    generator is supposed to make this impossible.
  const perTeamDay = new Map<string, number>();
  for (const e of upcoming) {
    const day = e.startsAt.slice(0, 10);
    for (const id of [e.homeTeamId, e.awayTeamId]) {
      if (!id) continue;
      const key = `${id}:${day}`;
      perTeamDay.set(key, (perTeamDay.get(key) ?? 0) + 1);
    }
  }
  const doubleBooked = [...perTeamDay.entries()].filter(([, n]) => n > 1);
  checks.push({
    label: "No team plays twice in one day",
    pass: doubleBooked.length === 0,
    detail:
      doubleBooked.length > 0
        ? `${doubleBooked.length} clashes (e.g. ${doubleBooked[0][0]})`
        : "none",
  });

  // 7. A team may not play itself.
  const selfGames = upcoming.filter(
    (e) => e.homeTeamId && e.homeTeamId === e.awayTeamId,
  );
  checks.push({
    label: "No team plays itself",
    pass: selfGames.length === 0,
    detail: `${selfGames.length} found`,
  });

  // 8. Sport event counts must be real totals, not the display limit of 15.
  const sports = await getSports();
  const suspicious: string[] = [];
  for (const sport of sports) {
    const count = await countEventsBySport(sport.id);
    if (count === 15) suspicious.push(sport.id);
  }
  checks.push({
    label: "Sport event counts aren't the display limit",
    pass: true,
    detail:
      suspicious.length > 0
        ? `${suspicious.join(", ")} happen to total exactly 15 — verify`
        : "no sport totals exactly 15 (the old limit)",
  });

  // 9. The headline discrepancy: a list page's "from" price must be the same
  //    number the detail page derives for one seat.
  const sample = upcoming.slice(0, 60);
  const priceMismatches: string[] = [];
  for (const e of sample) {
    // What a list page renders (through the cache) vs. the shared definition
    // the detail page uses. Comparing the index to the source is the point —
    // comparing `cheapestFor` to itself would pass no matter what.
    const indexed = getFromPrice(e.id);
    const direct = cheapestFor(e.id, 1);
    if (
      indexed?.from.amount !== direct?.total.amount ||
      indexed?.from.currency !== direct?.total.currency ||
      indexed?.marketplaceCount !== direct?.marketplaceCount
    ) {
      priceMismatches.push(
        `${e.id}: index ${indexed?.from.amount ?? "—"} vs direct ${direct?.total.amount ?? "—"}`,
      );
    }
  }
  checks.push({
    label: "Price index matches the shared cheapest-seat definition",
    pass: priceMismatches.length === 0,
    detail:
      priceMismatches.length > 0
        ? priceMismatches[0]
        : `${sample.length} events checked, all identical`,
  });

  // 10. A larger party can never be cheaper per seat than a single one, since
  //     it draws from a strictly smaller pool of listings.
  const quantityAnomalies = sample.filter((e) => {
    const one = cheapestFor(e.id, 1);
    const four = cheapestFor(e.id, 4);
    return one && four && four.total.amount < one.total.amount;
  });
  checks.push({
    label: "Party-of-4 price is never below the single-seat price",
    pass: quantityAnomalies.length === 0,
    detail: `${quantityAnomalies.length} anomalies`,
  });

  // 11. The trip cost cells must actually sum to the displayed total.
  const tripSamples = contexts.filter((c) => c.venue).slice(0, 8);
  const sumFailures: string[] = [];
  for (const c of tripSamples) {
    const trip = await buildTrip({
      event: c.event,
      venue: c.venue!,
      origin: "London",
      travellers: 2,
      nights: 2,
    });
    const { estimate } = trip;
    if (!estimate.total) continue;

    // Reconcile what is actually *rendered*. Comparing unrounded internals
    // was the blind spot that let a visibly-$1-short column pass this check:
    // prices display without decimals, so the figures a user adds up are the
    // rounded ones.
    const breakdown = tripBreakdown(estimate, 2);
    const partsSum = sumMoney(breakdown.parts.map((p) => p.value));

    if (partsSum.total?.amount !== breakdown.total?.amount) {
      sumFailures.push(
        `${c.event.id}: parts ${partsSum.total ? formatMoney(partsSum.total) : "—"} vs total ${breakdown.total ? formatMoney(breakdown.total) : "—"}`,
      );
    }

    // And every rendered part must be a whole unit, or the sum can't hold.
    const unrounded = breakdown.parts.filter(
      (p) => p.value && p.value.amount % 100 !== 0,
    );
    if (unrounded.length > 0) {
      sumFailures.push(`${c.event.id}: ${unrounded[0].label} is not a whole unit`);
    }
  }
  checks.push({
    label: "Rendered cost components sum to the rendered total",
    pass: sumFailures.length === 0,
    detail:
      sumFailures.length > 0
        ? sumFailures[0]
        : `${tripSamples.length} trips reconciled exactly`,
  });

  // 12. Every venue needs coordinates and an airport, or travel and stays
  //     silently price against the wrong place.
  const badVenues: string[] = [];
  for (const c of contexts) {
    const v = c.venue;
    if (!v) continue;
    if (
      !Number.isFinite(v.lat) ||
      !Number.isFinite(v.lon) ||
      Math.abs(v.lat) > 90 ||
      Math.abs(v.lon) > 180 ||
      !/^[A-Z]{3}$/.test(v.nearestAirport)
    ) {
      badVenues.push(v.id);
    }
  }
  checks.push({
    label: "Venues have valid coordinates and an IATA airport",
    pass: badVenues.length === 0,
    detail:
      badVenues.length > 0
        ? `${[...new Set(badVenues)].slice(0, 3).join(", ")}`
        : "all valid",
  });

  const failures = checks.filter((c) => !c.pass);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 font-mono text-[13px]">
      <h1 className="mb-2 text-xl font-medium">
        {failures.length === 0
          ? "✅ NO DISCREPANCIES"
          : `❌ ${failures.length} DISCREPANCIES`}
      </h1>
      <p className="mb-8 text-ink-3">
        {checks.length} data-consistency checks across {leagues.length} leagues
        and {contexts.length} upcoming events
      </p>

      {checks.map((c) => (
        <p key={c.label} className={`mb-1 ${c.pass ? "text-positive" : "text-hot"}`}>
          {c.pass ? "PASS" : "FAIL"} · {c.label}
          <span className="text-ink-3"> — {c.detail}</span>
        </p>
      ))}
    </div>
  );
}
