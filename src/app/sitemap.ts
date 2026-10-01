import type { MetadataRoute } from "next";
import { getLeagues, getTeams, getUpcomingEvents } from "@/lib/repositories";

const BASE = "https://spotlight-steel.vercel.app";

/** Every page a visitor can reach: leagues, teams and each upcoming game. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [leagues, teams, events] = await Promise.all([getLeagues(), getTeams(), getUpcomingEvents()]);
  return [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/about` },
    { url: `${BASE}/privacy` },
    ...leagues.map((l) => ({ url: `${BASE}/leagues/${l.id}`, changeFrequency: "daily" as const, priority: 0.9 })),
    ...teams.map((t) => ({ url: `${BASE}/teams/${t.id}`, changeFrequency: "daily" as const })),
    ...events.map((e) => ({ url: `${BASE}/events/${e.id}`, changeFrequency: "hourly" as const })),
  ];
}
