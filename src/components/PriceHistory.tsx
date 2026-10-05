"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";

interface Point {
  date: string;
  price: number;
}

const W = 600;
const H = 160;
const PAD = { top: 16, right: 12, bottom: 8, left: 12 };

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * How the cheapest price on Spotlight moved, one point per daily check. One
 * series, so no legend: the heading names it. Hover or focus a day for its
 * price; the same numbers are in the table below the chart.
 */
export function PriceHistory({ points, currency }: { points: Point[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const money = (n: number) => formatPrice(n, currency);

  if (points.length < 2) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-line-bright bg-surface px-5 py-4 text-[14px] text-ink-2">
        <span className="font-semibold text-ink">Price history.</span>{" "}
        {points.length
          ? `We started tracking this game's cheapest price on ${shortDate(points[0].date)}. A chart of how it moves appears after the next daily check.`
          : "We'll track this game's cheapest price from the next daily check."}
      </p>
    );
  }

  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  // A little headroom so a flat line doesn't sit on the edge.
  const span = hi - lo || Math.max(1, hi * 0.1);
  const yMin = lo - span * 0.15;
  const yMax = hi + span * 0.15;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const change = Math.round((last.price - first.price) * 100) / 100;
  const lowest = points.reduce((a, b) => (b.price < a.price ? b : a));
  const shown = hover ?? points.length - 1;
  const pct = (i: number) => `${(x(i) / W) * 100}%`;

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h3 className="text-[17px] font-bold">Cheapest price, day by day</h3>
          <p className="text-[13px] text-ink-3">
            The lowest price on any site, at each daily check since {shortDate(first.date)}.
          </p>
        </div>
        <p className="text-[14px] text-ink-2">
          {change === 0 ? (
            "No change since we started"
          ) : (
            <>
              <span className={`font-bold ${change < 0 ? "text-positive" : "text-hot"}`}>
                {change < 0 ? "↓" : "↑"} {money(Math.abs(change))}
              </span>{" "}
              since {shortDate(first.date)}
            </>
          )}
          <span className="text-ink-3"> · lowest {money(lowest.price)} on {shortDate(lowest.date)}</span>
        </p>
      </div>

      <div
        className="relative mt-14 select-none"
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((rel - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-40 w-full" aria-hidden>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={PAD.top + f * (H - PAD.top - PAD.bottom)} y2={PAD.top + f * (H - PAD.top - PAD.bottom)} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill="var(--color-accent)" opacity={0.1} />
          <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--color-line-bright)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {/* Dots in HTML so they stay round at any width. */}
        <span
          aria-hidden
          className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface"
          style={{ left: pct(shown), top: `${(y(points[shown].price) / H) * 100}%` }}
        />
        <div
          className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1 text-center shadow-md"
          style={{ left: `clamp(48px, ${pct(shown)}, calc(100% - 48px))` }}
        >
          <span className="tabular block text-[14px] font-bold text-ink">{money(points[shown].price)}</span>
          <span className="block text-[11px] text-ink-3">{shortDate(points[shown].date)}</span>
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[12px] text-ink-3">
        <span>{shortDate(first.date)}</span>
        <span>{shortDate(last.date)}</span>
      </div>

      <details className="mt-3 text-[13px]">
        <summary className="cursor-pointer text-ink-3 hover:text-ink">See as a table</summary>
        <table className="mt-2 w-full max-w-xs text-left">
          <thead className="text-ink-3">
            <tr>
              <th className="py-1 font-semibold">Day</th>
              <th className="py-1 text-right font-semibold">Cheapest</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.date} className="border-t border-line">
                <td className="py-1">{shortDate(p.date)}</td>
                <td className="tabular py-1 text-right">{money(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
