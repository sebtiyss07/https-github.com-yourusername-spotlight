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

export function formatMoneyCents(amount: number, currency = "USD"): string {
  return formatMoney({ amount, currency });
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const DATE_FULL_FMT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

export function formatFullDate(iso: string): string {
  return DATE_FULL_FMT.format(new Date(iso));
}

/**
 * Kick-off time. Not labelled "local" — the seed generator writes plain UTC
 * instants, so claiming a venue-local time would be wrong. Once a real feed
 * supplies proper venue offsets (see `SportEvent.startsAt`), format against the
 * venue's IANA zone and the label can come back.
 */
export function formatTime(iso: string): string {
  return `${TIME_FMT.format(new Date(iso))} UTC`;
}

export function formatDateRange(startIso: string, endIso?: string): string {
  if (!endIso) return formatFullDate(startIso);
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCFullYear() === end.getUTCFullYear();

  if (sameMonth) {
    const month = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(start);
    return `${start.getUTCDate()}–${end.getUTCDate()} ${month}`;
  }
  return `${formatDate(startIso)} – ${formatFullDate(endIso)}`;
}

/** "in 3 days" / "in 4 months" — the framing that matters when booking. */
export function formatCountdown(iso: string): string {
  const diffMs = Date.parse(iso) - Date.now();
  if (diffMs < 0) return "Started";

  const hours = Math.floor(diffMs / 3600_000);
  if (hours < 1) return "Starting soon";
  if (hours < 24) return `in ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 31) return `in ${days} day${days === 1 ? "" : "s"}`;

  const months = Math.round(days / 30.4);
  if (months < 12) return `in ${months} month${months === 1 ? "" : "s"}`;

  const years = (days / 365).toFixed(1);
  return `in ${years} years`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres}m`;
  return `${(metres / 1000).toFixed(1)}km`;
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

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatFans(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B fans`;
  }
  return `${Math.round(value / 1_000_000)}M fans`;
}
