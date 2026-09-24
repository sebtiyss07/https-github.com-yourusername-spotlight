import type { Money } from "@/lib/domain/types";

/**
 * Currency-safe money arithmetic.
 *
 * Every value in the app is minor units (cents/pence) plus a currency code, and
 * the currency is not decoration. Ticketmaster quotes a London fixture in GBP;
 * Amadeus quotes the flight in USD. Adding those integers and labelling the sum
 * with either code produces a headline number that is simply false — which is
 * exactly the sort of thing a price-comparison product cannot ship.
 *
 * So there is no `add(a, b)` that silently coerces. Mixing currencies is a
 * condition the caller has to handle, and the UI's job is to say so rather than
 * invent a figure.
 *
 * Converting instead of refusing would need live FX rates — a fourth provider,
 * with its own staleness and failure modes. Worth doing eventually; not worth
 * faking with a hardcoded rate table that silently drifts.
 */

export function money(amount: number, currency = "USD"): Money {
  return { amount: Math.round(amount), currency };
}

export function multiplyMoney(value: Money, factor: number): Money {
  return { amount: Math.round(value.amount * factor), currency: value.currency };
}

export interface SumResult {
  /** Null when the parts don't share a currency — never a coerced figure. */
  total: Money | null;
  /** Every distinct currency seen, for the explanation shown to the user. */
  currencies: string[];
  mixed: boolean;
}

/**
 * Sums money that may span currencies. Nulls are skipped (a missing component
 * isn't a zero-cost one, but it also shouldn't block the rest of the total).
 */
export function sumMoney(parts: (Money | null | undefined)[]): SumResult {
  const present = parts.filter((p): p is Money => Boolean(p));

  if (present.length === 0) {
    return { total: null, currencies: [], mixed: false };
  }

  const currencies = [...new Set(present.map((p) => p.currency))];

  if (currencies.length > 1) {
    return { total: null, currencies, mixed: true };
  }

  return {
    total: {
      amount: present.reduce((sum, p) => sum + p.amount, 0),
      currency: currencies[0],
    },
    currencies,
    mixed: false,
  };
}

/**
 * Rounds to whole currency units — the precision the UI actually renders.
 *
 * Prices display without decimals, so the number a user sees is already
 * rounded. Reconciling a breakdown against the unrounded total is therefore the
 * wrong comparison: it can pass while the visible column of figures fails to
 * add up by a pound or two, which is exactly the kind of small wrongness that
 * makes someone stop trusting a price comparison.
 */
export function roundToUnit(value: Money): Money {
  return {
    amount: Math.round(value.amount / 100) * 100,
    currency: value.currency,
  };
}

/**
 * Builds a breakdown whose displayed parts are guaranteed to sum to its
 * displayed total.
 *
 * The total is the sum of the *rounded* parts, not a rounding of the exact
 * sum. That trades at most a unit of precision — on figures that are estimates
 * anyway — for a column of numbers that always adds up on screen.
 */
export function displayBreakdown(
  parts: { label: string; value: Money | null }[],
): { parts: { label: string; value: Money | null }[]; total: Money | null } {
  const rounded = parts.map((p) => ({
    label: p.label,
    value: p.value ? roundToUnit(p.value) : null,
  }));

  const { total } = sumMoney(rounded.map((p) => p.value));
  return { parts: rounded, total };
}

/**
 * True when a value is a usable price.
 *
 * Guards the provider boundary: a mapping bug or an unexpected payload shape
 * tends to surface as NaN, a negative, or zero, and any of those rendered as
 * "$0" reads to a user as a real bargain rather than as broken code.
 */
export function isValidMoney(value: Money | null | undefined): value is Money {
  return (
    Boolean(value) &&
    Number.isFinite(value!.amount) &&
    value!.amount > 0 &&
    typeof value!.currency === "string" &&
    /^[A-Z]{3}$/.test(value!.currency)
  );
}
