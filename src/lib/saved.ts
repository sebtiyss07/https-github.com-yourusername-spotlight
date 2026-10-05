"use client";

/**
 * Saved games, kept on the visitor's device (localStorage): no account.
 * Each entry remembers the cheapest price when it was saved, so "My games"
 * can show whether it has gone up or down since.
 */
export interface SavedGame {
  id: string;
  title: string;
  startsAt: string;
  place: string;
  price: number | null;
  currency: string;
  savedOn: string;
}

const KEY = "spotlight-saved";
export const SAVED_EVENT = "spotlight-saved-change";

export function readSaved(): Record<string, SavedGame> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function writeSaved(all: Record<string, SavedGame>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Private mode or storage full: saving just doesn't stick.
  }
  window.dispatchEvent(new Event(SAVED_EVENT));
}
