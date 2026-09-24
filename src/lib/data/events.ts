import type { SportEvent, Team } from "@/lib/domain/types";
import { TEAMS_BY_ID, teamsForLeague } from "@/lib/data/teams";
import { intBetween, rngFrom } from "@/lib/data/random";

/**
 * Schedule generation.
 *
 * Fixtures are generated rather than transcribed: 82 NBA games × 30 teams is
 * 1,230 rows nobody is going to hand-maintain, and the real schedule will come
 * from a provider feed anyway. What matters is that the generated set has the
 * right *shape* — plausible dates, no team playing twice in a night, home and
 * away balanced — so the UI is being exercised against realistic volume.
 *
 * Marquee events are the opposite: hand-authored, because they're the reason
 * someone books a flight, and getting Wimbledon's dates wrong is not a rounding
 * error.
 */

/**
 * Everything is generated relative to the start of today (UTC), so the site
 * always has a full forward-looking calendar without the data going stale, and
 * every render inside the same day produces identical output.
 */
const ANCHOR = (() => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
})();

const DAY_MS = 86_400_000;

function isoAt(dayOffset: number, hourUtc: number, minute = 0): string {
  return new Date(ANCHOR + dayOffset * DAY_MS + hourUtc * 3600_000 + minute * 60_000)
    .toISOString();
}

/**
 * Round-robin pairing by the circle method: fix the first team, rotate the
 * rest. Guarantees every team appears exactly once per round, which is what
 * keeps a generated schedule from putting the Lakers in two cities at once.
 */
function roundRobinPairs(teams: Team[], round: number): [Team, Team][] {
  const n = teams.length;
  if (n < 2) return [];
  const rotation = [teams[0], ...rotate(teams.slice(1), round)];
  const pairs: [Team, Team][] = [];
  for (let i = 0; i < n / 2; i++) {
    const home = rotation[i];
    const away = rotation[n - 1 - i];
    if (!home || !away) continue;
    // Alternate home advantage each round so both venues get used.
    pairs.push(round % 2 === 0 ? [home, away] : [away, home]);
  }
  return pairs;
}

function rotate<T>(items: T[], by: number): T[] {
  if (items.length === 0) return items;
  const k = by % items.length;
  return [...items.slice(k), ...items.slice(0, k)];
}

interface ScheduleConfig {
  leagueId: string;
  /** How many rounds of fixtures to generate forward from today. */
  rounds: number;
  /** Days between the start of one round and the next. */
  roundSpacingDays: number;
  /** Rounds are spread across this many consecutive days (NBA plays nightly). */
  spreadDays: number;
  /** Local tip-off/kick-off hours, in UTC, to vary across a slate. */
  hoursUtc: number[];
  /** Round index past which fixtures are labelled playoffs. */
  playoffsAfterRound?: number;
}

function generateFixtures(config: ScheduleConfig): SportEvent[] {
  const teams = teamsForLeague(config.leagueId);
  if (teams.length < 2) return [];

  const events: SportEvent[] = [];

  for (let round = 0; round < config.rounds; round++) {
    const pairs = roundRobinPairs(teams, round);
    const baseDay = round * config.roundSpacingDays;

    pairs.forEach((pair, index) => {
      const [home, away] = pair;
      const rng = rngFrom(`${config.leagueId}:${round}:${home.id}:${away.id}`);
      const day = baseDay + (index % config.spreadDays);
      const hour = config.hoursUtc[index % config.hoursUtc.length];
      const isPlayoff =
        config.playoffsAfterRound !== undefined &&
        round >= config.playoffsAfterRound;

      // Demand tracks silverware and stadium size, with enough jitter that the
      // "cheapest ticket" ranking isn't just a title count in disguise.
      const pedigree = Math.min(60, (home.titles + away.titles) * 3);
      const demandScore = Math.max(
        12,
        Math.min(99, 25 + pedigree + intBetween(rng, -12, 18) + (isPlayoff ? 20 : 0)),
      );

      events.push({
        id: `${config.leagueId}-${round}-${home.id}-${away.id}`,
        sportId: home.sportId,
        leagueId: config.leagueId,
        kind: isPlayoff ? "playoff" : "fixture",
        name: `${away.shortName} @ ${home.shortName}`,
        startsAt: isoAt(day, hour, index % 2 === 0 ? 0 : 30),
        venueId: home.venueId,
        homeTeamId: home.id,
        awayTeamId: away.id,
        demandScore,
        isMarquee: false,
      });
    });
  }

  return events;
}

