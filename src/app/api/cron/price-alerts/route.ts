import { clerkClient } from "@clerk/nextjs/server";
import { authEnabled, cleanSaved, type AccountData } from "@/lib/auth";
import { dropEmail, sendEmail, unsubscribeUrl, type Drop } from "@/lib/alerts";
import { getEvent, liveAllInOffer } from "@/lib/repositories";
import { eventTitle } from "@/lib/data/events";
import { formatPrice } from "@/lib/format";
import type { Currency } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** A drop worth an email: at least 3% and at least 1 (dollar, euro or pound). */
const worthIt = (now: number, before: number) => now <= before - Math.max(1, before * 0.03);

/**
 * Daily (vercel.json): for everyone who turned price-drop emails on, checks
 * each saved game's cheapest price with fees included, read live, against
 * the price when saved (or the last price we emailed about), and sends one
 * email listing the drops. ?dry=1 lists what would be sent without sending.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!authEnabled || !process.env.RESEND_API_KEY || !process.env.ALERTS_FROM) {
    return Response.json({ error: "not-configured" }, { status: 503 });
  }
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const clerk = await clerkClient();
  const report = { users: 0, emails: 0, drops: 0, failed: 0, preview: [] as { to: string; subject: string }[] };

  for (let offset = 0; ; offset += 100) {
    const { data: users } = await clerk.users.getUserList({ limit: 100, offset });
    for (const user of users) {
      const meta = user.privateMetadata as Partial<AccountData>;
      const email = user.primaryEmailAddress?.emailAddress;
      if (meta.alerts !== true || !email) continue;
      report.users++;
      const saved = cleanSaved(meta.saved);
      const alerted: Record<string, number> = {};
      const drops: Drop[] = [];
      for (const [id, savedPrice, currency] of saved) {
        const event = await getEvent(id);
        if (!event || Date.parse(event.startsAt) < Date.now()) continue;
        const offer = await liveAllInOffer(event, currency as Currency);
        const before = meta.alerted?.[id] ?? savedPrice;
        if (!offer || before === null) continue;
        alerted[id] = meta.alerted?.[id] ?? before;
        if (!worthIt(offer.amount, before)) continue;
        alerted[id] = offer.amount;
        drops.push({
          id,
          title: eventTitle(event),
          when: new Date(event.startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
          now: formatPrice(offer.amount, currency),
          was: formatPrice(before, currency),
          site: offer.label,
        });
      }
      if (!drops.length) continue;
      report.drops += drops.length;
      const unsubscribe = unsubscribeUrl(user.id);
      const message = dropEmail(drops, unsubscribe);
      if (dry) {
        report.preview.push({ to: email.replace(/^(.).*(@.*)$/, "$1…$2"), subject: message.subject });
        continue;
      }
      if (await sendEmail(email, message, unsubscribe)) {
        report.emails++;
        await clerk.users.updateUserMetadata(user.id, { privateMetadata: { alerted } });
      } else report.failed++;
    }
    if (users.length < 100) break;
  }
  return Response.json(report);
}
