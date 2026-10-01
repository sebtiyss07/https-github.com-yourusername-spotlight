"use client";

import { useState } from "react";
import type { PriceComparison } from "@/lib/repositories";
import { formatLocalDate, formatPrice } from "@/lib/format";

export interface PriceGroup {
  key: string;
  label: string;
  comparison: PriceComparison;
}

/**
 * Every site's lowest price side by side, cheapest first. With more than one
 * group (an F1 weekend pass vs a race-day ticket) the groups become tabs, so
 * only like-for-like tickets are ever compared.
 */
export function PriceCompare({ groups }: { groups: PriceGroup[] }) {
  const usable = groups.filter((g) => g.comparison.offers.length > 0);
  const [active, setActive] = useState(usable[0]?.key);
  const group = usable.find((g) => g.key === active) ?? usable[0];
  if (!group) return null;

  const prices = group.comparison;
  const priced = prices.offers.filter((o) => o.amount !== null);
  const highest = Math.max(...priced.map((o) => o.amount!));
  const cheapest = prices.cheapest;
  const dearest = priced.at(-1);
  const saving =
    cheapest && dearest && priced.length > 1 ? dearest.amount! - cheapest.amount! : 0;

  return (
    <div>
      {usable.length > 1 && (
        <div role="tablist" className="mb-4 inline-flex rounded-full bg-surface-2 p-1">
          {usable.map((g) => (
            <button
              key={g.key}
              role="tab"
              aria-selected={g.key === group.key}
              onClick={() => setActive(g.key)}
              className={`rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors ${
                g.key === group.key ? "bg-ink text-white shadow-sm" : "text-ink-2 hover:text-ink"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {cheapest && (
        <div className="mb-3 rounded-xl bg-positive/10 px-4 py-3">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[14px] font-semibold text-positive">Cheapest:</span>
            <span className="tabular text-[22px] font-semibold">
              {formatPrice(cheapest.amount!, prices.currency)}
            </span>
            <span className="text-[14px] text-ink-2">on {cheapest.label}</span>
          </p>
          {saving >= 1 && dearest && (
            <p className="text-[14px] text-ink-2">
              That&apos;s {formatPrice(Math.round(saving * 100) / 100, prices.currency)} less
              than {dearest.label}.
            </p>
          )}
        </div>
      )}

      <ol className="overflow-hidden rounded-xl border border-line">
        {prices.offers.map((offer, i) => {
          const isCheapest = offer === cheapest;
          return (
            <li key={offer.site} className="border-b border-line last:border-b-0">
              <a
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center gap-3 px-3 py-3.5 transition-colors hover:bg-accent/5 sm:gap-4 sm:px-4 ${isCheapest ? "bg-positive/5" : ""}`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${isCheapest ? "bg-positive text-white" : "bg-surface-2 text-ink-2"}`}
                >
                  {offer.amount === null ? "–" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold group-hover:text-accent">
                    <span className="truncate">{offer.label}</span>
                    {isCheapest && priced.length > 1 && (
                      <span className="hidden shrink-0 rounded-full bg-positive/15 px-2 py-0.5 text-[11px] font-semibold text-positive sm:inline">
                        Cheapest
                      </span>
                    )}
                  </span>
                  {offer.ticket && (
                    <span className="block truncate text-[12px] text-ink-3">{offer.ticket}</span>
                  )}
                  {offer.amount !== null && offer.fees.included === "no" && (
                    <span className="mt-0.5 inline-block rounded-full bg-hot/10 px-2 py-0.5 text-[11px] font-semibold text-hot">
                      + fees at checkout
                    </span>
                  )}
                  {offer.amount !== null ? (
                    <span className="mt-1.5 block h-1.5 max-w-56 overflow-hidden rounded-full bg-surface-2">
                      <span
                        className={`block h-full rounded-full ${isCheapest ? "bg-positive" : "bg-ink-3/50"}`}
                        style={{ width: `${Math.max(8, (offer.amount / highest) * 100)}%` }}
                      />
                    </span>
                  ) : (
                    <span className="block text-[13px] text-ink-3">
                      {offer.note ?? "No tickets listed when we checked"}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  {offer.amount !== null ? (
                    <>
                      <span className="tabular block text-[18px] font-semibold">
                        {formatPrice(offer.amount, prices.currency)}
                      </span>
                      <span className="block text-[12px] text-ink-3">
                        {offer.original
                          ? `${formatPrice(offer.original.amount, offer.original.currency)} on site`
                          : "per ticket"}
                      </span>
                    </>
                  ) : (
                    <span className="text-[14px] font-medium text-ink-3">—</span>
                  )}
                </span>
                <span
                  className={`hidden shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors sm:inline-block ${
                    offer.amount !== null
                      ? "bg-ink text-white group-hover:bg-accent"
                      : "border border-line text-ink-2 group-hover:border-accent group-hover:text-accent"
                  }`}
                >
                  {offer.amount !== null ? "View tickets ↗" : "Check site ↗"}
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      <FeeTable offers={prices.offers} />

      <p className="mt-3 text-[13px] text-ink-3">
        Lowest price each site listed for one ticket
        {prices.currency !== "USD" || prices.offers.some((o) => o.original)
          ? `, shown in ${prices.currency} at the European Central Bank rate`
          : ", in US dollars"}
        {prices.checkedOn &&
          (prices.checkedFrom ? (
            <>, checked between {formatLocalDate(prices.checkedFrom)} and {formatLocalDate(prices.checkedOn)}</>
          ) : (
            <>, checked {formatLocalDate(prices.checkedOn)}</>
          ))}
        .{" "}
        {prices.offers.every((o) => o.fees.included === "yes")
          ? "Every price here already includes the site's fees (taxes and delivery may be extra). Prices move fast, so confirm the total before you buy."
          : "Prices move fast and some sites add fees at checkout, so confirm the total before you buy."}
      </p>
    </div>
  );
}

const BASIS: Record<string, string> = {
  measured: "Measured by us",
  "site says": "The site says",
  reviews: "Independent reviews",
  "not published": "Not published",
};

/** Every site's fees in one place, with where each figure comes from. */
function FeeTable({ offers }: { offers: PriceComparison["offers"] }) {
  return (
    <details className="group mt-4 rounded-xl border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-semibold">
        Fees by site
        <span className="text-[12px] font-normal text-ink-3 group-open:hidden">
          What each site adds, and where the number comes from ▾
        </span>
      </summary>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead className="bg-surface-2 text-[12px] text-ink-3">
            <tr>
              <th className="px-4 py-2 font-semibold">Site</th>
              <th className="px-4 py-2 font-semibold">In our price?</th>
              <th className="px-4 py-2 font-semibold">Typical fee</th>
              <th className="px-4 py-2 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {offers.map((o) => (
              <tr key={o.site}>
                <td className="px-4 py-2.5 font-semibold">{o.label}</td>
                <td className="px-4 py-2.5">
                  {o.fees.included === "yes" ? (
                    <span className="font-semibold text-positive">Included</span>
                  ) : o.fees.included === "no" ? (
                    <span className="font-semibold text-hot">Added at checkout</span>
                  ) : (
                    <span className="text-ink-3">Unknown</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-ink-2">{o.fees.typical}</td>
                <td className="px-4 py-2.5">
                  <a
                    href={o.fees.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {BASIS[o.fees.basis]} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
