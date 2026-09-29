import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { HeaderSearch } from "@/components/HeaderSearch";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { getCurrency } from "@/lib/currency";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Spotlight — tickets, flights and hotels for the big game",
    template: "%s · Spotlight",
  },
  description:
    "Compare ticket prices across ticket sites for NFL, NBA, MLS, Premier League, Champions League and Formula 1, then add the cheapest hotel and flight for the exact dates.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currency = await getCurrency();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        {/* Impact.com site ownership check for the affiliate programs. */}
        {/* @ts-expect-error Impact reads a `value` attribute, not `content`. */}
        <meta name="impact-site-verification" value="efec0309-eec0-40ec-96f6-0d0cdcfa841a" />
      </head>
      <body className="min-h-screen">
        <header className="sticky top-0 z-50 border-b border-line bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2.5 px-5 py-2.5 sm:h-16 sm:flex-nowrap sm:px-8 sm:py-0">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-accent to-accent-2 font-display text-[16px] font-bold text-white shadow-sm">
                S
              </span>
              <span className="font-display text-[18px] font-semibold tracking-tight">
                Spotlight
              </span>
            </Link>

            <nav className="hidden items-center gap-1 text-[14px] font-medium text-ink-2 md:flex">
              <Link href="/#leagues" className="rounded-full px-3 py-1.5 hover:bg-surface-2 hover:text-ink">
                Leagues
              </Link>
              <Link href="/events" className="rounded-full px-3 py-1.5 hover:bg-surface-2 hover:text-ink">
                Big events
              </Link>
            </nav>

            <HeaderSearch />
            <div className="ml-auto sm:ml-0">
              <CurrencySwitcher current={currency} />
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-24 border-t border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-[13px] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="max-w-xl space-y-2">
              <p>
                Ticket prices are the lowest each site listed when we last checked,
                never estimates. They change fast, so always check the final price on
                the booking site before you pay.
              </p>
              <p>
                Some links may be affiliate links: if you buy through them, the site may
                pay us a commission. It never changes your price or the order we show.
              </p>
            </div>
            <nav className="flex gap-4 font-medium text-ink-2">
              <Link href="/about" className="hover:text-ink">About</Link>
              <Link href="/privacy" className="hover:text-ink">Privacy</Link>
              <Link href="/" className="hover:text-ink">© Spotlight</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
