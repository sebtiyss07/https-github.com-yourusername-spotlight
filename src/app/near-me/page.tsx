import type { Metadata } from "next";
import { NearMe } from "@/components/NearMe";

export const metadata: Metadata = {
  title: "Games near me",
  description: "The cheapest upcoming games within driving distance of your city, across the NFL, NBA, MLS, Premier League, Champions League and F1.",
};

export default function NearMePage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <h1 className="text-[30px] font-extrabold leading-tight sm:text-[38px]">Games near me</h1>
      <p className="mt-2 text-ink-3">
        Every league, cheapest first: what can you go and see without getting on a plane?
      </p>
      <div className="mt-6">
        <NearMe />
      </div>
    </div>
  );
}
