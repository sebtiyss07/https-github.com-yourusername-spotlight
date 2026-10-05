import { clerkClient } from "@clerk/nextjs/server";
import { authEnabled } from "@/lib/auth";
import { SITE_URL, validUnsubscribe } from "@/lib/alerts";

/** One-click unsubscribe from price-drop emails (link in every email; no sign-in needed). */
async function unsubscribe(req: Request) {
  const q = new URL(req.url).searchParams;
  const userId = q.get("u") ?? "";
  if (!authEnabled || !validUnsubscribe(userId, q.get("t") ?? "")) {
    return new Response("This unsubscribe link isn't valid. You can turn emails off on My games after signing in.", { status: 400 });
  }
  await (await clerkClient()).users.updateUserMetadata(userId, { privateMetadata: { alerts: false } });
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title>
<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#0b1324">
<h1 style="font-size:22px">You're unsubscribed</h1>
<p style="color:#56627a">You won't get price-drop emails from Spotlight any more. Your saved games are still in your account.</p>
<p><a href="${SITE_URL}/saved" style="color:#1d4ed8;font-weight:700">Back to My games</a></p></div>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// The link opens a page with a button: link scanners in some mail systems
// open every link, which must not unsubscribe anyone. The button, and email
// apps' own one-click unsubscribe (List-Unsubscribe-Post), send a POST.
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (!validUnsubscribe(q.get("u") ?? "", q.get("t") ?? "")) {
    return new Response("This unsubscribe link isn't valid. You can turn emails off on My games after signing in.", { status: 400 });
  }
  const action = `/api/alerts/unsubscribe?${new URLSearchParams({ u: q.get("u")!, t: q.get("t")! })}`;
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title>
<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#0b1324">
<h1 style="font-size:22px">Stop price-drop emails?</h1>
<form method="post" action="${action}"><button style="background:#1d4ed8;color:#fff;border:0;padding:12px 18px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer">Unsubscribe</button></form></div>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const POST = unsubscribe;
