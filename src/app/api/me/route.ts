import { auth, clerkClient } from "@clerk/nextjs/server";
import { authEnabled, cleanSaved, type AccountData } from "@/lib/auth";

/** The signed-in person's saved games and alert setting. */
export async function GET() {
  if (!authEnabled) return Response.json({ error: "accounts-off" }, { status: 404 });
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "signed-out" }, { status: 401 });
  const user = await (await clerkClient()).users.getUser(userId);
  const data = user.privateMetadata as Partial<AccountData>;
  return Response.json({ saved: cleanSaved(data.saved), alerts: data.alerts === true });
}

/** Saves the list of games and/or the alert setting. */
export async function POST(req: Request) {
  if (!authEnabled) return Response.json({ error: "accounts-off" }, { status: 404 });
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "signed-out" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { saved?: unknown; alerts?: unknown } | null;
  if (!body) return Response.json({ error: "bad-request" }, { status: 400 });
  const patch: Partial<AccountData> = {};
  if ("saved" in body) patch.saved = cleanSaved(body.saved);
  if (typeof body.alerts === "boolean") patch.alerts = body.alerts;
  await (await clerkClient()).users.updateUserMetadata(userId, { privateMetadata: patch });
  return Response.json({ ok: true });
}
