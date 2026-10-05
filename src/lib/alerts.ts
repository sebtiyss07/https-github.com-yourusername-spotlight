import { createHmac, timingSafeEqual } from "node:crypto";

export const SITE_URL = "https://www.spotlightkt.com";

/** Signs a user id so an unsubscribe link works without signing in. */
export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", process.env.CRON_SECRET ?? "").update(`unsubscribe:${userId}`).digest("hex").slice(0, 32);
}

export function validUnsubscribe(userId: string, token: string): boolean {
  if (!process.env.CRON_SECRET || !userId || !token) return false;
  const a = Buffer.from(unsubscribeToken(userId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const unsubscribeUrl = (userId: string) =>
  `${SITE_URL}/api/alerts/unsubscribe?${new URLSearchParams({ u: userId, t: unsubscribeToken(userId) })}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface Drop {
  id: string;
  title: string;
  when: string;
  now: string;
  was: string;
  site: string;
}

/** The price-drop email: what got cheaper, where, and why they're getting it. */
export function dropEmail(drops: Drop[], unsubscribe: string) {
  const subject =
    drops.length === 1 ? `Cheaper now: ${drops[0].title} (${drops[0].now})` : `${drops.length} of your saved games got cheaper`;
  const rows = drops
    .map(
      (d) => `<tr><td style="padding:12px 0;border-bottom:1px solid #dde3ee">
<a href="${SITE_URL}/events/${encodeURIComponent(d.id)}" style="color:#0b1324;font-weight:700;font-size:16px;text-decoration:none">${esc(d.title)}</a><br>
<span style="color:#56627a;font-size:13px">${esc(d.when)}</span><br>
<span style="font-size:15px"><b style="color:#047a43">${esc(d.now)}</b> on ${esc(d.site)} <span style="color:#56627a">(was ${esc(d.was)})</span></span>
</td></tr>`,
    )
    .join("");
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1324">
<p style="font-size:20px;font-weight:800;margin:0 0 4px">${drops.length === 1 ? "A saved game got cheaper" : "Your saved games got cheaper"}</p>
<p style="color:#56627a;font-size:14px;margin:0 0 8px">The cheapest ticket with fees included, from today's check. Prices move fast: confirm on the site before you buy.</p>
<table style="width:100%;border-collapse:collapse">${rows}</table>
<p style="margin:20px 0"><a href="${SITE_URL}/saved" style="background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">See My games</a></p>
<p style="color:#56627a;font-size:12px">You're getting this because you turned on price-drop emails on Spotlight. <a href="${unsubscribe}" style="color:#56627a">Unsubscribe</a> with one click.</p>
</div>`;
  const text = [
    drops.length === 1 ? "A saved game got cheaper" : "Your saved games got cheaper",
    "",
    ...drops.map((d) => `${d.title} (${d.when}): ${d.now} on ${d.site}, was ${d.was}\n${SITE_URL}/events/${d.id}`),
    "",
    "Prices move fast: confirm on the site before you buy.",
    `Unsubscribe: ${unsubscribe}`,
  ].join("\n");
  return { subject, html, text };
}

/** Sends one email with Resend; true when accepted. */
export async function sendEmail(to: string, email: { subject: string; html: string; text: string }, unsubscribe: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERTS_FROM,
      to: [to],
      ...email,
      headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  return res.ok;
}
