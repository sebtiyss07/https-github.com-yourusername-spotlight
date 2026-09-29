import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: "What Spotlight does, where its prices come from, and how it makes money.",
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <h1 className="text-[32px] font-semibold">About Spotlight</h1>
      <p className="mt-4 text-[17px] text-ink-2">
        Spotlight helps you plan a trip to a game. Pick a match or race and we show the
        cheapest ticket on every site that sells it, side by side, then add the cheapest
        hotel near the venue and a flight for the same dates, so you see what the whole
        trip costs before you book.
      </p>

      <h2 className="mt-10 text-[20px] font-semibold">What we cover</h2>
      <p className="mt-2 text-[16px] text-ink-2">
        The NFL, NBA, MLS, the Premier League, the Champions League, the Europa League and
        Formula 1.
      </p>

      <h2 className="mt-10 text-[20px] font-semibold">Where the prices come from</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-[16px] text-ink-2">
        <li>
          Ticket prices are read from each ticket site&apos;s own listings for that game. We
          show the cheapest ticket you can buy on its own, and leave out parking passes,
          tailgate passes and add-ons. Every price is dated with when we checked it.
        </li>
        <li>
          Where a site doesn&apos;t share its price with us, we say so and link straight to
          that game on its site instead of guessing a number.
        </li>
        <li>Hotel prices are Booking.com&apos;s prices for the exact nights, before local taxes.</li>
        <li>We never estimate or invent a price. Prices change fast, so always check the final price before you pay.</li>
      </ul>

      <h2 className="mt-10 text-[20px] font-semibold">How Spotlight makes money</h2>
      <p className="mt-2 text-[16px] text-ink-2">
        Some links to ticket, hotel and travel sites may be affiliate links: if you buy
        through them, the site may pay us a commission. It never changes the price you
        pay, and it never changes the order we show sites in. They are always sorted by
        price, cheapest first. See our{" "}
        <Link href="/privacy" className="text-accent hover:underline">
          privacy policy
        </Link>{" "}
        for what we store.
      </p>
    </article>
  );
}
