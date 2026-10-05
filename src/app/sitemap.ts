import type { MetadataRoute } from "next";
import { getLeagues, getTeams, getUpcomingEvents } from "@/lib/repositories";

const BASE = "https://www.spotlightkt.com";

/** Every page a visitor can reach: leagues, teams and each upcoming game. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [leagues, teams, events] = await Promise.all([getLeagues(), getTeams(), getUpcomingEvents()]);
  return [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    ...["trips", "two-games", "near-me"].map((p) => ({ url: `${BASE}/${p}`, changeFrequency: "daily" as const, priority: 0.8 })),
    { url: `${BASE}/about` },
    { url: `${BASE}/privacy` },
    ...leagues.map((l) => ({ url: `${BASE}/leagues/${l.id}`, changeFrequency: "daily" as const, priority: 0.9 })),
    ...teams.map((t) => ({ url: `${BASE}/teams/${t.id}`, changeFrequency: "daily" as const })),
    ...events.map((e) => ({ url: `${BASE}/events/${e.id}`, changeFrequency: "hourly" as const })),
  ];
}
