// Step 3: applies today's results to the site's price files.
//   .refresh/prices-node.json      { site: { url: price | null } }   (node-sites.mjs)
//   .refresh/browser-vivid.json    { productionId: price | null }    (job-vivid.js export)
//   .refresh/browser-stubhub.json  { eventId: price | null }         (job-stubhub.js export)
//   .refresh/browser-tickpick.json { eventId: price | null }         (job-tickpick.js export)
//   .refresh/browser-booking.json  { eventId: { "1": [...], "2": [...] } } (job-booking.js export)
// Each updated row gets today's date. A site that wasn't read keeps its last
// checked price and date. Then: npx tsc, check pages, deploy (README.md).
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FILES, OUT, readJson, writeJson, today, loadResults, f1Rows } from "./common.mjs";
import { recordHistory } from "./history.mjs";

const day = today();
const load = (f) => (existsSync(join(OUT, f)) ? readJson(join(OUT, f)) : {});
// Every collector's { site: { url: price } } file (prices-node.json, prices-tickpick.json, ...).
const node = loadResults();
const byId = {
  vividseats: [load("browser-vivid.json"), /production\/(\d+)/],
  stubhub: [load("browser-stubhub.json"), /event\/(\d+)/],
  tickpick: [load("browser-tickpick.json"), /buy-tickets\/(\d+)\//],
};
const SEAT_CHECKED = ["gametime", "vividseats", "stubhub", "ticketnetwork", "ticketliquidator", "ticketsmarter"];
const NOTE_NONE = "No single seat listed when we checked";
const count = {};

function update(row) {
  let v;
  if (node[row.site] && row.url in node[row.site]) v = node[row.site][row.url];
  else if (byId[row.site]) {
    const id = row.url.match(byId[row.site][1])?.[1];
    if (id && id in byId[row.site][0]) v = byId[row.site][0][id];
  }
  if (v === undefined) return;
  row.price = v;
  row.checked = day;
  if (v === null) row.note = row.site === "tickpick" ? "No tickets listed when we checked" : NOTE_NONE;
  else if (row.note === NOTE_NONE || row.site === "tickpick") delete row.note;
  count[row.site] = (count[row.site] ?? 0) + 1;
}

for (const file of [FILES.us, FILES.football]) {
  const data = readJson(file);
  for (const rows of Object.values(data.events)) {
    for (const row of rows) update(row);
    // TickPick's listed price can be an add-on; below 70% of the cheapest
    // seat-checked price elsewhere, it isn't shown (US games, as before).
    if (file === FILES.us) {
      const tp = rows.find((r) => r.site === "tickpick" && r.checked === day && r.price !== null);
      const seats = rows.filter((r) => SEAT_CHECKED.includes(r.site) && r.price !== null).map((r) => r.price);
      if (tp && seats.length && tp.price < 0.7 * Math.min(...seats)) {
        tp.price = null;
        tp.note = "Listed price looked like an add-on, not a seat: open TickPick to check";
        delete tp.label;
      } else if (tp) tp.label = "TickPick's listed price";
    }
  }
  writeJson(file, data);
}

// F1 weekend passes and race days: same readers, same rules.
const f1 = readJson(FILES.f1);
for (const row of f1Rows(f1)) update(row);
writeFileSync(FILES.f1, JSON.stringify(f1, null, 1)); // kept readable, as committed

// Hotels: the cheapest hotel for each game's default stay, for 1 and 2 people.
const booking = load("browser-booking.json");
const hotels = readJson(FILES.hotels);
const longDate = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
let hotelCount = 0;
// Each game's result is { "1": hotel | null, "2": hotel | null }.
const searches = Object.entries(booking).flatMap(([eid, v]) => Object.entries(v ?? {}).map(([adults, h]) => [eid, adults, h]));
for (const [eid, adults, v] of searches) {
  if (!v) continue;
  const [ci, co, found, name, total, dist, room, path, nightsText] = v;
  const nights = Math.round((Date.parse(co) - Date.parse(ci)) / 864e5);
  const e = (hotels.events[eid] ??= { checkIn: ci, checkOut: co, found: null, wide: false, hotels: [] });
  // New dates: the old 2-person price was for other nights, so it goes too.
  if (e.checkIn !== ci || e.checkOut !== co) { Object.assign(e, { checkIn: ci, checkOut: co }); delete e.pair; }
  const s = { found, wide: false, hotels: [[name, Math.round(total / nights), total, dist, room, path, nightsText]] };
  if (adults === "1") Object.assign(e, s); else e.pair = s;
  e.checkedOn = longDate;
  hotelCount++;
}
writeJson(FILES.hotels, hotels);
console.log("ticket rows updated:", JSON.stringify(count), "| hotel searches applied:", hotelCount);

// Today's cheapest price per game, for the price history chart.
console.log("price history points recorded:", recordHistory(day));
