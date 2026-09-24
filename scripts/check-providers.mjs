#!/usr/bin/env node
/**
 * Provider health check.
 *
 * Run after adding credentials: `npm run check:providers`
 *
 * Verifies each key actually works against the live API, and — for
 * Ticketmaster — prints the classification names it really returns, so the
 * taxonomy mapping in `ticketmasterResolver.ts` can be corrected against
 * reality rather than assumed.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env.local parser — avoids a dependency for one file. */
function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

const TM_ROOT = "https://app.ticketmaster.com/discovery/v2";

async function checkTicketmaster() {
  console.log(bold("\nTicketmaster Discovery"));

  const key = env.TICKETMASTER_API_KEY;
  if (!key) {
    console.log(`  ${yellow("○ not configured")} — TICKETMASTER_API_KEY is empty`);
    console.log(dim("    1. Register: https://developer-acct.ticketmaster.com/user/register"));
    console.log(dim("    2. Copy the Consumer Key from your auto-created app"));
    console.log(dim("    3. Add it to .env.local, then re-run this check"));
    return false;
  }

  // 1. Does the key authenticate at all?
  const url = new URL(`${TM_ROOT}/events.json`);
  url.searchParams.set("apikey", key);
  url.searchParams.set("classificationName", "Basketball");
  url.searchParams.set("size", "40");

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    console.log(`  ${red("✗ network error")} — ${error.message}`);
    return false;
  }

  if (response.status === 401) {
    console.log(`  ${red("✗ invalid key")} — the API rejected these credentials`);
    return false;
  }
  if (response.status === 429) {
    console.log(`  ${red("✗ rate limited")} — free tier is 5 req/sec, 5000/day`);
    return false;
  }
  if (!response.ok) {
    console.log(`  ${red(`✗ HTTP ${response.status}`)}`);
    return false;
  }

  const body = await response.json();
  const events = body._embedded?.events ?? [];
  console.log(`  ${green("✓ key valid")} — ${events.length} basketball events returned`);

  if (events.length === 0) {
    console.log(dim("    No events came back; can't validate the taxonomy mapping."));
    return true;
  }

  // 2. What classification vocabulary does it actually use? Our mapping in
  //    ticketmasterResolver.ts is a guess until it's checked against this.
  const segments = new Set();
  const genres = new Set();
  for (const event of events) {
    for (const c of event.classifications ?? []) {
      if (c.segment?.name) segments.add(c.segment.name);
      if (c.genre?.name) genres.add(c.genre.name);
    }
  }
  console.log(dim(`    segments: ${[...segments].join(", ") || "none"}`));
  console.log(dim(`    genres:   ${[...genres].join(", ") || "none"}`));

  // 3. How many carry pricing? This is the number that decides whether the
  //    integration is worth much — many events return none at all.
  const withPrices = events.filter((e) => e.priceRanges?.length > 0);
  const pct = Math.round((withPrices.length / events.length) * 100);
  const note = pct < 40 ? yellow(`${pct}%`) : green(`${pct}%`);
  console.log(`  ${note} of events include price ranges (${withPrices.length}/${events.length})`);

  if (withPrices.length > 0) {
    const sample = withPrices[0];
    const range = sample.priceRanges[0];
    console.log(
      dim(
        `    e.g. "${sample.name}" — ${range.currency} ${range.min}–${range.max}`,
      ),
    );
  }
  if (pct < 40) {
    console.log(
      dim("    Low coverage is normal: Discovery omits pricing for many events."),
    );
  }

  return true;
}

