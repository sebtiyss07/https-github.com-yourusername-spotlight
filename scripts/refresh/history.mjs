// Price history: the cheapest price Spotlight showed for each game, once a
// day (src/lib/data/price-history.json: { events: { id: [[date, usd], ...] } }).
// Recorded by apply.mjs after each daily refresh; past games are dropped.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FEES_AT_CHECKOUT, FILES, ROOT, readJson, writeJson } from "./common.mjs";

export const HISTORY = join(ROOT, "src/lib/data/price-history.json");

export function recordHistory(date) {
  const history = existsSync(HISTORY) ? readJson(HISTORY) : { note: "Cheapest price shown per game, one point per daily check (USD).", events: {} };
  const live = new Set();
  let n = 0;
  for (const file of [FILES.us, FILES.football]) {
    for (const [id, rows] of Object.entries(readJson(file).events)) {
      live.add(id);
      // Same rule as the site: an all-in price wins over one that has fees
      // added at checkout (FEES_AT_CHECKOUT, from src/lib/data/fees.ts).
      const priced = rows.filter((r) => typeof r.price === "number" && r.price > 0);
      const allIn = priced.filter((r) => !FEES_AT_CHECKOUT.has(r.site));
      const prices = (allIn.length ? allIn : priced).map((r) => r.price);
      if (!prices.length) continue;
      const cheapest = Math.min(...prices);
      const points = (history.events[id] ??= []).filter(([d]) => d !== date);
      points.push([date, cheapest]);
      points.sort((a, b) => a[0].localeCompare(b[0]));
      history.events[id] = points;
      n++;
    }
  }
  for (const id of Object.keys(history.events)) if (!live.has(id)) delete history.events[id];
  writeJson(HISTORY, history);
  return n;
}
