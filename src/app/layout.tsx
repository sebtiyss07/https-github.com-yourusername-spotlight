import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { SiteSearch } from "@/components/SiteSearch";
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
    "Compare ticket prices for every Premier League match across ticket sites, then book flights and a hotel for the exact dates.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currency = await getCurrency();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen">
        <header className="sticky top-0 z-50 border-b border-line bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
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

            <div className="ml-auto flex w-full max-w-sm items-center gap-2">
              <div className="min-w-0 flex-1">
                <SiteSearch />
              </div>
              <CurrencySwitcher current={currency} />
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-24 border-t border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-[13px] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="max-w-xl">
              Ticket prices are the lowest each site listed when we last checked,
              never estimates. They change fast, so always check the final price on
              the booking site before you pay.
            </p>
            <Link href="/" className="font-medium text-ink-2 hover:text-ink">
              © Spotlight
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
