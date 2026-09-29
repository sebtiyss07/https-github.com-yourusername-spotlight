// Snapshots the NFL, NBA and MLS schedules and clubs from ESPN's public scoreboard data
// into src/lib/data/us-schedules.json. Run: node scripts/fetch-us-schedules.mjs
//
// ESPN answers one week (NFL) or one day (NBA, MLS) per request, and each
// league's "calendar" lists the days that have games. Only regular-season and
// postseason games that haven't been played are kept.

import { writeFileSync } from "node:fs";

const BASE = "https://site.api.espn.com/apis/site/v2/sports";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) return res.json();
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`ESPN answered with an error for ${url}`);
}

function toGame(league, e) {
  const c = e.competitions[0];
  const side = (ha) => c.competitors.find((x) => x.homeAway === ha)?.team;
  const home = side("home");
  const away = side("away");
  return {
    league,
    id: e.id,
    date: e.date,
    seasonType: e.season?.slug,
    status: e.status?.type?.name,
    neutral: !!c.neutralSite,
    home: { id: home?.id, name: home?.displayName, abbr: home?.abbreviation },
    away: { id: away?.id, name: away?.displayName, abbr: away?.abbreviation },
    venue: {
      id: c.venue?.id,
      name: c.venue?.fullName,
      city: c.venue?.address?.city,
      state: c.venue?.address?.state,
      country: c.venue?.address?.country,
    },
  };
}

const keep = (g) =>
  g.status === "STATUS_SCHEDULED" && (g.seasonType === "regular-season" || g.seasonType === "post-season") && g.home.id && g.away.id;

async function byDays(league, path) {
  const first = await get(`${BASE}/${path}/scoreboard`);
  const days = [...new Set((first.leagues[0].calendar ?? []).map((d) => (typeof d === "string" ? d : d.startDate)).map((d) => d.slice(0, 10)))];
  const today = new Date().toISOString().slice(0, 10);
  const games = new Map();
  for (const day of days.filter((d) => d >= today)) {
    const j = await get(`${BASE}/${path}/scoreboard?dates=${day.replaceAll("-", "")}&limit=100`);
    for (const e of j.events ?? []) {
      const g = toGame(league, e);
      if (keep(g)) games.set(g.id, g);
    }
    await sleep(250);
  }
  return [...games.values()];
}

async function nfl() {
  const games = new Map();
  for (const [type, weeks] of [[2, 18], [3, 5]]) {
    for (let week = 1; week <= weeks; week++) {
      const j = await get(`${BASE}/football/nfl/scoreboard?seasontype=${type}&week=${week}`);
      for (const e of j.events ?? []) {
        const g = toGame("nfl", e);
        if (keep(g)) games.set(g.id, g);
      }
      await sleep(250);
    }
  }
  return [...games.values()];
}

/** Every club in the league: ESPN's names, abbreviation and team colours. */
async function teams(league, path) {
  const j = await get(`${BASE}/${path}/teams?limit=100`);
  return j.sports[0].leagues[0].teams.map(({ team: t }) => ({
    league,
    id: t.id,
    abbr: t.abbreviation,
    name: t.displayName,
    shortName: t.shortDisplayName,
    color: t.color,
    alternateColor: t.alternateColor,
  }));
}

const [nflGames, nbaGames, mlsGames] = [await nfl(), await byDays("nba", "basketball/nba"), await byDays("mls", "soccer/usa.1")];
const out = {
  source: "ESPN public scoreboard data",
  fetchedAt: new Date().toISOString(),
  teams: [...(await teams("nfl", "football/nfl")), ...(await teams("nba", "basketball/nba")), ...(await teams("mls", "soccer/usa.1"))],
  games: [...nflGames, ...nbaGames, ...mlsGames].sort((a, b) => a.date.localeCompare(b.date)),
};
writeFileSync(new URL("../src/lib/data/us-schedules.json", import.meta.url), JSON.stringify(out));
console.log(`NFL ${nflGames.length}, NBA ${nbaGames.length}, MLS ${mlsGames.length}`);
