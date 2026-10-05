"use client";

import Link from "next/link";

/** Shown if a page fails to load, with a way to try again. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-28 text-center">
      <h1 className="text-[28px] font-semibold">Something went wrong</h1>
      <p className="mt-2 text-ink-3">
        This page didn&apos;t load properly. It&apos;s usually a brief hiccup, so please try again.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent-2"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-line bg-surface px-6 py-3 font-medium transition-colors hover:border-accent hover:text-accent"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
