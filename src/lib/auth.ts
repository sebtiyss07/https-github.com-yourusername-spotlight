/**
 * Accounts (Clerk) are on only once both keys are set in the environment.
 * Until then the site works exactly as before: saved games stay on the device
 * and nothing about signing in is shown.
 */
export const authEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

/** A saved game as stored in the account: [event id, price when saved, currency, saved on]. */
export type StoredGame = [id: string, price: number | null, currency: string, savedOn: string];

export interface AccountData {
  saved: StoredGame[];
  /** Email me when a saved game gets cheaper (off until the person turns it on). */
  alerts: boolean;
  /** The last price we emailed about, per game, so the same drop isn't sent twice. */
  alerted?: Record<string, number>;
}

export const MAX_SAVED = 100;

/** Validates what a browser sends; anything malformed is dropped. */
export function cleanSaved(input: unknown): StoredGame[] {
  if (!Array.isArray(input)) return [];
  const out: StoredGame[] = [];
  for (const g of input.slice(0, MAX_SAVED)) {
    if (!Array.isArray(g)) continue;
    const [id, price, currency, savedOn] = g;
    if (typeof id !== "string" || !/^[\w-]{1,80}$/.test(id)) continue;
    if (price !== null && (typeof price !== "number" || !Number.isFinite(price) || price < 0)) continue;
    if (!["USD", "EUR", "GBP"].includes(currency)) continue;
    if (typeof savedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(savedOn)) continue;
    out.push([id, price, currency, savedOn]);
  }
  return out;
}
