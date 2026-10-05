import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { HeaderSearch } from "@/components/HeaderSearch";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { LeagueNav } from "@/components/LeagueNav";
import { NAV_LEAGUES } from "@/lib/nav";
import { LogoMark } from "@/components/Logo";
import { getCurrency } from "@/lib/currency";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const SITE_URL = "https://www.spotlightkt.com";
const DESCRIPTION =
  "Compare ticket prices across every major ticket site for NFL, NBA, MLS, Premier League, Champions League and Formula 1, cheapest first, then add the cheapest hotel and flight for the same dates.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Spotlight: compare sports ticket prices",
    template: "%s · Spotlight",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Spotlight",
    title: "Spotlight: compare sports ticket prices",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: { card: "summary", title: "Spotlight: compare sports ticket prices", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currency = await getCurrency();
  return (
    <html lang="en" className={geist.variable}>
      <head>
        {/* Impact.com site ownership check for the affiliate programs. */}
        {/* @ts-expect-error Impact reads a `value` attribute, not `content`. */}
        <meta name="impact-site-verification" value="efec0309-eec0-40ec-96f6-0d0cdcfa841a" />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:font-medium"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-2.5 sm:h-14 sm:flex-nowrap sm:px-6 sm:py-0">
            <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Spotlight home">
              <LogoMark size={26} />
              <span className="text-[17px] font-medium tracking-tight text-ink">Spotlight</span>
            </Link>
            <HeaderSearch />
            <div className="ml-auto sm:ml-0">
              <CurrencySwitcher current={currency} />
            </div>
          </div>
          <LeagueNav />
        </header>

        <main id="main" className="flex-1">
          {children}
        </main>

        <footer className="mt-24 border-t border-line text-ink-3">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 text-[14px] sm:grid-cols-[1.4fr_1fr_1fr] sm:px-6">
            <div className="max-w-sm space-y-3">
              <Link href="/" className="flex items-center gap-2 text-ink">
                <LogoMark size={22} />
                <span className="text-[16px] font-medium tracking-tight">Spotlight</span>
              </Link>
              <p>
                We compare the ticket sites so you don&apos;t have to. Prices are the lowest each
                site listed when we checked, never estimates. You buy on the ticket site itself.
              </p>
            </div>
            <nav aria-label="Leagues in footer">
              <p className="font-medium text-ink">Leagues</p>
              <ul className="mt-3 space-y-2">
                {NAV_LEAGUES.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="About Spotlight">
              <p className="font-medium text-ink">Spotlight</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/about" className="hover:text-ink">About and how prices work</Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-ink">Privacy</Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className="border-t border-line">
            <p className="mx-auto max-w-6xl px-5 py-5 text-[12px] text-ink-3 sm:px-6">
              Some links may be affiliate links: if you buy through them, the site may pay us a
              commission. It never changes your price or the order we show. Prices change fast, so
              always check the final price before you pay. © 2026 Spotlight.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
