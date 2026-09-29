import type { PriceSite } from "./prices";

/**
 * What each ticket site adds in fees, and whether the price we show already
 * includes them. Every figure says where it comes from: measured by us on the
 * site's own pages, stated by the site, or reported by independent reviews.
 * Checked 2026-09-28. Where nobody publishes a number, we say so.
 */
export interface SiteFees {
  /** Does the price we show already include the site's buyer fees? */
  included: "yes" | "no" | "unknown";
  /** The typical fee, in plain words. */
  typical: string;
  basis: "measured" | "site says" | "reviews" | "not published";
  source: string;
}

export const SITE_FEES: Record<PriceSite, SiteFees> = {
  tickpick: {
    included: "yes",
    typical: "No buyer fees",
    basis: "site says",
    source: "https://www.tickpick.com/blog/hidden-fees-buying-tickets-online/",
  },
  vividseats: {
    included: "yes",
    typical: "Built into the price (all-in); size not published",
    basis: "site says",
    source: "https://www.vividseats.com/blog/vivid-seats-goes-all-in-on-all-in-pricing",
  },
  gametime: {
    included: "yes",
    typical: "Built into the price (all-in); size not published",
    basis: "site says",
    source: "https://gametime.co/blog/gametimes-all-in-pricing-no-surprises-just-clarity/",
  },
  stubhub: {
    included: "yes",
    typical: "About 30% (US Grand Prix pass: $320.79 before fees, $417 with fees)",
    basis: "measured",
    source: "https://newsroom.stubhub.com/2026/06/04/understanding-ticket-fees-why-they-exist-and-what-they-cover/",
  },
  ticombo: {
    included: "yes",
    typical: "About 30% over the seller's price; a delivery fee may be added at checkout",
    basis: "measured",
    source: "https://www.ticombo.com/en/index/how-it-works",
  },
  ticket4football: {
    included: "no",
    typical: "15% commission",
    basis: "site says",
    source: "https://ticket4football.com/page/our-marketplace",
  },
  footballticketpad: {
    included: "no",
    typical: "Added at checkout; reviews report about 21% or more",
    basis: "reviews",
    source: "https://seatpick.com/blog/football-ticket-pad-review-the-most-comprehensive-review-online",
  },
  livefootballtickets: {
    included: "no",
    typical: "Booking + service fee at checkout; one reviewed order: £30 on £139 (about 22%)",
    basis: "reviews",
    source: "https://ticket-compare.com/reviews/livefootballtickets-review/",
  },
  footballticketnet: {
    included: "no",
    typical: "Booking + service fee at checkout; amount not published",
    basis: "not published",
    source: "https://www.footballticketnet.com/terms",
  },
  seatgeek: {
    included: "yes",
    typical: "About 25–35% (Celtics at Pistons: $27 before fees, $37 with fees)",
    basis: "measured",
    source: "https://seatgeek.com",
  },
  ticketmaster: {
    included: "unknown",
    typical: "Price not read by us; shown on Ticketmaster",
    basis: "not published",
    source: "https://www.ticketmaster.com",
  },
  f1store: {
    included: "unknown",
    typical: "Face value; any booking fee is shown at checkout",
    basis: "not published",
    source: "https://tickets.formula1.com",
  },
};
