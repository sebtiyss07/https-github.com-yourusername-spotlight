import type { Money } from "@/lib/domain/types";

/**
 * Display helpers.
 *
 * All formatting is pinned to a fixed locale ("en-GB" for dates, "en-US" for
 * currency). Using the runtime default would format differently on the server
 * than in the user's browser and produce a hydration mismatch on every price on
 * the page.
 */

const CURRENCY_CACHE = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, decimals: number): Intl.NumberFormat {
  const key = `${currency}:${decimals}`;
  let fmt = CURRENCY_CACHE.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    CURRENCY_CACHE.set(key, fmt);
  }
  return fmt;
}

/** Money is stored in minor units; never divide before formatting. */
export function formatMoney(money: Money, decimals = 0): string {
  return currencyFormatter(money.currency, decimals).format(
    money.amount / 100,
  );
}

/** A price exactly as a site listed it, in whole units: $310, $214.23. */
export function formatPrice(amount: number, currency = "USD"): string {
  return formatMoney(
    { amount: Math.round(amount * 100), currency },
    Number.isInteger(amount) ? 0 : 2,
  );
}

export function formatMoneyCents(amount: number, currency = "USD"): string {
  return formatMoney({ amount, currency });
}

/**
 * Dates and times are always shown in the venue's own time zone. Stored
 * instants are UTC, and printing them as-is put Thursday-night US games on
 * "Friday". Formatters are built per zone and cached.
 */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function fmt(
  key: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-GB",
): Intl.DateTimeFormat {
  const id = `${key}:${timeZone}`;
  let f = FORMATTERS.get(id);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    FORMATTERS.set(id, f);
  }
  return f;
}

/** "Thursday 24 September 2026" */
export function formatFullDate(iso: string, timeZone: string): string {
  return fmt("full", timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** "Thursday 24 September" — spelled out, no abbreviations to decode. */
export function formatDayMonth(iso: string, timeZone: string): string {
  return fmt("daymonth", timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/** "4:00 PM" at the venue. */
export function formatTime(iso: string, timeZone: string): string {
  return fmt(
    "time",
    timeZone,
    { hour: "numeric", minute: "2-digit", hour12: true },
    "en-US",
  ).format(new Date(iso));
}

/** "29 October – 12 November 2026", in the venue's zone. */
export function formatDateRange(
  startIso: string,
  endIso: string | undefined,
  timeZone: string,
): string {
  if (!endIso) return formatFullDate(startIso, timeZone);
  const dayMonth = fmt("dm", timeZone, { day: "numeric", month: "long" });
  return `${dayMonth.format(new Date(startIso))} – ${fmt("dmy", timeZone, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(endIso))}`;
}

/** Pieces for a calendar tile: { weekday: "Thu", day: "24", month: "Sep" }. */
export function dateParts(iso: string, timeZone: string) {
  const parts = fmt("parts", timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: get("weekday"), day: get("day"), month: get("month") };
}

/** A calendar date like "2026-09-30" → "Wed 30 Sep". */
export function formatShortDate(date: string): string {
  return fmt("shortdate", "UTC", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** A calendar date like "2026-09-30" → "Wednesday 30 September". */
export function formatLocalDate(date: string): string {
  return formatDayMonth(`${date}T12:00:00Z`, "UTC");
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}


/** Walking time at a realistic 80 m/min through event-day crowds. */
export function walkingMinutes(metres: number): number {
  return Math.round(metres / 80);
}

/**
 * How you'd actually get to the ground from a given distance.
 *
 * Quoting "93 min walk" for somewhere 7.5km out is technically true and
 * practically useless — nobody walks that to a match. Past the walkable band we
 * describe the trip people will really take.
 */
export function approachDescription(metres: number): string {
  if (metres <= 2_200) return `${walkingMinutes(metres)} min walk`;
  if (metres <= 8_000) {
    return `~${Math.max(8, Math.round(metres / 380))} min by transit`;
  }
  return `~${Math.max(12, Math.round(metres / 600))} min by cab`;
}