const GENERATED: SportEvent[] = [
  // NBA plays most nights: many rounds, tightly spaced, spread over 3 evenings.
  generateFixtures({
    leagueId: "nba",
    rounds: 26,
    roundSpacingDays: 3,
    spreadDays: 3,
    hoursUtc: [0, 1, 2, 23],
    playoffsAfterRound: 22,
  }),
  // Premier League: one matchweek per week, Saturday-heavy.
  generateFixtures({
    leagueId: "premier-league",
    rounds: 14,
    roundSpacingDays: 7,
    spreadDays: 3,
    hoursUtc: [11, 14, 16, 19],
  }),
  // NFL: one slate per week, almost all on the Sunday.
  generateFixtures({
    leagueId: "nfl",
    rounds: 12,
    roundSpacingDays: 7,
    spreadDays: 2,
    hoursUtc: [17, 18, 20, 21, 1],
    playoffsAfterRound: 10,
  }),
].flat();

// ---------------------------------------------------------------------------
// Marquee events — hand-authored
// ---------------------------------------------------------------------------

/**
 * Dates are scheduled relative to today so the calendar never empties out, but
 * each event keeps its real position in the sporting year (the Masters in
 * April, Wimbledon at the start of July). Where a host venue has not been
 * announced by the governing body, `notes` says so rather than inventing one.
 */
interface MarqueeSeed {
  id: string;
  sportId: SportEvent["sportId"];
  leagueId: string;
  name: string;
  kind: SportEvent["kind"];
  venueId: string;
  /** Days from today. Kept explicit so the yearly ordering is readable. */
  inDays: number;
  durationDays?: number;
  demandScore: number;
  notes?: string;
}

