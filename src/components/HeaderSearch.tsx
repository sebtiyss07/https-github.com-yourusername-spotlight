"use client";

import { usePathname } from "next/navigation";
import { SiteSearch } from "@/components/SiteSearch";

/** The header's search, left out on the home page, which has its own big one. */
export function HeaderSearch() {
  const path = usePathname();
  // Home: keep the space, so the currency buttons stay at the right edge.
  if (path === "/") return <div aria-hidden className="hidden sm:block sm:ml-auto" />;
  return (
    // Phones: its own full-width row under the logo.
    <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto sm:max-w-sm sm:flex-1">
      <SiteSearch />
    </div>
  );
}
