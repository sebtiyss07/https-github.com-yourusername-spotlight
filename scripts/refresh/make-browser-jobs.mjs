// Step 2: writes the browser jobs for the sites that only answer a real
// browser (Vivid Seats, StubHub, Booking.com). Each job is a script to run in
// a tab on that site; it works one request at a time, saves progress in the
// tab, and sets window.__job.done when finished. See README.md.
// Needs the dev server running (for the hotel plan): npm run dev
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { OUT, urlsFor, NON, WC, today } from "./common.mjs";

const HOTEL_DAYS = Number(process.env.HOTEL_DAYS ?? 21);
// LIMIT=3 writes small jobs for a quick test.
const cap = (list) => list.slice(0, Number(process.env.LIMIT) || undefined);
const sleeper = `const sleepW = (ms) => new Promise((res) => { const w = new Worker(URL.createObjectURL(new Blob([\`setTimeout(()=>postMessage(1),\${ms})\`]))); w.onmessage = () => { w.terminate(); res(); }; });`;
// Progress is kept per day, so tomorrow's run starts fresh.
const runner = (name, ids, body, pause) => { const key = `${name}-${today()}`; return `
${sleeper}
const NON = ${NON}; const WC = ${WC};
const IDS = ${JSON.stringify(ids)};
let saved = {}; try { saved = JSON.parse(localStorage.getItem(${JSON.stringify(key)}) || "{}"); } catch {}
window.__job = { key: ${JSON.stringify(key)}, done: false, total: IDS.length, results: saved, log: [] };
(async () => {
  let fails = 0;
  for (const id of IDS) {
    const k = Array.isArray(id) ? String(id[0]) : id;
    if (k in window.__job.results) continue;
    try {
      const v = await (async () => { ${body} })();
      if (v === "BLOCKED") { window.__job.log.push("blocked at " + k); break; }
      if (v !== undefined) window.__job.results[k] = v;
      fails = 0;
    } catch (e) { window.__job.log.push(k + ": " + e.message); if (++fails >= 5) break; }
    try { localStorage.setItem(${JSON.stringify(key)}, JSON.stringify(window.__job.results)); } catch {}
    await sleepW(${pause});
  }
  window.__job.done = true;
})();
"started " + IDS.length;`; };

// Vivid Seats: the cheapest listing sold as one ticket (split options include
// 1), all-in price, placed on the seat map (c !== "0"), non-seats left out.
const vividIds = urlsFor("vividseats").map((u) => u.match(/production\/(\d+)/)?.[1]).filter(Boolean);
writeFileSync(join(OUT, "job-vivid.js"), runner("__refreshVivid", cap(vividIds), `
  const r = await fetch("/hermes/api/v1/listings?productionId=" + id + "&quantity=1&currency=USD", { signal: AbortSignal.timeout(30000) });
  if (r.status === 403 || r.status === 429) return "BLOCKED";
  if (!r.ok) return undefined;
  const t = (await r.json()).tickets || [];
  const p = t.filter((x) => x.c !== "0" && String(x.m || "").split(",").includes("1") && Number(x.aip) > 0 && !NON.test(x.s + " " + (x.n || "")) && !WC.test(x.s + " " + x.r + " " + (x.n || ""))).map((x) => Number(x.aip)).sort((a, b) => a - b)[0];
  return p === undefined ? null : Math.round(p);`, 1000));

// StubHub: the game page opened for one ticket, cheapest first; the cheapest
// non-sponsored listing with a ticket class (seats, not parking), fees in.
const stubIds = urlsFor("stubhub").map((u) => u.match(/event\/(\d+)/)?.[1]).filter(Boolean);
writeFileSync(join(OUT, "job-stubhub.js"), runner("__refreshStubhub", cap(stubIds), `
  const r = await fetch("/event/" + id + "/?quantity=1&sortBy=NEWPRICE&sortDirection=0", { signal: AbortSignal.timeout(30000) });
  if (r.status === 403 || r.status === 429) return "BLOCKED";
  if (!r.ok) return undefined;
  const doc = new DOMParser().parseFromString(await r.text(), "text/html");
  const data = JSON.parse(doc.querySelector("#index-data")?.textContent || "null");
  if (!data?.grid) return undefined;
  const p = (data.grid.items || []).filter((i) => !i.isSponsored && i.ticketClassName && i.rawPrice > 0 && !NON.test((i.section || "") + " " + i.ticketClassName) && !WC.test(i.section || "")).map((i) => i.rawPrice).sort((a, b) => a - b)[0];
  return p === undefined ? null : Math.round(p * 100) / 100;`, 4000)); // StubHub challenged after ~500 at 1.5 s apart

