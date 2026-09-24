import type { Sport } from "@/lib/domain/types";

/**
 * The ten sports by global following. Order here is the order on the landing
 * page — `globalFans` is an approximate figure used for ranking and for the
 * "N billion fans" line, not a precise statistic.
 *
 * No logo or emoji field: sports are drawn with custom vector artwork in
 * `SportIcon`, and no league or governing-body mark appears anywhere in the app.
 */
export const SPORTS: Sport[] = [
  {
    id: "soccer",
    name: "Soccer",
    tagline: "The world game. 200+ countries, a match every hour.",
    accent: "#22c55e",
    globalFans: 3_500_000_000,
  },
  {
    id: "cricket",
    name: "Cricket",
    tagline: "Test match tradition meets the T20 boom.",
    accent: "#f59e0b",
    globalFans: 2_500_000_000,
  },
  {
    id: "basketball",
    name: "Basketball",
    tagline: "82 nights a season, and the best playoffs in sport.",
    accent: "#f97316",
    globalFans: 2_200_000_000,
  },
  {
    id: "motorsport",
    name: "Motorsport",
    tagline: "24 races, 21 countries, one championship.",
    accent: "#ef4444",
    globalFans: 1_200_000_000,
  },
  {
    id: "tennis",
    name: "Tennis",
    tagline: "Four slams, eleven months, two tours.",
    accent: "#a3e635",
    globalFans: 1_000_000_000,
  },
  {
    id: "combat-sports",
    name: "Combat Sports",
    tagline: "Championship nights that sell out in minutes.",
    accent: "#e11d48",
    globalFans: 600_000_000,
  },
  {
    id: "baseball",
    name: "Baseball",
    tagline: "162 games. The cheapest great seat in sport.",
    accent: "#38bdf8",
    globalFans: 500_000_000,
  },
  {
    id: "golf",
    name: "Golf",
    tagline: "Four majors and a walk worth flying for.",
    accent: "#14b8a6",
    globalFans: 450_000_000,
  },
  {
    id: "american-football",
    name: "American Football",
    tagline: "17 games. Every one of them an event.",
    accent: "#8b5cf6",
    globalFans: 400_000_000,
  },
  {
    id: "ice-hockey",
    name: "Ice Hockey",
    tagline: "The fastest game on earth, and the hardest trophy to win.",
    accent: "#60a5fa",
    globalFans: 250_000_000,
  },
];

export const SPORTS_BY_ID = new Map(SPORTS.map((s) => [s.id, s]));
