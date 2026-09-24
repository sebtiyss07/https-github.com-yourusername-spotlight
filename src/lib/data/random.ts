/**
 * Deterministic pseudo-randomness.
 *
 * Every generated value in this app — fixture dates, ticket prices, hotel
 * ratings — is derived from a string seed rather than `Math.random()`. That
 * matters for two reasons beyond tidiness:
 *
 *  1. Server components render on every request. Real randomness would mean
 *     the "cheapest ticket" changed between the list page and the detail page.
 *  2. React would flag a hydration mismatch the moment a server-rendered price
 *     differed from the client's.
 *
 * Same seed in, same number out, forever.
 */

/** FNV-1a. Fast, well-distributed for short keys, no dependencies. */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough statistically for seeded content. */
export function rngFrom(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Fisher-Yates against a seeded rng. Returns a new array. */
export function shuffled<T>(rng: () => number, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
