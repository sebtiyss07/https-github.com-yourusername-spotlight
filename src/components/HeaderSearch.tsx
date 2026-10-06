"use client";

import { SiteSearch } from "@/components/SiteSearch";

/** The header's search for any team, league or game (the home page leads with the trip planner). */
export function HeaderSearch() {
  return (
    // Phones: its own full-width row under the logo.
    <div className="order-last w-full sm:order-none sm:ml-4 sm:w-auto sm:max-w-md sm:flex-1">
      <SiteSearch />
    </div>
  );
}
