import Link from "next/link";
import type { EventContext } from "@/lib/repositories";
import { formatPrice } from "@/lib/format";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** "2026-10-24" for the day the game is played, in the venue's time zone. */
const localYmd = (c: EventContext) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: c.venue?.timeZone ?? "UTC" }).format(new Date(c.event.startsAt));

/**
 * A team's season as month calendars, like a flight-price calendar: every
 * game day shows its cheapest ticket, coloured by how it compares with this
 * team's other games (cheapest third green, priciest third orange).
 */
export function PriceCalendar({ games }: { games: EventContext[] }) {
  const byDay = new Map<string, { c: EventContext; price: number | null }>();
  for (const c of games) {
    const ymd = localYmd(c);
    const price = c.prices.cheapest?.amount ?? null;
    const prev = byDay.get(ymd);
    if (!prev || (price != null && (prev.price == null || price < prev.price))) byDay.set(ymd, { c, price });
  }
  const priced = [...byDay.values()].flatMap((d) => (d.price == null ? [] : [d.price])).sort((a, b) => a - b);
  if (priced.length < 3) return null;
  const low = priced[Math.floor(priced.length / 3)];
  const high = priced[Math.floor((priced.length * 2) / 3)];
  const currency = games[0].prices.currency;

  const days = [...byDay.keys()].sort();
  const months: { y: number; m: number }[] = [];
  for (let [y, m] = days[0].split("-").map(Number); ; m === 12 ? ((m = 1), y++) : m++) {
    months.push({ y, m });
    if (`${y}-${String(m).padStart(2, "0")}` >= days[days.length - 1].slice(0, 7)) break;
  }

  const tone = (p: number) =>
    p < low
      ? "bg-positive/12 text-positive ring-positive/30"
      : p >= high
        ? "bg-warn/10 text-warn ring-warn/25"
        : "bg-surface-2 text-ink ring-line-bright";

  return (
    <section aria-labelledby="price-calendar" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="price-calendar" className="text-[20px] font-bold">
            Price calendar
          </h2>
          <p className="text-[14px] text-ink-3">The cheapest ticket on each game day. Tap a day to compare every site.</p>
        </div>
        <p className="flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-positive/40" aria-hidden /> Cheaper
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-surface-3" aria-hidden /> Typical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-warn/40" aria-hidden /> Pricier
          </span>
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {months.map(({ y, m }) => {
          const first = new Date(Date.UTC(y, m - 1, 1));
          const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
          const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
          return (
            <div key={`${y}-${m}`} className="rounded-2xl border border-line bg-surface p-3 shadow-xs">
              <h3 className="px-1 text-[15px] font-bold">{label}</h3>
              <div className="mt-2 grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((d, i) => (
                  <span key={i} className="text-[11px] font-semibold text-ink-3" aria-hidden>
                    {d}
                  </span>
                ))}
                {Array.from({ length: first.getUTCDay() }, (_, i) => (
                  <span key={`pad${i}`} />
                ))}
                {Array.from({ length: count }, (_, i) => {
                  const ymd = `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                  const game = byDay.get(ymd);
                  if (!game) {
                    return (
                      <span key={ymd} className="py-2 text-[13px] text-ink-3/60">
                        {i + 1}
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={ymd}
                      href={`/events/${game.c.event.id}`}
                      title={`${game.c.title}${game.price != null ? `: from ${formatPrice(game.price, currency)}` : ""}`}
                      className={`flex flex-col items-center rounded-lg py-1 ring-1 transition-transform hover:-translate-y-0.5 hover:shadow-md ${
                        game.price == null ? "bg-surface text-ink-2 ring-line" : tone(game.price)
                      }`}
                    >
                      <span className="text-[13px] font-bold leading-tight">{i + 1}</span>
                      <span className="tabular text-[10px] font-semibold leading-tight sm:text-[11px]">
                        {game.price == null ? "—" : formatPrice(game.price, currency)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
