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
   Liquidator, LiveFootballTickets, and TickPick's F1 pass pages, for the US,
   football and F1 files. About 45 minutes. Writes `.refresh/prices-node.json`.
   Can run while the browser jobs run.
3. `node scripts/refresh/make-browser-jobs.mjs`: writes, in `.refresh/`:
   `job-vivid.js`, `job-stubhub.js`, `job-tickpick.js`,
   `job-footballticketnet.js` and `job-booking.js` (hotels for games in the
   next 21 days, plus the 200 later stays whose price is oldest).
4. In the app's browser, one tab per site, run the job's full contents:
   - vividseats.com: `job-vivid.js`
   - stubhub.com: `job-stubhub.js`
   - tickpick.com (any game page): `job-tickpick.js` (about 3-4 hours)
   - footballticketnet.com (any match page): `job-footballticketnet.js`
   - booking.com search results page: `job-booking.js`

   Each sets `window.__job` (`done`, `total`, `results`, `log`) and saves its
   progress in the tab (keyed by day and by the job's code, so a changed
   reader never resumes old results). Check
   `Object.keys(window.__job.results).length` now and then. When `done`,
   export `JSON.stringify(window.__job.results) + "x".repeat(60000)` (the
   padding makes the browser tool save the result to a file) and turn that
   file into `.refresh/browser-<site>.json` with
   `python3 scripts/refresh/extract-browser-result.py <saved file> .refresh/browser-<site>.json`
   (vivid, stubhub, tickpick, booking). FootballTicketNet results are keyed by
   URL: `python3 scripts/refresh/extract-browser-result.py <saved file> .refresh/prices-footballticketnet.json footballticketnet`.
   If a site starts answering 403 or a challenge page mid-run, the job stops;
   export what it has.
5. `node scripts/refresh/apply.mjs`: writes the results into the price files
   (US, football, F1) and the hotel file, each row dated today, and adds
   today's cheapest price per game to `src/lib/data/price-history.json`.
   Move yesterday's `.refresh/` result files out first: apply.mjs dates every
   result it finds as today.
6. Check: `npx tsc --noEmit -p .`, then open a few game pages; prices should
   look normal (no sudden $0 or 10x jumps). Hotel totals should be close to
   yesterday's (Booking shows a per-night price on its cards; the job reads the
   stay total).
7. Commit the data files (`src/lib/data/us-ticket-prices.json`,
   `ticket-prices.json`, `f1-prices.json`, `hotel-prices.json`,
   `price-history.json`) and deploy: `npx --yes vercel deploy --prod --yes`
   (retry on "Not authorized").

The site never shows a ticket price more than 3 days old, or a hotel price
more than 14 days old: a site that isn't refreshed turns into a link with its
last check date. Sites with no daily reader yet (TicketSmarter, Ticombo,
Ticket4Football, FootballTicketPad, the official F1 store) show that way.

`LIMIT=3` on steps 2 and 3 makes a small test run; `ONLY_FILES=f1` limits
step 2 to one file.
