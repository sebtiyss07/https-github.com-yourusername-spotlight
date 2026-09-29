import { cookies } from "next/headers";

/** The currencies a visitor can pick. Every stored price is in USD. */
export const CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_COOKIE = "spotlight-currency";

/** The visitor's chosen currency (server only), USD by default. */
export async function getCurrency(): Promise<Currency> {
  const value = (await cookies()).get(CURRENCY_COOKIE)?.value;
  return (CURRENCIES as readonly string[]).includes(value ?? "") ? (value as Currency) : "USD";
}
