"use client";

import { useEffect, useId, useRef, useState } from "react";

/** [city, country code, airport code, airport name, lat, lon] from /api/cities. */
type City = [string, string, string, string, number, number];

let cities: Promise<City[]> | null = null;
const loadCities = () =>
  (cities ??= fetch("/api/cities")
    .then((r) => r.json() as Promise<City[]>)
    .catch(() => {
      cities = null;
      return [];
    }));

const POPULAR = ["New York", "Los Angeles", "Chicago", "London", "Toronto", "Dallas", "Houston", "Miami", "Boston", "San Francisco"];

const key = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\./g, "").replace(/\bsaint\b/g, "st").trim();

const flag = (cc: string) =>
  /^[A-Z]{2}$/i.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "✈️";

const regions = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const countryName = (cc: string) => {
  if (cc === "GB") return "UK";
  if (cc === "US") return "USA";
  try {
    return regions?.of(cc) ?? cc;
  } catch {
    return cc;
  }
};

/** Best matches first: the city's name, then a word in it, then the airport or its code. */
function match(list: City[], q: string): City[] {
  const k = key(q);
  if (!k) return POPULAR.flatMap((p) => {
    const c = list.find((x) => x[0] === p);
    return c ? [c] : [];
  });
  const scored: [number, City][] = [];
  for (const c of list) {
    const city = key(c[0]);
    const score =
      city === k || c[2].toLowerCase() === k ? 0
      : city.startsWith(k) ? 1
      : city.split(/[\s-]/).some((w) => w.startsWith(k)) ? 2
      : key(c[3]).split(/[\s-/]/).some((w) => w.startsWith(k)) ? 3
      : null;
    if (score !== null) scored.push([score, c]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, 8).map(([, c]) => c);
}

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/**
 * A "where are you coming from" box with a dropdown of cities: popular ones
 * on focus, matches as you type, and "Use my location" for the nearest one.
 * Free text still works; the server resolves it the same way.
 */
export function CityInput({
  name,
  defaultValue = "",
  placeholder,
  ariaLabel,
  className = "",
  inputClassName,
  submitOnPick = false,
  onPick,
  onValueChange,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  inputClassName: string;
  /** Submit the surrounding form as soon as a city is chosen. */
  submitOnPick?: boolean;
  onPick?: (city: string) => void;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [list, setList] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const close = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    if (open && !list.length) loadCities().then(setList);
  }, [open, list.length]);

  const items = match(list, value);
  // Row 0 is "Use my location"; cities follow.
  const rows = 1 + items.length;

  const change = (v: string) => {
    setValue(v);
    onValueChange?.(v);
    setActive(-1);
    setOpen(true);
  };
  const pick = (city: string) => {
    setValue(city);
    onValueChange?.(city);
    setOpen(false);
    onPick?.(city);
    if (submitOnPick) {
      const form = input.current?.form;
      // After React has written the new value into the input.
      setTimeout(() => form?.requestSubmit(), 0);
    }
  };
  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const all = await loadCities();
        const { latitude, longitude } = pos.coords;
        const near = all.reduce<City | null>(
          (best, c) => (!best || km(latitude, longitude, c[4], c[5]) < km(latitude, longitude, best[4], best[5]) ? c : best),
          null,
        );
        setLocating(false);
        if (near) pick(near[0]);
      },
      () => setLocating(false),
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <input
        ref={input}
        name={name}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % rows);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? rows - 1 : i - 1));
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Enter" && open && active >= 0) {
            e.preventDefault();
            if (active === 0) locate();
            else pick(items[active - 1][0]);
          } else if (e.key === "Tab") {
            setOpen(false);
          }
        }}
        className={inputClassName}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 max-h-[min(60vh,380px)] w-full min-w-[260px] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 text-left text-ink shadow-lg"
        >
          <li id={`${listId}-0`} role="option" aria-selected={active === 0}>
            <button
              type="button"
              onClick={locate}
              onMouseEnter={() => setActive(0)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold text-accent ${active === 0 ? "bg-surface-2" : ""}`}
            >
              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-[16px]">
                📍
              </span>
              {locating ? "Finding you…" : "Use my location"}
            </button>
          </li>
          {!value.trim() && items.length > 0 && (
            <li className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3" aria-hidden>
              Popular
            </li>
          )}
          {items.map((c, i) => (
            <li key={`${c[0]}-${c[1]}`} id={`${listId}-${i + 1}`} role="option" aria-selected={active === i + 1}>
              <button
                type="button"
                onClick={() => pick(c[0])}
                onMouseEnter={() => setActive(i + 1)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${active === i + 1 ? "bg-surface-2" : ""}`}
              >
                <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-[18px]">
                  {flag(c[1])}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{c[0]}</span>
                  <span className="block truncate text-[13px] text-ink-3">
                    {countryName(c[1])} · {c[3]}
                  </span>
                </span>
                <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px] font-bold tracking-wide text-ink-2">
                  {c[2]}
                </span>
              </button>
            </li>
          ))}
          {value.trim() && list.length > 0 && items.length === 0 && (
            <li className="px-3 py-3 text-[14px] text-ink-3">
              No airport found for &ldquo;{value.trim()}&rdquo;. Try the nearest big city.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