// Booking.com: the cheapest hotel (hotels only, within 5 km) for each game in
// the next HOTEL_DAYS days, for 1 and for 2 adults, in the venue's country.
const plan = (await (await fetch("http://localhost:3000/dev-refresh-plan")).json()).events;
const soon = Date.now() + HOTEL_DAYS * 864e5;
const stays = plan.filter((e) => Date.parse(e.checkIn) > Date.now() - 864e5 && Date.parse(e.startsAt) < soon)
  .map((e) => [e.id, e.venue.name + ", " + e.venue.city, e.venue.lat, e.venue.lon, e.venue.country.toLowerCase(), e.checkIn, e.checkOut]);
// One entry per game; both group sizes are searched inside: { "1": hotel, "2": hotel }.
writeFileSync(join(OUT, "job-booking.js"), runner("__refreshBooking", cap(stays), `
  const [eid, ss, lat, lon, cc, ci, co] = id;
  const out = {};
  for (const adults of [1, 2]) {
    const q = new URLSearchParams({ ss, latitude: lat, longitude: lon, checkin: ci, checkout: co, group_adults: String(adults), no_rooms: "1", group_children: "0", order: "price", nflt: "ht_id=204;distance=5000" });
    const r = await fetch("/searchresults.html?" + q, { credentials: "include", signal: AbortSignal.timeout(30000) });
    if (r.status === 403 || r.status === 429) return "BLOCKED";
    const doc = new DOMParser().parseFromString(await r.text(), "text/html");
    const cards = [...doc.querySelectorAll('[data-testid="property-card"]')];
    if (!cards.length) return undefined;
    const found = (doc.querySelector("h1")?.textContent.match(/([\\d,]+) propert/) || [])[1] || null;
    // The stay total from Booking's own screen-reader text ("Price $350" or
    // "Original price $305. Current price $224."). Since early October the big
    // number on the card can be the price per night, so it is never used.
    const stayTotal = (c) => {
      const t = [...c.querySelectorAll("span,div")].map((s) => s.textContent.trim())
        .find((t) => /^(Original price [^.]+\\. )?Current price \\D*[\\d,.]+\\.?$|^Price \\D*[\\d,.]+$/.test(t));
      const m = t && t.match(/(?:Current price|^Price) \\D*([\\d,.]+)/);
      return m ? Number(m[1].replace(/,/g, "")) : 0;
    };
    const best = cards.map((c) => ({
      name: c.querySelector('[data-testid="title"]')?.textContent.trim(),
      path: (c.querySelector('a[data-testid="title-link"]')?.getAttribute("href") || "").split("?")[0].replace("https://www.booking.com", ""),
      total: stayTotal(c),
      dist: (c.querySelector('[data-testid="distance"]')?.textContent || "").replace(/ from (map )?cent(er|re)/, ""),
      nights: c.querySelector('[data-testid="price-for-x-nights"]')?.textContent.trim(),
      room: ((c.querySelector('[data-testid="recommended-units"] h4') || c.querySelector('[data-testid="recommended-units"]'))?.textContent || "").trim().split("\\n")[0],
    })).filter((h) => h.total > 0 && h.path.startsWith("/hotel/" + cc + "/") && !/dorm|capsule|hostel|bed in/i.test(h.name + " " + h.room)).sort((a, b) => a.total - b.total)[0];
    out[adults] = best ? [ci, co, found, best.name, best.total, best.dist, best.room, best.path, best.nights] : null;
    if (adults === 1) await sleepW(3000);
  }
  return out;`, 3500));

console.log(`jobs written to .refresh/: vivid ${vividIds.length}, stubhub ${stubIds.length}, booking ${stays.length} games x 2 group sizes (${HOTEL_DAYS} days)`);
