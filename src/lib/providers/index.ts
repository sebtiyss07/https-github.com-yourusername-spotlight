import type {
  StayOption,
  TicketListing,
  TravelOption,
} from "@/lib/domain/types";
import {
  safely,
  type ProviderResult,
  type StayProvider,
  type StayQuery,
  type TicketProvider,
  type TicketQuery,
  type TravelProvider,
  type TravelQuery,
} from "@/lib/providers/types";
import { seededTicketProvider } from "@/lib/providers/tickets/seeded";
import { TicketmasterProvider } from "@/lib/providers/tickets/ticketmaster";
import { SeatGeekProvider } from "@/lib/providers/tickets/seatgeek";
import { seededTravelProvider } from "@/lib/providers/travel/seeded";
import { AmadeusProvider } from "@/lib/providers/travel/amadeus";
import { effectiveNightly, seededStayProvider } from "@/lib/providers/stays/seeded";

/**
 * Provider registry.
 *
 * This is the only file that changes when you bring a real marketplace online:
 * add the adapter to the array. Every disabled provider (missing credentials)
 * is filtered out here, so pages never reason about which integrations are live.
 *
 * Adapters are queried concurrently and merged with partial success — one
 * marketplace timing out costs you its listings, not the comparison.
 */

const TICKET_PROVIDERS: TicketProvider[] = [
  seededTicketProvider,
  new TicketmasterProvider(),
  new SeatGeekProvider(),
  // new StubHubProvider(),       — needs partner approval, not self-serve
];

const TRAVEL_PROVIDERS: TravelProvider[] = [
  seededTravelProvider,
  new AmadeusProvider(),
  // new DuffelProvider(),        — better UX, paid
];

const STAY_PROVIDERS: StayProvider[] = [
  seededStayProvider,
  // new AmadeusHotelProvider(),
  // new BookingProvider(),       — needs affiliate approval
];

function active<T extends { enabled: boolean }>(providers: T[]): T[] {
  return providers.filter((p) => p.enabled);
}

/**
 * Queries every live adapter and merges the results, dropping synthetic data
 * whenever a real provider answered.
 *
 * The suppression is the point. A seeded adapter always returns inventory, so
 * mixing it with live results would let an invented price win the "cheapest"
 * sort and quote a number nobody can actually buy at. Either the whole
 * comparison is real, or it's clearly labelled as modelled — never a silent
 * blend of both.
 */
export async function collect<TItem, TQuery>(
  providers: (ProviderMetaLike & {
    search(q: TQuery): Promise<ProviderResult<TItem>>;
  })[],
  query: TQuery,
  compare: (a: TItem, b: TItem) => number,
): Promise<ProviderResult<TItem>> {
  const live = active(providers);

  const settled = await Promise.all(
    live.map(async (provider) => ({
      provider,
      result: await safely(provider.name, () => provider.search(query)),
    })),
  );

  const realWithItems = settled.filter(
    (s) => !s.provider.synthetic && s.result.items.length > 0,
  );

  // Keep synthetic results only when no real provider produced anything.
  const kept =
    realWithItems.length > 0
      ? settled.filter((s) => !s.provider.synthetic)
      : settled;

  // Record what actually happened, so the UI can report observed behaviour
  // rather than mere configuration. A key that's present but rejected must not
  // let the footer advertise live data while pages serve modelled prices.
  for (const { provider, result } of settled) {
    if (provider.synthetic) continue;
    const realErrors = result.errors.filter((e) => !e.silent);
    recordHealth(provider.name, {
      ok: realErrors.length === 0,
      returnedItems: result.items.length > 0,
      lastError: realErrors[0]?.message,
      at: Date.now(),
    });
  }

  const items = kept.flatMap((s) => s.result.items).sort(compare);

  return {
    items,
    sources: [...new Set(kept.flatMap((s) => s.result.sources))],
    // Surface every failure, including from suppressed adapters — a seeded
    // provider throwing is still a bug worth seeing.
    errors: settled.flatMap((s) => s.result.errors),
    fetchedAt: new Date().toISOString(),
    synthetic: realWithItems.length === 0,
  };
}

