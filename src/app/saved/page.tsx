import type { Metadata } from "next";
import { SavedGames } from "@/components/SavedGames";
import { AccountPanel } from "@/components/AccountPanel";
import { authEnabled } from "@/lib/auth";

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
        Games you saved, and how their cheapest ticket has moved since.
        {authEnabled ? " Signed in, they're kept in your account on every device." : " Saved on this device only."}
      </p>
      {authEnabled && (
        <div className="mt-5">
          <AccountPanel />
        </div>
      )}
      <div className="mt-6">
        <SavedGames />
      </div>
    </div>
  );
}
