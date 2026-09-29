/**
 * Where to actually buy tickets — official sellers only, each opened and
 * checked by hand on 2026-09-24.
 *
 * Premier League tickets are sold by the clubs. In the UK, reselling a
 * football ticket without the club's authorisation is a criminal offence
 * (Criminal Justice and Public Order Act 1994, s.166), so we point at the
 * club's own ticket office, not at resale sites. Away fans buy their
 * allocation from their own club, which is why a fixture links to both.
 *
 * Nothing here is a search link. If a club changes its ticket page, update it
 * here; don't fall back to a search engine.
 */
export const CLUB_TICKETS: Record<string, string> = {
  arsenal: "https://www.arsenal.com/tickets",
  "aston-villa": "https://www.avfc.co.uk/tickets",
  bournemouth: "https://www.afcb.co.uk/tickets/",
  brentford: "https://www.eticketing.co.uk/brentfordfc",
  brighton: "https://www.brightonandhovealbion.com/tickets",
  chelsea: "https://www.chelseafc.com/en/tickets/mens-tickets",
  coventry: "https://www.ccfc.co.uk/tickets/",
  "crystal-palace": "https://www.cpfc.co.uk/tickets/",
  everton: "https://www.evertonfc.com/tickets",
  fulham: "https://www.fulhamfc.com/tickets",
  hull: "https://www.wearehullcity.co.uk/tickets/",
  ipswich: "https://www.itfc.co.uk/tickets/",
  leeds: "https://tickets.leedsunited.com/",
  liverpool: "https://www.liverpoolfc.com/tickets",
  "man-city": "https://www.mancity.com/tickets",
  "man-united": "https://www.manutd.com/en/tickets-and-hospitality",
  newcastle: "https://www.newcastleunited.com/en/tickets",
  "nottingham-forest": "https://www.nottinghamforest.co.uk/tickets/",
  sunderland: "https://www.safc.com/tickets/",
  tottenham: "https://www.tottenhamhotspur.com/tickets/",
};

/**
 * Formula 1 circuits we can place: nearest major airport, local time zone,
 * and the race's own page on the official F1 ticket store. A race whose
 * circuit isn't listed here is left off the site rather than guessed at.
 */
export const F1_CIRCUITS: Record<
  string,
  { country: string; airport: string; timeZone: string; tickets: string }
> = {
  baku: { country: "AZ", airport: "GYD", timeZone: "Asia/Baku", tickets: "https://tickets.formula1.com/en/f1-10851-azerbaijan" },
  sepang: { country: "MY", airport: "KUL", timeZone: "Asia/Kuala_Lumpur", tickets: "https://tickets.formula1.com/en/f1-83069-bahrain-in-malaysia" },
  marina_bay: { country: "SG", airport: "SIN", timeZone: "Asia/Singapore", tickets: "https://tickets.formula1.com/en/f1-3301-singapore" },
  americas: { country: "US", airport: "AUS", timeZone: "America/Chicago", tickets: "https://tickets.formula1.com/en/f1-3320-united-states" },
  rodriguez: { country: "MX", airport: "MEX", timeZone: "America/Mexico_City", tickets: "https://tickets.formula1.com/en/f1-4861-mexico" },
  interlagos: { country: "BR", airport: "GRU", timeZone: "America/Sao_Paulo", tickets: "https://tickets.formula1.com/en/f1-3325-brazil" },
  vegas: { country: "US", airport: "LAS", timeZone: "America/Los_Angeles", tickets: "https://tickets.formula1.com/en/f1-59007-las-vegas" },
  losail: { country: "QA", airport: "DOH", timeZone: "Asia/Qatar", tickets: "https://tickets.formula1.com/en/f1-56257-qatar" },
  yas_marina: { country: "AE", airport: "AUH", timeZone: "Asia/Dubai", tickets: "https://tickets.formula1.com/en/f1-3312-abu-dhabi" },
};
