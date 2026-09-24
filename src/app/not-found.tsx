import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-32 text-center sm:px-8">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        404
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight">
        We couldn&apos;t find that
      </h1>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-2">
        That sport, team, or event isn&apos;t in the catalogue — or the fixture
        has already been played.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-ink px-5 py-2.5 text-[14px] font-semibold text-surface transition-opacity hover:opacity-90"
      >
        Back to all sports
      </Link>
    </div>
  );
}
