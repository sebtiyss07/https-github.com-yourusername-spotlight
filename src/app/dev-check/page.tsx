import { notFound } from "next/navigation";
import { scoreCandidate, MIN_CONFIDENCE } from "@/lib/providers/tickets/matching";
import { parseIsoDuration } from "@/lib/providers/travel/amadeus";
import { collect } from "@/lib/providers";
import { isValidMoney, sumMoney } from "@/lib/money";
import type { ProviderResult } from "@/lib/providers/types";

/**
 * Provider logic checks — visit /dev-check in development.
 *
 * Exercises the two rules that decide whether live pricing can be trusted,
 * neither of which needs an API key to verify:
 *
 *   1. Resolver scoring — that a wrong-date or wrong-teams candidate is
 *      *rejected*. Both of these initially passed, which is how this file
 *      earned its keep.
 *   2. Synthetic suppression — that seeded prices vanish the moment a real
 *      provider has inventory.
 *
 * This exists as a route rather than a test file because the project has no
 * test runner yet; move it to one when that changes. It 404s outside
 * development so it can't ship.
 */

interface Item {
  id: string;
  price: number;
}

function fakeProvider(
  name: string,
  synthetic: boolean,
  items: Item[],
  enabled = true,
) {
  return {
    name,
    enabled,
    synthetic,
    async search(): Promise<ProviderResult<Item>> {
      return {
        items,
        sources: [name],
        errors: [],
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}

export default async function DevCheck() {
  if (process.env.NODE_ENV === "production") notFound();

  // --- Resolver scoring ---------------------------------------------------
  const expected = {
    teamNames: ["Boston Celtics", "Los Angeles Lakers"],
    venueName: "TD Garden",
    startsAt: "2026-11-14T00:30:00.000Z",
  };

  const scoreCases = [
    {
      label: "exact match",
      candidate: {
        id: "a",
        name: "Boston Celtics vs. Los Angeles Lakers",
        startsAt: "2026-11-14T00:30:00Z",
        venueName: "TD Garden",
      },
      shouldAccept: true,
    },
    {
      label: "right teams, wrong week",
      candidate: {
        id: "b",
        name: "Boston Celtics vs. Los Angeles Lakers",
        startsAt: "2026-12-02T00:30:00Z",
        venueName: "TD Garden",
      },
      shouldAccept: false,
    },
    {
      label: "right night, different game",
      candidate: {
        id: "c",
        name: "Boston Bruins vs. Montreal Canadiens",
        startsAt: "2026-11-14T00:30:00Z",
        venueName: "TD Garden",
      },
      shouldAccept: false,
    },
    {
      label: "renamed venue, same fixture",
      candidate: {
        id: "d",
        name: "Boston Celtics vs Los Angeles Lakers",
        startsAt: "2026-11-14T02:00:00Z",
        venueName: "TD Garden presented by Rapid7",
      },
      shouldAccept: true,
    },
    {
      label: "no date on candidate → unverifiable",
      candidate: {
        id: "e",
        name: "Boston Celtics vs. Los Angeles Lakers",
        venueName: "TD Garden",
      },
      shouldAccept: false,
    },
    {
      label: "same teams, neutral-site preseason",
      candidate: {
        id: "f",
        name: "NBA Preseason: Celtics vs Lakers",
        startsAt: "2026-11-16T02:00:00Z",
        venueName: "Etihad Arena Abu Dhabi",
      },
      shouldAccept: false,
    },
  ].map((c) => {
    const { score } = scoreCandidate(c.candidate, expected);
    const accepted = score >= MIN_CONFIDENCE;
    return { ...c, score, accepted, pass: accepted === c.shouldAccept };
  });

  // --- Synthetic suppression ---------------------------------------------
  const cmp = (a: Item, b: Item) => a.price - b.price;

  const suppressionCases = [
    {
      label: "real provider has inventory → synthetic dropped",
      result: await collect(
        [
          fakeProvider("seeded", true, [{ id: "fake-cheap", price: 92 }]),
          fakeProvider("ticketmaster", false, [{ id: "real", price: 180 }]),
        ],
        {},
        cmp,
      ),
      expectIds: ["real"],
      expectSynthetic: false,
    },
    {
      label: "real provider empty → synthetic kept",
      result: await collect(
        [
          fakeProvider("seeded", true, [{ id: "fake", price: 92 }]),
          fakeProvider("ticketmaster", false, []),
        ],
        {},
        cmp,
      ),
      expectIds: ["fake"],
      expectSynthetic: true,
    },
    {
      label: "real provider disabled → synthetic kept",
      result: await collect(
        [
          fakeProvider("seeded", true, [{ id: "fake", price: 92 }]),
          fakeProvider("ticketmaster", false, [{ id: "real", price: 180 }], false),
        ],
        {},
        cmp,
      ),
      expectIds: ["fake"],
      expectSynthetic: true,
    },
  ].map((c) => {
    const ids = c.result.items.map((i) => i.id);
    const pass =
      JSON.stringify(ids) === JSON.stringify(c.expectIds) &&
      c.result.synthetic === c.expectSynthetic;
    return { ...c, ids, pass };
  });

  // --- Amadeus duration parsing -------------------------------------------
  // ISO 8601 durations are easy to get subtly wrong: hours-only has no minute
  // component, and multi-day itineraries carry a D before the T.
  const durationCases = [
    { input: "PT2H30M", expect: 150 },
    { input: "PT45M", expect: 45 },
    { input: "PT11H", expect: 660 },
    { input: "P1DT3H20M", expect: 1640 },
    { input: undefined, expect: 0 },
    { input: "garbage", expect: 0 },
  ].map((c) => {
    const actual = parseIsoDuration(c.input);
    return { ...c, actual, pass: actual === c.expect };
  });

  // --- Arrival-window filter ----------------------------------------------
  // The rule that makes flight results useful: land in time, but not two days
  // early. Mirrors the bounds in the Amadeus adapter.
  const MIN_BUFFER_HOURS = 3;
  const MAX_BUFFER_HOURS = 36;
  const kickoff = Date.parse("2026-11-14T00:30:00Z");

  const arrivalCases = [
    { label: "lands 6h before", arrivesAt: "2026-11-13T18:30:00Z", keep: true },
    { label: "lands 30min after kickoff", arrivesAt: "2026-11-14T01:00:00Z", keep: false },
    { label: "lands 1h before — too tight", arrivesAt: "2026-11-13T23:30:00Z", keep: false },
    { label: "lands 20h before", arrivesAt: "2026-11-13T04:30:00Z", keep: true },
    { label: "lands 3 days early", arrivesAt: "2026-11-11T00:30:00Z", keep: false },
  ].map((c) => {
    const gapHours = (kickoff - Date.parse(c.arrivesAt)) / 3_600_000;
    const kept = gapHours >= MIN_BUFFER_HOURS && gapHours <= MAX_BUFFER_HOURS;
    return { ...c, gapHours, kept, pass: kept === c.keep };
  });

  // --- Currency safety ----------------------------------------------------
  // The bug this guards: a GBP ticket plus a USD flight summed into a single
  // GBP-labelled figure. There is no honest total there, so there must be none.
  const gbp = (n: number) => ({ amount: n, currency: "GBP" });
  const usd = (n: number) => ({ amount: n, currency: "USD" });

  const moneyCases = [
    {
      label: "same currency sums",
      result: sumMoney([usd(1000), usd(500)]),
      expectTotal: 1500,
      expectMixed: false,
    },
    {
      label: "mixed currencies refuse to sum",
      result: sumMoney([gbp(18000), usd(125600)]),
      expectTotal: null,
      expectMixed: true,
    },
    {
      label: "nulls skipped, not zeroed",
      result: sumMoney([usd(1000), null, undefined]),
      expectTotal: 1000,
      expectMixed: false,
    },
    {
      label: "nothing at all → no total",
      result: sumMoney([null]),
      expectTotal: null,
      expectMixed: false,
    },
  ].map((c) => ({
    ...c,
    pass:
      (c.result.total?.amount ?? null) === c.expectTotal &&
      c.result.mixed === c.expectMixed,
  }));

  // --- Price validation ---------------------------------------------------
  // Guards the provider boundary: a malformed payload must not become "$0.00",
  // which reads to a user as a bargain rather than as broken code.
  const validityCases = [
    { label: "normal price", input: usd(18000), expect: true },
    { label: "zero", input: usd(0), expect: false },
    { label: "negative", input: usd(-500), expect: false },
    { label: "NaN", input: usd(Number.NaN), expect: false },
    { label: "bad currency code", input: { amount: 100, currency: "dollars" }, expect: false },
    { label: "null", input: null, expect: false },
  ].map((c) => ({ ...c, actual: isValidMoney(c.input), pass: isValidMoney(c.input) === c.expect }));

  const allPass =
    scoreCases.every((c) => c.pass) &&
    suppressionCases.every((c) => c.pass) &&
    durationCases.every((c) => c.pass) &&
    arrivalCases.every((c) => c.pass) &&
    moneyCases.every((c) => c.pass) &&
    validityCases.every((c) => c.pass);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 font-mono text-[13px]">
      <h1 className="mb-6 text-xl font-bold">
        {allPass ? "✅ ALL PASS" : "❌ FAILURES"}
      </h1>

      <h2 className="mb-2 mt-8 font-bold">
        Resolver scoring (threshold {MIN_CONFIDENCE})
      </h2>
      {scoreCases.map((c) => (
        <p key={c.candidate.id} className={c.pass ? "text-positive" : "text-hot"}>
          {c.pass ? "PASS" : "FAIL"} · {c.label} → {c.score.toFixed(3)}{" "}
          {c.accepted ? "accepted" : "rejected"} (wanted{" "}
          {c.shouldAccept ? "accept" : "reject"})
        </p>
      ))}

      <h2 className="mb-2 mt-8 font-bold">Synthetic suppression</h2>
      {suppressionCases.map((c) => (
        <p key={c.label} className={c.pass ? "text-positive" : "text-hot"}>
          {c.pass ? "PASS" : "FAIL"} · {c.label} → [{c.ids.join(", ")}]
          {" synthetic="}
          {String(c.result.synthetic)}
        </p>
      ))}

      <h2 className="mb-2 mt-8 font-bold">ISO 8601 duration parsing</h2>
      {durationCases.map((c) => (
        <p
          key={String(c.input)}
          className={c.pass ? "text-positive" : "text-hot"}
        >
          {c.pass ? "PASS" : "FAIL"} · {String(c.input)} → {c.actual}min (wanted{" "}
          {c.expect})
        </p>
      ))}

      <h2 className="mb-2 mt-8 font-bold">Currency safety</h2>
      {moneyCases.map((c) => (
        <p key={c.label} className={c.pass ? "text-positive" : "text-hot"}>
          {c.pass ? "PASS" : "FAIL"} · {c.label} → total=
          {String(c.result.total?.amount ?? null)} mixed=
          {String(c.result.mixed)}
          {c.result.mixed && ` [${c.result.currencies.join("+")}]`}
        </p>
      ))}

      <h2 className="mb-2 mt-8 font-bold">Price validation</h2>
      {validityCases.map((c) => (
        <p key={c.label} className={c.pass ? "text-positive" : "text-hot"}>
          {c.pass ? "PASS" : "FAIL"} · {c.label} → {String(c.actual)} (wanted{" "}
          {String(c.expect)})
        </p>
      ))}

      <h2 className="mb-2 mt-8 font-bold">
        Arrival window ({MIN_BUFFER_HOURS}–{MAX_BUFFER_HOURS}h before kickoff)
      </h2>
      {arrivalCases.map((c) => (
        <p key={c.label} className={c.pass ? "text-positive" : "text-hot"}>
          {c.pass ? "PASS" : "FAIL"} · {c.label} → {c.gapHours.toFixed(1)}h gap,{" "}
          {c.kept ? "kept" : "dropped"} (wanted {c.keep ? "keep" : "drop"})
        </p>
      ))}
    </div>
  );
}