async function checkSeatGeek() {
  console.log(bold("\nSeatGeek"));

  const clientId = env.SEATGEEK_CLIENT_ID;
  if (!clientId) {
    console.log(`  ${yellow("○ not configured")} — SEATGEEK_CLIENT_ID is empty`);
    console.log(dim("    Register an app: https://seatgeek.com/account/develop"));
    return false;
  }

  const url = new URL("https://api.seatgeek.com/2/events");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("q", "NBA");
  url.searchParams.set("per_page", "25");

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    console.log(`  ${red("✗ network error")} — ${error.message}`);
    return false;
  }

  if (response.status === 401 || response.status === 403) {
    console.log(`  ${red("✗ rejected")} — HTTP ${response.status}, check the client ID`);
    return false;
  }
  if (!response.ok) {
    console.log(`  ${red(`✗ HTTP ${response.status}`)}`);
    return false;
  }

  const body = await response.json();
  const events = body.events ?? [];
  console.log(`  ${green("✓ client ID valid")} — ${events.length} events returned`);

  if (events.length === 0) return true;

  // The stats block is the whole reason to prefer SeatGeek over Discovery:
  // without it there is no price to show.
  const withStats = events.filter((e) => e.stats?.lowest_price > 0);
  const pct = Math.round((withStats.length / events.length) * 100);
  const note = pct < 40 ? yellow(`${pct}%`) : green(`${pct}%`);
  console.log(`  ${note} of events carry a lowest_price (${withStats.length}/${events.length})`);

  if (withStats.length > 0) {
    const s = withStats[0];
    console.log(
      dim(
        `    e.g. "${s.title}" — low $${s.stats.lowest_price}, avg $${s.stats.average_price ?? "?"}, ${s.stats.listing_count ?? "?"} listings`,
      ),
    );
    console.log(
      dim(
        "    Confirm whether your tier returns pre-fee or all-in prices, then set",
      ),
    );
    console.log(dim("    ESTIMATED_FEE_RATE in tickets/seatgeek.ts accordingly."));
  }

  return true;
}

async function checkAmadeus() {
  console.log(bold("\nAmadeus (flights + hotels)"));
  const id = env.AMADEUS_CLIENT_ID;
  const secret = env.AMADEUS_CLIENT_SECRET;

  if (!id || !secret) {
    console.log(`  ${yellow("○ not configured")} — free sandbox at https://developers.amadeus.com`);
    return false;
  }

  const host =
    env.AMADEUS_ENV === "production"
      ? "https://api.amadeus.com"
      : "https://test.api.amadeus.com";

  try {
    const response = await fetch(
      `${host}/v1/security/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: id,
          client_secret: secret,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      console.log(`  ${red(`✗ auth failed — HTTP ${response.status}`)}`);
      return false;
    }

    const { access_token: token } = await response.json();
    console.log(`  ${green("✓ credentials valid")}`);

    // Auth succeeding proves little — the sandbox serves a cached subset of
    // routes, so verify an actual search returns offers.
    const departureDate = new Date(Date.now() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const search = new URL(`${host}/v2/shopping/flight-offers`);
    search.searchParams.set("originLocationCode", "LHR");
    search.searchParams.set("destinationLocationCode", "MAD");
    search.searchParams.set("departureDate", departureDate);
    search.searchParams.set("adults", "1");
    search.searchParams.set("currencyCode", "USD");
    search.searchParams.set("max", "5");

    const offersRes = await fetch(search, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });

    if (!offersRes.ok) {
      console.log(
        `  ${yellow(`○ search returned HTTP ${offersRes.status}`)} — auth works, this route may not be in the sandbox`,
      );
      return true;
    }

    const offers = (await offersRes.json()).data ?? [];
    if (offers.length === 0) {
      console.log(
        `  ${yellow("○ no offers for LHR→MAD")} — normal in the test sandbox`,
      );
      return true;
    }

    const cheapest = offers[0];
    console.log(
      `  ${green(`✓ flight search working`)} — ${offers.length} offers, from ${cheapest.price?.currency} ${cheapest.price?.grandTotal ?? cheapest.price?.total}`,
    );
    if (host.includes("test.")) {
      console.log(
        dim("    Sandbox data is a cached subset; set AMADEUS_ENV=production when live."),
      );
    }
    return true;
  } catch (error) {
    console.log(`  ${red("✗ network error")} — ${error.message}`);
    return false;
  }
}

console.log(bold("Checking provider credentials…"));

const results = await Promise.all([
  checkTicketmaster(),
  checkSeatGeek(),
  checkAmadeus(),
]);
const liveCount = results.filter(Boolean).length;

console.log(
  bold(
    liveCount === 0
      ? `\n${yellow("No live providers.")} The app runs entirely on seeded data.`
      : `\n${green(`${liveCount} live provider${liveCount === 1 ? "" : "s"}.`)} Seeded data is suppressed wherever these return results.`,
  ),
);
console.log("");