interface ProviderMetaLike {
  readonly name: string;
  readonly enabled: boolean;
  readonly synthetic: boolean;
}

/**
 * Observed provider health.
 *
 * `enabled` only tells you a credential exists. This tells you whether the
 * provider actually answered last time it was asked — the difference between
 * "configured" and "working", and the difference between an honest status line
 * and a misleading one.
 *
 * Process-local and best-effort: it reflects this instance's recent traffic,
 * not a global view. Back it with Redis if you need one.
 */
export interface ProviderHealth {
  ok: boolean;
  returnedItems: boolean;
  lastError?: string;
  at: number;
}

const HEALTH = new Map<string, ProviderHealth>();

function recordHealth(name: string, health: ProviderHealth): void {
  HEALTH.set(name, health);
}

export function providerHealth(name: string): ProviderHealth | undefined {
  return HEALTH.get(name);
}

export async function searchTickets(
  query: TicketQuery,
): Promise<ProviderResult<TicketListing>> {
  return collect<TicketListing, TicketQuery>(
    TICKET_PROVIDERS,
    query,
    (a, b) => a.total.amount - b.total.amount,
  );
}

export async function searchTravel(
  query: TravelQuery,
): Promise<ProviderResult<TravelOption>> {
  return collect<TravelOption, TravelQuery>(
    TRAVEL_PROVIDERS,
    query,
    (a, b) => a.price.amount - b.price.amount,
  );
}

export async function searchStays(
  query: StayQuery,
): Promise<ProviderResult<StayOption>> {
  return collect<StayOption, StayQuery>(
    STAY_PROVIDERS,
    query,
    // True cost per night, including getting to the venue and back — not the
    // headline rate. See `effectiveNightly`.
    (a, b) => effectiveNightly(a) - effectiveNightly(b),
  );
}

export interface ProviderStatus {
  name: string;
  kind: "tickets" | "travel" | "stays";
  enabled: boolean;
  synthetic: boolean;
}

/** Which integrations are live, for the status strip in the UI. */
export function providerStatus(): ProviderStatus[] {
  const map = (
    providers: ProviderMetaLike[],
    kind: ProviderStatus["kind"],
  ): ProviderStatus[] =>
    providers.map((p) => ({
      name: p.name,
      kind,
      enabled: p.enabled,
      synthetic: p.synthetic,
    }));

  return [
    ...map(TICKET_PROVIDERS, "tickets"),
    ...map(TRAVEL_PROVIDERS, "travel"),
    ...map(STAY_PROVIDERS, "stays"),
  ];
}

/** True when a real (non-synthetic) adapter is configured for a category. */
export function hasLiveProvider(kind: ProviderStatus["kind"]): boolean {
  return providerStatus().some(
    (p) => p.kind === kind && p.enabled && !p.synthetic,
  );
}

export type ProviderState = "seeded" | "configured" | "failing" | "live";

/**
 * What to actually tell the user about a category.
 *
 * Deliberately distinguishes "configured" from "live": a key that exists but is
 * being rejected must read as a problem, not as working inventory.
 */
export function categoryState(kind: ProviderStatus["kind"]): {
  state: ProviderState;
  detail: string;
} {
  const real = providerStatus().filter(
    (p) => p.kind === kind && !p.synthetic && p.enabled,
  );

  if (real.length === 0) return { state: "seeded", detail: "seeded model" };

  const observed = real.map((p) => ({ name: p.name, health: providerHealth(p.name) }));

  const working = observed.filter((o) => o.health?.ok && o.health.returnedItems);
  if (working.length > 0) {
    return { state: "live", detail: working.map((o) => o.name).join(", ") };
  }

  const failing = observed.filter((o) => o.health && !o.health.ok);
  if (failing.length > 0) {
    return {
      state: "failing",
      detail: `${failing.map((o) => o.name).join(", ")} — not responding`,
    };
  }

  // Configured, but nothing has exercised it yet this process.
  return {
    state: "configured",
    detail: `${real.map((p) => p.name).join(", ")} — configured`,
  };
}
