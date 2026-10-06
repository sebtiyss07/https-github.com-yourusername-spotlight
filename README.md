# Spotlight

Every sporting event on earth, with the cheapest ticket across all marketplaces,
the way to get there, and somewhere to stay — on one page.

```bash
npm install
npm run dev      # http://localhost:3000
```

## The idea

Attending a game today means opening eight tabs: SeatGeek, StubHub, Ticketmaster,
Google Flights, Booking.com. Each answers one third of the question, and none of
them tells you the number that actually decides whether you go — what it costs to
be in that seat.

Spotlight puts ticket + travel + stay on one line, drilling down
**sport → league → team → event**.

## Structure

```
src/
  lib/domain/types.ts       Core model. Mirrors the eventual SQL schema 1:1.
  lib/data/                 Seed data (sports, leagues, teams, venues, events).
  lib/repositories/         The storage seam. Pages only ever call these.
  lib/providers/            The integration seam. See below.
  lib/trip.ts               Ticket + travel + stay → one total.
  app/                      Routes.
```

Two rules keep the swap to production cheap:

1. **Nothing outside `lib/repositories` imports from `lib/data`.** Every
   repository function is already `async`, so moving to Postgres changes only
   the bodies — no page, component, or type moves.
2. **Nothing outside `lib/providers` knows which marketplace it's talking to.**
   Pages call `searchTickets()`, not Ticketmaster.

## Going live

```bash
cp .env.example .env.local
# paste your key into TICKETMASTER_API_KEY
npm run check:providers
```

`check:providers` verifies the key against the live API, reports how many events
actually carry pricing, and prints the classification names Ticketmaster really
returns — so the taxonomy guesses in `ticketmasterResolver.ts` can be corrected
against reality rather than assumed.