const MARQUEE_SEEDS: MarqueeSeed[] = [
  {
    id: "ucl-final",
    sportId: "soccer",
    leagueId: "champions-league",
    name: "UEFA Champions League Final",
    kind: "final",
    venueId: "wembley",
    inDays: 300,
    demandScore: 99,
    notes:
      "Single-match final at a neutral venue. Allocation is split between the two finalist clubs and a public ballot — resale is where most travelling fans end up.",
  },
  {
    id: "super-bowl",
    sportId: "american-football",
    leagueId: "nfl",
    name: "Super Bowl LXI",
    kind: "final",
    venueId: "49ers-venue",
    inDays: 195,
    demandScore: 100,
    notes:
      "The most expensive regular ticket in sport. Prices historically fall in the final 72 hours as brokers offload inventory.",
  },
  {
    id: "nba-finals-g1",
    sportId: "basketball",
    leagueId: "nba",
    name: "NBA Finals — Game 1",
    kind: "final",
    venueId: "celtics-venue",
    inDays: 315,
    demandScore: 96,
    notes: "Venue follows the higher seed; confirmed only after the conference finals.",
  },
  {
    id: "wimbledon",
    sportId: "tennis",
    leagueId: "grand-slams",
    name: "Wimbledon Championships",
    kind: "tournament",
    venueId: "aewc",
    inDays: 340,
    durationDays: 14,
    demandScore: 95,
    notes:
      "Ticketed per day and per court. The public ballot opens the previous autumn; the Queue is the only reliable walk-up route in tennis.",
  },
  {
    id: "us-open-tennis",
    sportId: "tennis",
    leagueId: "grand-slams",
    name: "US Open",
    kind: "tournament",
    venueId: "flushing-meadows",
    inDays: 35,
    durationDays: 14,
    demandScore: 92,
    notes: "Day and night sessions are sold separately — night sessions carry a large premium.",
  },
  {
    id: "australian-open",
    sportId: "tennis",
    leagueId: "grand-slams",
    name: "Australian Open",
    kind: "tournament",
    venueId: "melbourne-park",
    inDays: 172,
    durationDays: 15,
    demandScore: 88,
    notes: "Cheapest slam to attend on a ground pass, and the easiest to get into late.",
  },
  {
    id: "roland-garros",
    sportId: "tennis",
    leagueId: "grand-slams",
    name: "Roland-Garros",
    kind: "tournament",
    venueId: "roland-garros",
    inDays: 297,
    durationDays: 15,
    demandScore: 90,
  },
  {
    id: "monaco-gp",
    sportId: "motorsport",
    leagueId: "formula-1",
    name: "Monaco Grand Prix",
    kind: "race",
    venueId: "monaco-circuit",
    inDays: 290,
    durationDays: 3,
    demandScore: 97,
    notes:
      "Three-day ticket only. Grandstand pricing varies more by sightline here than at any other circuit — several stands cannot see a full corner.",
  },
  {
    id: "silverstone-gp",
    sportId: "motorsport",
    leagueId: "formula-1",
    name: "British Grand Prix",
    kind: "race",
    venueId: "silverstone",
    inDays: 345,
    durationDays: 3,
    demandScore: 91,
    notes: "General admission is genuinely good here — the banking at Stowe and Copse is walkable all weekend.",
  },
  {
    id: "monza-gp",
    sportId: "motorsport",
    leagueId: "formula-1",
    name: "Italian Grand Prix",
    kind: "race",
    venueId: "monza",
    inDays: 42,
    durationDays: 3,
    demandScore: 89,
  },
  {
    id: "cota-gp",
    sportId: "motorsport",
    leagueId: "formula-1",
    name: "United States Grand Prix",
    kind: "race",
    venueId: "cota",
    inDays: 82,
    durationDays: 3,
    demandScore: 85,
  },
  {
    id: "suzuka-gp",
    sportId: "motorsport",
    leagueId: "formula-1",
    name: "Japanese Grand Prix",
    kind: "race",
    venueId: "suzuka",
    inDays: 253,
    durationDays: 3,
    demandScore: 87,
  },
  {
    id: "le-mans",
    sportId: "motorsport",
    leagueId: "wec",
    name: "24 Hours of Le Mans",
    kind: "race",
    venueId: "le-mans",
    inDays: 320,
    durationDays: 4,
    demandScore: 86,
    notes:
      "General admission includes camping and covers the full 24 hours — by cost per hour of sport, the best value ticket in motorsport.",
  },
  {
    id: "the-masters",
    sportId: "golf",
    leagueId: "majors",
    name: "The Masters",
    kind: "tournament",
    venueId: "augusta",
    inDays: 255,
    durationDays: 4,
    demandScore: 98,
    notes:
      "Tournament badges are ballot-only and non-transferable in theory. Practice-round tickets are a separate, much larger ballot.",
  },
  {
    id: "the-open",
    sportId: "golf",
    leagueId: "majors",
    name: "The Open Championship",
    kind: "tournament",
    venueId: "st-andrews",
    inDays: 355,
    durationDays: 4,
    demandScore: 88,
  },
  {
    id: "ashes-lords",
    sportId: "cricket",
    leagueId: "the-ashes",
    name: "The Ashes — Second Test",
    kind: "tournament",
    venueId: "lords",
    inDays: 330,
    durationDays: 5,
    demandScore: 93,
    notes:
      "Priced per day across five days. Days four and five only happen if the match lasts — cheapest tickets, real risk of no play.",
  },
  {
    id: "boxing-day-test",
    sportId: "cricket",
    leagueId: "the-ashes",
    name: "Boxing Day Test",
    kind: "tournament",
    venueId: "mcg",
    inDays: 152,
    durationDays: 5,
    demandScore: 90,
    notes: "Day one at the MCG regularly draws 90,000 — the largest single-day crowd in cricket.",
  },
  {
    id: "ipl-final",
    sportId: "cricket",
    leagueId: "ipl",
    name: "IPL Final",
    kind: "final",
    venueId: "narendra-modi",
    inDays: 302,
    demandScore: 94,
  },
  {
    id: "el-clasico",
    sportId: "soccer",
    leagueId: "la-liga",
    name: "El Clásico — Real Madrid vs Barcelona",
    kind: "fixture",
    venueId: "bernabeu",
    inDays: 88,
    demandScore: 97,
    notes:
      "Real Madrid release tickets on a rolling basis roughly two weeks out rather than all at once — checking daily beats buying resale early.",
  },
  {
    id: "milan-derby",
    sportId: "soccer",
    leagueId: "serie-a",
    name: "Derby della Madonnina — Inter vs Milan",
    kind: "fixture",
    venueId: "san-siro",
    inDays: 64,
    demandScore: 89,
  },
  {
    id: "der-klassiker",
    sportId: "soccer",
    leagueId: "bundesliga",
    name: "Der Klassiker — Bayern vs Dortmund",
    kind: "fixture",
    venueId: "allianz-arena",
    inDays: 96,
    demandScore: 88,
    notes: "Bundesliga price caps make this the cheapest elite derby in Europe — if you can get an allocation.",
  },
  {
    id: "libertadores-final",
    sportId: "soccer",
    leagueId: "copa-libertadores",
    name: "Copa Libertadores Final",
    kind: "final",
    venueId: "maracana",
    inDays: 110,
    demandScore: 92,
  },
  {
    id: "ufc-numbered",
    sportId: "combat-sports",
    leagueId: "ufc",
    name: "UFC 330 — Championship Doubleheader",
    kind: "final",
    venueId: "t-mobile-arena",
    inDays: 58,
    demandScore: 87,
    notes: "Numbered cards are the ones worth travelling for; Fight Nights are a fraction of the price.",
  },
  {
    id: "boxing-riyadh",
    sportId: "combat-sports",
    leagueId: "boxing",
    name: "Undisputed Heavyweight Title",
    kind: "final",
    venueId: "sphere",
    inDays: 129,
    demandScore: 91,
  },
  {
    id: "stanley-cup-g1",
    sportId: "ice-hockey",
    leagueId: "nhl",
    name: "Stanley Cup Final — Game 1",
    kind: "final",
    venueId: "bell-centre",
    inDays: 310,
    demandScore: 90,
    notes: "Home venue depends on the finalists; listed site is indicative only.",
  },
  {
    id: "iihf-final",
    sportId: "ice-hockey",
    leagueId: "iihf-worlds",
    name: "IIHF World Championship Final",
    kind: "final",
    venueId: "allianz-arena",
    inDays: 285,
    demandScore: 78,
  },
  {
    id: "world-series-g1",
    sportId: "baseball",
    leagueId: "mlb",
    name: "World Series — Game 1",
    kind: "final",
    venueId: "msg-neutral",
    inDays: 90,
    demandScore: 93,
    notes: "Home venue depends on the pennant winners; listed site is indicative only.",
  },
  {
    id: "euroleague-f4",
    sportId: "basketball",
    leagueId: "euroleague",
    name: "EuroLeague Final Four",
    kind: "final",
    venueId: "allianz-arena",
    inDays: 288,
    durationDays: 3,
    demandScore: 84,
    notes: "One ticket covers both semi-finals and the final — the best-value weekend in European sport.",
  },
  {
    id: "fifa-wc-final",
    sportId: "soccer",
    leagueId: "fifa-world-cup",
    name: "FIFA World Cup Final",
    kind: "final",
    venueId: "estadio-azteca",
    inDays: 700,
    demandScore: 100,
    notes:
      "Sold through FIFA's own ballot in phases, not through the usual marketplaces. Hospitality packages are the only guaranteed route.",
  },
];

