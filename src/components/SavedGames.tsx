"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readSaved, writeSaved, SAVED_EVENT, type SavedGame } from "@/lib/saved";
import { formatPrice } from "@/lib/format";

interface Now {
  price: number | null;
  site: string | null;
  currency: string;
}

/** The saved games with today's cheapest price next to the price when saved. */
export function SavedGames() {
  const [saved, setSaved] = useState<Record<string, SavedGame> | null>(null);
  const [now, setNow] = useState<Record<string, Now>>({});

  useEffect(() => {
    const sync = () => setSaved(readSaved());
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    return () => window.removeEventListener(SAVED_EVENT, sync);
  }, []);

  useEffect(() => {
    const ids = Object.keys(saved ?? {});
    if (!ids.length) return;
    fetch(`/api/games?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((d: { games: (Now & { id: string })[] }) => setNow(Object.fromEntries(d.games.map((g) => [g.id, g]))))
      .catch(() => {});
  }, [saved]);

  if (saved === null) return null;
  const games = Object.values(saved).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (!games.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line-bright bg-surface px-6 py-12 text-center">
        <p className="text-[16px] font-semibold">No saved games yet</p>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] text-ink-3">
          Tap <span aria-hidden>♡</span> Save on any game to keep an eye on its price here.
        </p>
        <Link href="/" className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 font-bold text-white hover:bg-accent-2">
          Find a game
        </Link>
      </div>
    );
  }

  const remove = (id: string) => {
    const all = readSaved();
    delete all[id];
    writeSaved(all);
  };
  const played = (g: SavedGame) => Date.parse(g.startsAt) < Date.now();

  return (
    <ul className="flex flex-col gap-2.5">
      {games.map((g) => {
        const n = now[g.id];
        const sameCurrency = n && n.currency === g.currency;
        const diff = sameCurrency && n.price !== null && g.price !== null ? Math.round((n.price - g.price) * 100) / 100 : null;
        const date = new Date(g.startsAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        return (
          <li key={g.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xs sm:gap-4">
            <Link href={`/events/${g.id}`} className="group min-w-0 flex-1">
              <p className="line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-accent">{g.title}</p>
              <p className="truncate text-[13px] text-ink-3">
                {date} · {g.place}
              </p>
              {played(g) ? (
                <p className="mt-1 text-[13px] text-ink-3">This game has been played.</p>
              ) : diff === null ? null : diff < 0 ? (
                <p className="mt-1 text-[13px] font-semibold text-positive">
                  ↓ {formatPrice(-diff, g.currency)} cheaper than when you saved it
                </p>
              ) : diff > 0 ? (
                <p className="mt-1 text-[13px] font-semibold text-hot">
                  ↑ {formatPrice(diff, g.currency)} more than when you saved it
                </p>
              ) : (
                <p className="mt-1 text-[13px] text-ink-3">Same price as when you saved it</p>
              )}
            </Link>
            {n?.price != null && !played(g) && (
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-ink-3">now from</p>
                <p className="tabular text-[17px] font-extrabold leading-tight text-positive">{formatPrice(n.price, n.currency)}</p>
                <p className="hidden text-[11px] text-ink-3 sm:block">on {n.site}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(g.id)}
              aria-label={`Remove ${g.title}`}
              className="shrink-0 rounded-full px-2 py-1 text-[18px] text-hot hover:bg-surface-2"
            >
              ♥
            </button>
          </li>
        );
      })}
    </ul>
  );
}