Get a key at
[developer-acct.ticketmaster.com](https://developer-acct.ticketmaster.com/user/register).
Free, self-serve, no approval. Limits: 5 req/sec, 5,000/day.

## Adding a real provider

Implement one interface from `lib/providers/types.ts` and register it in
`lib/providers/index.ts`. That's the whole change.

`lib/providers/tickets/ticketmaster.ts` is a complete worked example — timeout,
caching, error mapping, and unit conversion included. It activates itself when
`TICKETMASTER_API_KEY` is present and stays dormant otherwise.

Adapters must **never throw**. A provider that is down, throttled, or missing
credentials returns an empty result with a note in `ProviderResult.errors`, so
one bad marketplace can't take down the comparison for the other six.

### Three rules that keep live data honest

**Matching is the hard part, not fetching.** Our event ids and Ticketmaster's
share no key, so events are matched on evidence — participants, date, venue.
`scoreCandidate()` treats date and participants as **hard gates**, not weights.
The obvious weighted-sum version accepted *Celtics vs Lakers 18 days late* (0.65)
and *Bruins vs Canadiens on the right night* (0.625), both of which would have
shown someone prices for a game they weren't looking at. A weak match is
discarded: a missing price is a gap, a wrong price is a broken promise.

**Seeded data is suppressed the moment real data exists.** A seeded adapter
always has inventory, so mixing the two would let an invented $92 listing beat a
real $180 quote in the "cheapest" sort. `collect()` in `providers/index.ts`
drops synthetic results whenever a real provider returned any. The result is
flagged `synthetic`, and the UI labels modelled pricing rather than passing it
off as a quote.

**A broken key must never fail silently.** "Event isn't listed" and "the API
rejected us" both produce zero results but need opposite handling — the first is
the normal case for most of the catalogue, the second is an operational
incident. `ResolutionResult.failed` separates them, and `ProviderError.silent`
marks only *unconfigured* providers as not worth mentioning. An expired key
surfaces; an integration you haven't signed up for stays quiet.

The same principle drives the footer. `enabled` only means a credential exists,
so reporting that as "live" would advertise real inventory while pages served
modelled prices. `categoryState()` reports *observed* behaviour recorded by
`collect()` — `seeded` / `configured` / `failing` / `live` — so a rejected key
reads as a problem instead of as success.

## Two dev routes that keep it honest

Both 404 outside development.

**`/dev-check`** — 30 logic checks, no API key needed: matcher gates, synthetic
suppression, currency safety, price validation, duration parsing, arrival
window.

**`/dev-audit`** — 18 data-consistency checks across every league and 400
upcoming events. Each one exists because it caught a real bug:

| Check | The bug it prevents |
|---|---|
| Capacity dedupes shared venues | NFL overstated by 152,740 seats — SoFi and MetLife counted twice |
| Counts aren't display limits | Every sport claimed "15+ events" because 15 was the slice size |
| Price index matches the shared definition | List page advertised a single-seat price the detail page couldn't honour |
| Rendered components sum to rendered total | Visible column was £1 short — rounding four parts separately |
| No team plays twice in a day / itself | Schedule-generator regressions |
| Venues have valid coordinates + IATA | Silently pricing travel against the wrong city |

The rendered-vs-internal distinction matters: an earlier version of the sum
check compared unrounded values and passed while the on-screen figures didn't
add up. Prices display without decimals, so the numbers a user adds are the
rounded ones — those are what must reconcile.

### What's actually obtainable

| Provider | Access | Adapter | Notes |
|---|---|---|---|
| Ticketmaster Discovery | Free, self-serve | ✅ built | Returns **price ranges**, not seat-level listings |
| SeatGeek | Free client ID | ✅ built | Lowest + average price and a live listing count |
| Google Flights via SerpApi (flights) | Free plan, 250 searches/month (`SERPAPI_KEY`) | ✅ built | Exact-date live fares; cached 12 h per route and dates. Amadeus Self-Service was shut down on 17 Jul 2026 |
| StubHub / Vivid Seats | Partner approval | — | Not self-serve |
| Duffel | Self-serve, paid | — | Better flight UX |
| Booking.com / Expedia | Affiliate approval | — | Amadeus Hotel reuses `AMADEUS_*` |

Seat-level resale inventory is a **commercial** step, not an engineering one.
The code is ready for it well before the contracts are.

### Adapter status

All three adapters degrade correctly under bad credentials — verified by
pointing them at deliberately invalid keys and confirming the pages fall back to
seeded prices *and* report the failure.

The **Amadeus response mapping is unverified against the live API** — the host
was unreachable from the machine it was written on, so offer→`TravelOption`
translation has never seen a real payload. Its pure logic (ISO 8601 duration
parsing, the arrival-window filter) is covered in `/dev-check`. Run
`npm run check:providers` once you have credentials; if the shape differs,
`toOption()` in `travel/amadeus.ts` is the only thing that needs correcting.

### List pages never fan out

A league page shows 40 fixtures. Querying seven marketplaces for each is 280
requests to render a list, and a fast way to get rate-limited off every partner
API you have.

`lib/providers/priceIndex.ts` is the correct shape: a cached index answering
"cheapest total for this event" in constant time. List pages read the index;
only the event detail page does a live fan-out. Point `refresh()` at a
background crawl and persist to Redis when you go live.

## Design

Light, editorial — restrained colour, generous whitespace, hierarchy carried by
type rather than by chrome. The product asks people to trust its prices, so it
should read closer to a financial tool than a fan site.

**Few containers.** Lists are hairline-divided groups, not stacks of bordered
cards; metrics are a label above a number, not four boxed tiles in a row. A
bordered box is reserved for things that genuinely need separating from the page
(the "modelled prices" notice, for instance) — used everywhere, it just reads as
clutter.

Tokens live in `globals.css` and are **semantic** (`canvas`, `surface`, `ink`,
`line`) rather than literal. That's what let the whole site flip from dark to
light by changing values in one file, and it's what will let a dark theme be
added as a `[data-theme]` block rather than a rewrite.

One trap worth knowing: never name a colour token `base`. Tailwind already owns
`text-base` as a font-size, so `--color-base` silently turns every `text-base`
into a colour — which painted this site's body copy near-black once already.

### Logos and trademarks

**No league or governing-body marks appear anywhere.** The NBA silhouette, the
Premier League lion, the FIFA and NFL shields are registered trademarks and are
enforced harder than club crests, since they're each organisation's primary mark.
`Sport` and `League` therefore carry no image field at all, and `/dev-audit`
asserts none gets added. Leagues render as text.

**Sport icons** (`SportIcon.tsx`) are custom line artwork — a ball, a bat, a
checkered flag. Generic objects, no trademark question. Emoji were replaced
because they render differently on every platform and can't inherit colour.

**Club crests are registered trademarks**, so `TeamMark` draws a crest from each
club's authentic colours instead of shipping the real badge. It handles two
things a coloured square wouldn't:

- **Contrast** — Fulham and Leeds play in white, so text colour and edge
  treatment are chosen from measured WCAG luminance rather than assumed dark.
- **Uniqueness** — crest codes are assigned in `teams.ts` against the full
  roster, because a component that sees one team can't know what's taken.
  First-and-last initials collide three ways in the NFL alone (Bears, Bengals
  and Browns all give "CB"). `/dev-audit` asserts uniqueness per league.

**To use real crests:** add entries to `src/lib/data/logos.ts`, keyed by team id.
Nothing else changes — every crest across the app switches to the image the
moment a URL exists. That file documents where to license them (SportsDataIO,
API-Sports, or a direct club agreement) and why you should self-host rather than
hotlink a league CDN.

## Accuracy rules

The product is a price comparison, so a confidently wrong number is worse than a
missing one. Four rules enforce that, all covered in `/dev-check`:

**Money never crosses currencies.** Ticketmaster quotes a London fixture in GBP;
Amadeus quotes the flight in USD. Adding those integers and labelling the sum
with either code produces a headline figure that is simply false. `sumMoney()`
returns `null` on mixed input and the UI says *"Priced in GBP + USD — no single
total without a conversion rate"*. Converting properly needs live FX rates — a
fourth provider — and is worth doing; faking it with a hardcoded rate table is
not.

**Every provider value is validated at the boundary.** A shape change or bad
payload surfaces as `NaN`, a negative, or zero — and `$0.00` reads to a user as a
bargain, not as broken code. `isValidMoney()` gates each listing, and if *every*
offer in a response fails to parse, the adapter reports a suspected shape change
instead of rendering "no flights available".

**Estimates are marked as estimates.** Ticketing APIs return pre-fee prices, so
the "all-in" total for live data is computed from each marketplace's published
fee rate. Those fees render as `~+$46` with a footnote, never as an exact quote.

**Unknown is not zero.** `seatQuality` is `null` for providers that report
aggregate prices rather than seats. Those listings are excluded from the
"where to sit" breakdown and from the best-value ranking, instead of being
assigned an invented score.

## Two opinions worth keeping

**Stays are ranked by true cost, not nightly rate.** A room 6km out at $43 beats
one at 1.6km for $189 on every booking site — until you add two surge-priced cabs
on a night when 78,000 people leave the same postcode at once. `effectiveNightly()`
adds the cost of getting to the ground and back, so genuinely close options rise
instead of being buried.

**Tickets show the *total*, not the face price.** Fees range from 12% at the box
office to 35% on viagogo. Sorting by advertised price is how comparison sites
mislead people; the sort key here is always `total`.

## Data status

All prices, schedules, and availability are **generated seed data** — deterministic
from a string seed (`lib/data/random.ts`) so a price never changes between the
list page and the detail page, and React never sees a hydration mismatch.

Real team names, venues, coordinates, and nearest airports are accurate. Full
rosters and schedules exist for the **NBA (30)**, **Premier League (20)**, and
**NFL (32)**; other leagues are browsable with their marquee events. Marquee
events are hand-authored and note where a host venue is indicative rather than
confirmed.

`SportEvent.startsAt` is documented as venue-local but the generator writes plain
UTC, so kick-off times render as UTC. Format against a venue IANA zone once a real
schedule feed lands.