const MARQUEE: SportEvent[] = MARQUEE_SEEDS.map((seed) => {
  const rng = rngFrom(`marquee:${seed.id}`);
  return {
    id: seed.id,
    sportId: seed.sportId,
    leagueId: seed.leagueId,
    kind: seed.kind,
    name: seed.name,
    startsAt: isoAt(seed.inDays, intBetween(rng, 12, 20)),
    endsAt: seed.durationDays
      ? isoAt(seed.inDays + seed.durationDays, 21)
      : undefined,
    venueId: seed.venueId,
    demandScore: seed.demandScore,
    isMarquee: true,
    notes: seed.notes,
  };
});

export const EVENTS: SportEvent[] = [...MARQUEE, ...GENERATED].sort(
  (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
);

export const EVENTS_BY_ID = new Map(EVENTS.map((e) => [e.id, e]));

export function eventsForLeague(leagueId: string): SportEvent[] {
  return EVENTS.filter((e) => e.leagueId === leagueId);
}

export function eventsForSport(sportId: string): SportEvent[] {
  return EVENTS.filter((e) => e.sportId === sportId);
}

export function eventsForTeam(teamId: string): SportEvent[] {
  return EVENTS.filter((e) => e.homeTeamId === teamId || e.awayTeamId === teamId);
}

/** Resolves a fixture's display title, falling back to the stored name. */
export function eventTitle(event: SportEvent): string {
  if (!event.homeTeamId || !event.awayTeamId) return event.name;
  const home = TEAMS_BY_ID.get(event.homeTeamId);
  const away = TEAMS_BY_ID.get(event.awayTeamId);
  if (!home || !away) return event.name;
  return `${away.name} at ${home.name}`;
}
