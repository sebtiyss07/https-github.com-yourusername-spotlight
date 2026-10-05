// Shared helpers for the daily price refresh (see README.md).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const ROOT = new URL("../../", import.meta.url).pathname;
export const OUT = join(ROOT, ".refresh");
mkdirSync(OUT, { recursive: true });

export const FILES = {
  us: join(ROOT, "src/lib/data/us-ticket-prices.json"),
  football: join(ROOT, "src/lib/data/ticket-prices.json"),
  hotels: join(ROOT, "src/lib/data/hotel-prices.json"),
};

export const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
export const writeJson = (f, d) => writeFileSync(f, JSON.stringify(d));
/** Today in US Eastern time (YYYY-MM-DD), the date each refreshed price carries. */
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every ticket-price row in the US and football files: { file, key, row }. */
export function allRows() {
  const out = [];
  for (const [file, path] of [["us", FILES.us], ["football", FILES.football]]) {
    for (const [key, rows] of Object.entries(readJson(path).events)) for (const row of rows) out.push({ file, key, row });
  }
  return out;
}

/** The unique URLs of one site's rows (the URL identifies the game on that site). */
export const urlsFor = (site) => [...new Set(allRows().filter((r) => r.row.site === site).map((r) => r.row.url))];

/** Results saved by the collectors: { [site]: { [url]: price | null } }. */
export function loadResults() {
  const merged = {};
  for (const f of existsSync(OUT) ? readdirSync(OUT) : []) {
    if (!f.startsWith("prices-") || !f.endsWith(".json")) continue;
    for (const [site, byUrl] of Object.entries(readJson(join(OUT, f)))) Object.assign((merged[site] ??= {}), byUrl);
  }
  return merged;
}

export const NON = /tailgate|parking|\blot\b|garage|not a game ticket|not a ticket|does not include admission|add[\s-]?on|photo|camp|meet|experience|hospitality|package|pass only|no game ticket|merch|pre-?game|post-?game|food|beverage|hotel|early entry|entry pass/i;
export const WC = /\bWC\b|wheelchair|\bADA\b|accessible|companion/i;

/**
 * Reads the JavaScript array literal in a Seatics answer (single-quoted
 * strings, numbers, nested arrays) as data, without running any of it.
 * Same reader as src/lib/providers/resaleTickets.ts.
 */
export function parseJsArray(src, start) {
  let i = start;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const value = () => {
    ws();
    const c = src[i];
    if (c === "[") {
      i++; const out = []; ws();
      if (src[i] === "]") { i++; return out; }
      for (;;) {
        out.push(value()); ws();
        if (src[i] === ",") i++;
        else if (src[i] === "]") { i++; return out; }
        else throw new Error("bad array");
      }
    }
    if (c === "'" || c === '"') {
      i++; let s = "";
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\") { const n = src[i + 1]; if (n === "u") { s += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)); i += 6; continue; } s += n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "" : n; i += 2; continue; }
        s += src[i++];
      }
      i++; return s;
    }
    if (c === "{") { let d = 0; do { if (src[i] === "{") d++; else if (src[i] === "}") d--; i++; } while (d > 0 && i < src.length); return null; }
    const m = /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|null|true|false|undefined)/i.exec(src.slice(i, i + 40));
    if (!m) throw new Error("bad value");
    i += m[0].length; const t = m[0];
    return t === "null" || t === "undefined" ? null : t === "true" ? true : t === "false" ? false : Number(t);
  };
  return value();
}
