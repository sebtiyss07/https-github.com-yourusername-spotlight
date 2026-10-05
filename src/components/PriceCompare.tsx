"use client";

import { Fragment, useState } from "react";
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
  const pricedOffers = prices.offers.filter((o) => o.amount !== null);
  const pricedCount = pricedOffers.length;
  const cheapest = prices.cheapest;
  // The honest saving: against the next-cheapest site, not the dearest one,
  // and only between prices that both include fees.
  const allIn = pricedOffers.filter((o) => o.fees.included !== "no");
  const runnerUp = cheapest?.fees.included !== "no" ? allIn[1] : undefined;
  // Sites that add fees at checkout come after the all-in prices, under a note.
  const firstExtra = allIn.length ? prices.offers.findIndex((o) => o.amount !== null && o.fees.included === "no") : -1;
  // A lower price before fees might still end up cheaper, so don't claim more than we know.
  const lowerBeforeFees = !!cheapest && pricedOffers.some((o) => o.fees.included === "no" && o.amount! < cheapest.amount!);
  const saving =
    cheapest && runnerUp ? Math.round((runnerUp.amount! - cheapest.amount!) * 100) / 100 : 0;

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

      {cheapest && runnerUp && saving >= 1 && (
        <p className="mb-3 rounded-xl bg-positive/10 px-4 py-2 text-[14px] text-ink-2 sm:inline-block sm:rounded-full sm:py-1.5">
          <span className="font-semibold text-positive">
            {cheapest.label} is {formatPrice(saving, prices.currency)} cheaper
          </span>{" "}
          than the next site, {runnerUp.label}.
        </p>
      )}

      <ol className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        {prices.offers.map((offer, i) => {
          const isCheapest = offer === cheapest;
          const priced = offer.amount !== null;
          return (
            <Fragment key={offer.site}>
              {i === firstExtra && (
                <li className="border-b border-line bg-surface-2 px-4 py-2.5 text-[13px] text-ink-2 sm:px-5">
                  <span className="font-semibold text-ink">These sites add fees at checkout,</span> so you&apos;ll pay
                  more than the price shown here. They don&apos;t publish how much, so check the total on their site: it
                  can still work out cheaper.
                </li>
              )}
              <li className="border-b border-line last:border-b-0">
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex items-center gap-3 px-3 py-4 transition-colors hover:bg-surface-2 sm:gap-4 sm:px-5 ${
                    isCheapest ? "bg-positive/[0.06] shadow-[inset_4px_0_0_var(--color-positive)]" : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-bold ${
                      isCheapest ? "bg-positive text-white" : priced ? "bg-surface-2 text-ink-2" : "bg-surface-2 text-ink-3"
                    }`}
                  >
                    {priced ? i + 1 : "–"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[16px] font-bold text-ink group-hover:text-accent">{offer.label}</span>
                      {isCheapest && pricedCount > 1 && (
                        <span className="rounded-full bg-positive px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                          {lowerBeforeFees ? "Cheapest with fees" : "Cheapest"}
                        </span>
                      )}
                    </span>
                    {priced ? (
                      <span className="block text-[13px] text-ink-3">
                        {offer.ticket ?? (offer.fees.included === "yes" ? "Fees included" : "")}
                        {offer.fees.included === "no" && (
                          <span className="font-semibold text-hot">Fees added at checkout</span>
                        )}
                      </span>
                    ) : (
                      <span className="block text-[13px] text-ink-3">
                        {offer.note ?? "No tickets listed when we checked"}
                      </span>
                    )}
                  </span>
                  {priced && (
                    <span className="shrink-0 text-right">
                      <span className={`tabular block text-[20px] font-extrabold leading-tight ${isCheapest ? "text-positive" : "text-ink"}`}>
                        {formatPrice(offer.amount!, prices.currency)}
                      </span>
                      <span className="block text-[12px] text-ink-3">
                        {offer.original
                          ? `${formatPrice(offer.original.amount, offer.original.currency)} on site`
                          : "per ticket"}
                      </span>
                    </span>
                  )}
                  <span
                    className={`shrink-0 rounded-xl px-3 py-2 text-[14px] font-bold transition-colors sm:px-4 ${
                      priced
                        ? isCheapest
                          ? "bg-accent text-white group-hover:bg-accent-2"
                          : "bg-ink text-white group-hover:bg-accent"
                        : "border border-line text-ink-2 group-hover:border-accent group-hover:text-accent"
                    }`}
                  >
                    {priced ? "Buy" : "Visit"}
                    <span aria-hidden> ↗</span>
                    <span className="sr-only"> on {offer.label} (opens in a new tab)</span>
                  </span>
                </a>
              </li>
            </Fragment>
          );
        })}
      </ol>

      <FeeTable offers={prices.offers} />

      <p className="mt-3 text-[14px] text-ink-3">
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
        {pricedOffers.every((o) => o.fees.included === "yes")
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
    <details className="group mt-4 rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-semibold">
        Fees by site
        <span className="hidden text-[12px] font-normal text-ink-3 sm:inline sm:group-open:hidden">
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
