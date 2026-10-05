"use client";

import { useEffect, useState } from "react";
import { readSaved, writeSaved, SAVED_EVENT, type SavedGame } from "@/lib/saved";

/** Save, share and add-to-calendar for one game, on its page header. */
export function GameActions({ game }: { game: Omit<SavedGame, "savedOn"> }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(game.id in readSaved());
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    return () => window.removeEventListener(SAVED_EVENT, sync);
  }, [game.id]);

  const toggle = () => {
    const all = readSaved();
    if (all[game.id]) delete all[game.id];
    else all[game.id] = { ...game, savedOn: new Date().toISOString().slice(0, 10) };
    writeSaved(all);
  };

  const share = async () => {
    const url = `${location.origin}/events/${game.id}`;
    const text = game.price !== null ? `${game.title}: tickets compared on Spotlight` : game.title;
    try {
      if (navigator.share) return await navigator.share({ title: game.title, text, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet closed: nothing to do.
    }
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[14px] font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white hover:text-ink";
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <button type="button" onClick={toggle} aria-pressed={saved} className={`${btn} ${saved ? "bg-white text-ink" : ""}`}>
        <span aria-hidden className={saved ? "text-hot" : ""}>{saved ? "♥" : "♡"}</span>
        {saved ? "Saved" : "Save"}
      </button>
      <button type="button" onClick={share} className={btn}>
        <span aria-hidden>↗</span>
        {copied ? "Link copied" : "Share"}
      </button>
      <a href={`/events/${game.id}/calendar`} className={btn}>
        <span aria-hidden>📅</span>
        Add to calendar
      </a>
    </div>
  );
}
