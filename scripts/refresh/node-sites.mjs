// Step 1 (no browser): today's price on every game page of the sites whose
// listings can be read directly. Same rules as the live game pages
// (src/lib/providers/resaleTickets.ts). One request at a time per site.
// Writes .refresh/prices-node.json.
import { join } from "node:path";
import { OUT, urlsFor, writeJson, sleep, NON, WC, parseJsArray } from "./common.mjs";

const UA = "Mozilla/5.0 (compatible; SpotlightPriceCheck/1.0; +https://www.spotlightkt.com/about)";
const get = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: AbortSignal.timeout(25000) });
  if (r.status === 403 || r.status === 429) throw Object.assign(new Error(`blocked ${r.status}`), { blocked: true });
  return r.ok ? r.text() : null;
};

const SITES = {
  gametime: async (url) => {
    const id = url.match(/\/events\/([\w-]+)/)?.[1];
    const text = id && (await get(`https://mobile.gametime.co/v3/listings/${id}?all_in_pricing=true&jitter_cheapest=0&quantity=1`));
    if (!text) return undefined;
    const best = (JSON.parse(text).listings ?? [])
      .filter((l) => (l.available_lots ?? []).includes(1) && l.price?.pre_tax_total > 0)
      .filter((l) => { const t = `${l.spot?.section ?? ""} ${l.spot?.section_group ?? ""} ${l.spot?.row ?? ""} ${(l.disclosures ?? []).join(" ")}`; return !NON.test(t) && !WC.test(t); })
      .map((l) => Math.ceil(l.price.pre_tax_total / 100))
      .sort((a, b) => a - b)[0];
    return best ?? null;
  },
  ticketnetwork: (url) => seatics(url, 3551),
  ticketliquidator: (url) => seatics(url, 237),
  livefootballtickets: (url) => lowPrice(url, 2),
  tickpick: (url) => lowPrice(url, 0),
};

async function seatics(url, config) {
  const id = url.match(/\/tickets\/(\d+)\//)?.[1];
  const text = id && (await get(`https://mapwidget3.seatics.com/Api/TicketsByEvent?callback=cb&eventId=${id}&websiteConfigId=${config}`));
  if (!text || !text.includes("cb([")) return undefined;
  const rows = parseJsArray(text, text.indexOf("cb([") + 3)?.[0] ?? [];
  let best = null;
  for (const t of rows) {
    const allIn = Number(t[21]);
    if (t[10] !== 1 || !(Number(t[18]) & 1) || !(allIn > 0) || !String(t[0] ?? "").trim()) continue;
    if (NON.test(`${t[0]} ${t[1]} ${t[6]}`) || WC.test(`${t[0]} ${t[1]} ${t[2]} ${t[6]}`)) continue;
    if (best === null || allIn < best) best = allIn;
  }
  return best === null ? null : Math.ceil(Math.round(best * 100) / 100);
}

async function lowPrice(url, decimals) {
  const text = await get(url);
  if (!text || !/"priceCurrency"\s*:\s*"USD"/.test(text)) return undefined;
  const low = Number(text.match(/"lowPrice"\s*:\s*"?(\d+(?:\.\d+)?)/)?.[1]);
  if (!(low > 0)) return undefined;
  return decimals ? Math.round(low * 100) / 100 : Math.ceil(low);
}

const only = process.argv[2]?.split(",");
const out = {};
const save = () => writeJson(join(OUT, process.env.LIMIT ? "test-node.json" : "prices-node.json"), out);
await Promise.all(
  Object.entries(SITES)
    .filter(([site]) => !only || only.includes(site))
    .map(async ([site, read]) => {
      // LIMIT=3 for a quick test run.
      // TickPick's game pages (/buy-tickets/<id>/) are read by the browser job
      // (Node is rate-limited after ~60); F1 pass pages are read here.
      const all = site === "tickpick" ? urlsFor(site).filter((u) => !/\/buy-tickets\/\d+\/$/.test(u)) : urlsFor(site);
      const urls = all.slice(0, Number(process.env.LIMIT) || undefined);
      const res = (out[site] = {});
      let errors = 0;
      for (const url of urls) {
        try {
          const v = await read(url);
          if (v !== undefined) res[url] = v;
          errors = 0;
        } catch (e) {
          if (e.blocked || ++errors >= 5) { console.log(`${site}: stopped (${e.message}) after ${Object.keys(res).length}/${urls.length}`); break; }
        }
        if (Object.keys(res).length % 100 === 0) save();
        await sleep(600);
      }
      console.log(`${site}: ${Object.keys(res).length}/${urls.length} read`);
      save();
    }),
);
save();
