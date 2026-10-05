"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readSaved, SAVED_EVENT } from "@/lib/saved";

/** "My games" in the header, with how many are saved. */
export function SavedLink() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(Object.keys(readSaved()).length);
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return (
    <Link
      href="/saved"
      className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <span aria-hidden className={count ? "text-hot" : ""}>{count ? "♥" : "♡"}</span>
      <span className="hidden sm:inline">My games</span>
      {count > 0 && <span className="tabular rounded-full bg-hot px-1.5 text-[12px] font-bold text-white">{count}</span>}
    </Link>
  );
}
