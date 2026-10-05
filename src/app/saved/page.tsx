import type { Metadata } from "next";
import { SavedGames } from "@/components/SavedGames";

export const metadata: Metadata = {
  title: "My games",
  description: "Games you saved, with how their cheapest ticket price has moved since.",
  robots: { index: false },
};

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <h1 className="text-[30px] font-extrabold leading-tight sm:text-[38px]">My games</h1>
      <p className="mt-2 text-ink-3">
        Games you saved, and how their cheapest ticket has moved since. Saved on this device only.
      </p>
      <div className="mt-6">
        <SavedGames />
      </div>
    </div>
  );
}
