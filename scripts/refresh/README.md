# Daily price refresh

Game pages already read TicketNetwork, Ticket Liquidator, Gametime, TickPick
and LiveFootballTickets live. This refresh updates the saved prices every
morning, so league lists, team pages and the home page are current too, and
re-reads the sites that only answer a real browser (Vivid Seats, StubHub,
Booking.com hotels).

Rules that never change:

- Real prices only. A site that can't be read keeps its last checked price
  and its own date; nothing is estimated.
- One request at a time per site, with a pause. If a site blocks (403, 429,
  a challenge page), stop that site for the day. Never try to get around a
  block.
- Don't commit `.refresh/`.

## Steps

1. Dev server running (`npm run dev`, or the preview server "spotlight").
2. `node scripts/refresh/node-sites.mjs`: Gametime, TicketNetwork, Ticket
   Liquidator, LiveFootballTickets, TickPick. About 45 minutes. Writes
   `.refresh/prices-node.json`. Can run while the browser jobs run.
3. `node scripts/refresh/make-browser-jobs.mjs`: writes `.refresh/job-vivid.js`,
   `job-stubhub.js` and `job-booking.js` (hotels for games in the next 21 days).
4. In the app's browser, one tab per site:
   - vividseats.com: run the contents of `job-vivid.js`
   - stubhub.com: run `job-stubhub.js`
   - booking.com search results page: run `job-booking.js`

   Each sets `window.__job` (`done`, `total`, `results`, `log`) and saves its
   progress in the tab, so it can resume if re-run the same day. Check
   `Object.keys(window.__job.results).length` now and then. When `done`,
   export `JSON.stringify(window.__job.results) + "x".repeat(60000)` (the
   padding makes the browser tool save the result to a file) and turn that
   file into `.refresh/browser-vivid.json`, `browser-stubhub.json` or
   `browser-booking.json` with
   `python3 scripts/refresh/extract-browser-result.py <saved file> .refresh/browser-<site>.json`.
   If a site starts answering 403 or a challenge page mid-run, the job stops;
   export what it has.
5. `node scripts/refresh/apply.mjs`: writes the results into the price and
   hotel files, each row dated today, and adds today's cheapest price per game
   to `src/lib/data/price-history.json` (the chart on each game page).
6. Check: `npx tsc --noEmit -p .`, then open a few game pages; prices should
   look normal (no sudden $0 or 10x jumps).
7. Commit the four data files (`src/lib/data/us-ticket-prices.json`,
   `ticket-prices.json`, `hotel-prices.json`, `price-history.json`) and deploy:
   `npx --yes vercel deploy --prod --yes` (retry on "Not authorized").

`LIMIT=3` on steps 2 and 3 makes a small test run.
