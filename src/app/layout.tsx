import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteSearch } from "@/components/SiteSearch";
import { categoryState } from "@/lib/providers";

export const metadata: Metadata = {
  title: {
    default: "Spotlight — every game, every ticket, every route",
    template: "%s · Spotlight",
  },
  description:
    "Every sporting event on earth, with the cheapest ticket, the way to get there, and somewhere to stay — on one page.",
};

const CATEGORIES = [
  { kind: "tickets" as const, label: "Tickets" },
  { kind: "travel" as const, label: "Flights" },
  { kind: "stays" as const, label: "Stays" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reports observed behaviour, not just configuration — a rejected key must
  // read as failing rather than as working inventory.
  const states = CATEGORIES.map((c) => ({ ...c, ...categoryState(c.kind) }));
  const anyLive = states.some((s) => s.state === "live");
  const anyFailing = states.some((s) => s.state === "failing");

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 sm:px-8">
            <Link href="/" className="group flex items-center gap-2.5 shrink-0">
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-ink text-[15px] font-black text-surface">
                S
              </span>
              <span className="text-[15px] font-bold tracking-tight">
                Spotlight
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {[
                { href: "/", label: "Sports" },
                { href: "/events", label: "Championships" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto w-full max-w-xs">
              <SiteSearch />
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-24 border-t border-line bg-surface">
          <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md">
                <p className="text-sm font-semibold">Spotlight</p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
                  {anyFailing
                    ? "A configured provider isn't responding, so prices have fallen back to generated seed data. Run npm run check:providers to diagnose."
                    : anyLive
                      ? "Live inventory is shown where a provider is connected. Everything else is generated seed data."
                      : "Prices, availability, and schedules shown here are generated seed data. Add provider credentials to .env.local to show live inventory."}
                </p>
              </div>
              <div className="text-[13px]">
                <p className="font-medium text-ink-2">Integration status</p>
                <div className="mt-2 space-y-1">
                  {states.map(({ kind, label, state, detail }) => (
                    <p key={kind} className="flex items-center gap-2 text-ink-3">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          state === "live"
                            ? "bg-positive"
                            : state === "failing"
                              ? "bg-hot"
                              : state === "configured"
                                ? "bg-warn"
                                : "bg-ink-3"
                        }`}
                      />
                      {label} · {detail}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
