"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { readSaved, writeSaved, SAVED_EVENT, type SavedGame } from "@/lib/saved";
import type { StoredGame } from "@/lib/auth";

const toStored = (all: Record<string, SavedGame>): StoredGame[] =>
  Object.values(all).map((g) => [g.id, g.price, g.currency, g.savedOn]);

/**
 * Keeps "My games" in the signed-in person's account. The device keeps its
 * own copy (instant, works offline); the account is the master copy:
 * - the first time on a device, both lists are combined;
 * - after that, the account's list replaces the device's on each visit;
 * - every save or removal is sent to the account.
 */
export function AccountSync() {
  const { isSignedIn, userId } = useAuth();
  const ready = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      ready.current = false;
      return;
    }
    let cancelled = false;
    const flagKey = `spotlight-synced-${userId}`;
    (async () => {
      const res = await fetch("/api/me");
      if (!res.ok || cancelled) return;
      const account = (await res.json()) as { saved: StoredGame[] };
      const local = readSaved();
      let firstTime = true;
      try {
        firstTime = localStorage.getItem(flagKey) !== "1";
      } catch {}
      const merged: Record<string, SavedGame> = firstTime ? { ...local } : {};
      const missing: StoredGame[] = [];
      for (const g of account.saved) {
        if (merged[g[0]]) continue;
        if (local[g[0]]) merged[g[0]] = local[g[0]];
        else missing.push(g);
      }
      // Games saved on another device: fetch their names and dates.
      if (missing.length) {
        const info = await fetch(`/api/games?ids=${missing.map((g) => g[0]).join(",")}`)
          .then((r) => r.json() as Promise<{ games: { id: string; title: string; startsAt: string; place: string }[] }>)
          .catch(() => ({ games: [] }));
        const byId = new Map(info.games.map((g) => [g.id, g]));
        for (const [id, price, currency, savedOn] of missing) {
          const i = byId.get(id);
          if (i) merged[id] = { id, title: i.title, startsAt: i.startsAt, place: i.place, price, currency, savedOn };
        }
      }
      if (cancelled) return;
      writeSaved(merged);
      try {
        localStorage.setItem(flagKey, "1");
      } catch {}
      ready.current = true;
      if (firstTime) await push(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      if (!ready.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => push(readSaved()), 400);
    };
    window.addEventListener(SAVED_EVENT, onChange);
    return () => {
      window.removeEventListener(SAVED_EVENT, onChange);
      clearTimeout(timer);
    };
  }, []);

  return null;
}

function push(all: Record<string, SavedGame>) {
  return fetch("/api/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ saved: toStored(all) }),
  }).catch(() => {});
}
