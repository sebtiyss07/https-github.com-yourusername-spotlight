"use client";

import { useEffect, useState } from "react";
import { FinderRowView, type FinderRow } from "@/components/MatchFinder";
import { CityInput } from "@/components/CityInput";

const DISTANCES = [25, 50, 100, 200];
const WHEN = [
  { days: 7, label: "This week" },
  { days: 30, label: "This month" },
  { days: 365, label: "Any time" },
];

type Where = { city: string } | { lat: number; lon: number };

/**
 * Games within driving distance, cheapest first. Uses a typed city or, if
 * the visitor allows it, the browser's location (only sent to our own
 * search, never stored).
 */
export function NearMe() {
  const [city, setCity] = useState("");
  const [where, setWhere] = useState<Where | null>(null);
  const [miles, setMiles] = useState(100);
  const [days, setDays] = useState(30);
  const [state, setState] = useState<{ loading: boolean; error?: string; games?: FinderRow[]; place?: string | null; total?: number; currency?: string }>({ loading: false });

  useEffect(() => {
    if (!where) return;
    const q = new URLSearchParams({ miles: String(miles), days: String(days) });
    if ("city" in where) q.set("city", where.city);
    else {
      q.set("lat", String(where.lat));
      q.set("lon", String(where.lon));
    }
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fetch(`/api/near?${q}`)
      .then((r) => r.json())
      .then((d) =>
        setState(
          d.error === "city"
            ? { loading: false, error: `We couldn't find "${"city" in where ? where.city : ""}". Try a bigger city nearby.` }
            : { loading: false, games: d.games, place: d.place, total: d.total, currency: d.currency },
        ),
      )
      .catch(() => setState({ loading: false, error: "Something went wrong. Please try again." }));
  }, [where, miles, days]);

  const locate = () => {
    if (!navigator.geolocation) return setState({ loading: false, error: "Your browser can't share its location. Type your city instead." });
    setState({ loading: true });
    navigator.geolocation.getCurrentPosition(
      (p) => setWhere({ lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100 }),
      () => setState({ loading: false, error: "Location wasn't shared. Type your city instead." }),
      { timeout: 10000 },
    );
  };

  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
      on ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-2 hover:border-accent hover:text-accent"
    }`;

  return (
    <div>
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (city.trim().length >= 2) setWhere({ city: city.trim() });
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <CityInput
            onValueChange={setCity}
            onPick={(c) => setWhere({ city: c })}
            placeholder="Pick your city, e.g. Chicago or London"
            ariaLabel="Your city"
            className="min-w-0 flex-1"
            inputClassName="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-[16px] outline-none focus:border-accent focus:bg-surface"
          />
          <button type="submit" className="rounded-xl bg-accent px-5 py-3 font-bold text-white hover:bg-accent-2">
            Find games
          </button>
          <button type="button" onClick={locate} className="rounded-xl border border-line px-4 py-3 font-semibold text-ink hover:border-accent hover:text-accent">
            📍 Use my location
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
          <span className="text-ink-3">Within</span>
          {DISTANCES.map((m) => (
            <button key={m} type="button" onClick={() => setMiles(m)} className={chip(m === miles)} aria-pressed={m === miles}>
              {m} miles
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
          <span className="text-ink-3">When</span>
          {WHEN.map((w) => (
            <button key={w.days} type="button" onClick={() => setDays(w.days)} className={chip(w.days === days)} aria-pressed={w.days === days}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {state.error && <p className="mt-4 font-semibold text-hot">{state.error}</p>}
      {state.loading && <p className="mt-4 text-ink-3">Finding games…</p>}
      {!state.loading && state.games && (
        <>
          <p className="mt-5 text-[15px] text-ink-2">
            <span className="font-semibold text-ink">{state.total} games</span> within {miles} miles
            {state.place ? ` of ${state.place}` : ""}, cheapest first.
          </p>
          {state.games.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-line-bright bg-surface px-5 py-8 text-center text-ink-2">
              Nothing with a price in that range yet. Try a wider distance or &ldquo;Any time&rdquo;.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {state.games.map((r) => (
                <li key={r.id}>
                  <FinderRowView row={r} currency={state.currency ?? "USD"} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
