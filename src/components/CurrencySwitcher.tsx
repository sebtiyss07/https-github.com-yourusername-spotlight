"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const OPTIONS = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
] as const;

/**
 * $ / € / £ for every price on the site. The choice lives in a cookie so the
 * server renders prices in it, and survives page changes.
 */
export function CurrencySwitcher({ current }: { current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  const pick = (code: string) => {
    setValue(code);
    document.cookie = `spotlight-currency=${code}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="radiogroup"
      aria-label="Currency"
      className={`flex shrink-0 rounded-full bg-surface-2 p-0.5 ${pending ? "opacity-60" : ""}`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          role="radio"
          aria-checked={value === o.code}
          aria-label={o.code}
          title={o.code}
          onClick={() => pick(o.code)}
          className={`h-8 w-8 rounded-full text-[14px] font-semibold transition-colors ${
            value === o.code ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.symbol}
        </button>
      ))}
    </div>
  );
}
