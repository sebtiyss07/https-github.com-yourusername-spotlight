/**
 * Licensed club crests.
 *
 * ## Why this file is empty
 *
 * Club badges are registered trademarks. Hotlinking them from a league or
 * broadcaster CDN is unlicensed trademark use *and* bandwidth theft, and it's
 * the sort of thing that draws a cease-and-desist once a commercial site gets
 * traction. So the seed data ships without them and `TeamMark` draws a mark
 * from each club's authentic colours instead.
 *
 * ## Turning real crests on
 *
 * Add entries here, keyed by team id. Nothing else in the app changes —
 * `TeamMark` renders the image the moment a URL exists for that team:
 *
 * ```ts
 * export const TEAM_LOGOS: Record<string, string> = {
 *   arsenal: "https://cdn.yourhost.com/crests/arsenal.svg",
 *   "man-city": "https://cdn.yourhost.com/crests/man-city.svg",
 * };
 * ```
 *
 * ## Where to get them legitimately
 *
 * - **SportsDataIO** — logos bundled with their data licence, ~$50–200/mo
 *   depending on leagues. Simplest route for NBA/NFL/MLB/NHL.
 * - **API-Sports (api-football etc.)** — cheaper, good European football
 *   coverage; check the tier's terms for commercial redistribution rights.
 * - **Direct club or league agreement** — what you'll eventually want if this
 *   becomes a real affiliate business, and often free for sites that drive
 *   ticket sales.
 *
 * Whichever you choose, **self-host the files**. A licence to use a crest is not
 * a licence to hammer someone else's CDN, and a third-party URL will break
 * without notice.
 *
 * Prefer SVG, or PNG at 2× the largest render size (the crest renders at 64px
 * on team pages, so 128px minimum).
 */
export const TEAM_LOGOS: Record<string, string> = {};

/** Resolves a licensed crest for a team, if one has been configured. */
export function logoFor(teamId: string): string | undefined {
  return TEAM_LOGOS[teamId];
}
