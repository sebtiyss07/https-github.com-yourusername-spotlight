import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-28 text-center sm:px-8">
      <p className="font-display text-[64px] font-extrabold leading-none text-accent">404</p>
      <h1 className="mt-4 text-[28px] font-extrabold">We can&apos;t find that page</h1>
      <p className="mt-2 text-[15px] text-ink-3">
        The game may already have been played, or the link may be wrong.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-accent px-6 py-3 font-bold text-white transition-colors hover:bg-accent-2"
      >
        Back to home
      </Link>
    </div>
  );
}
