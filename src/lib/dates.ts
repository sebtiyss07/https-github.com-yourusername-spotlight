/**
 * Calendar-date helpers. A "date" here is a plain `YYYY-MM-DD` string with no
 * time zone attached — the form hotels and airlines book in.
 */

/** The calendar date an instant falls on, as seen in `timeZone`. */
export function localDate(iso: string, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A wall-clock time in `timeZone` (e.g. "15:00" in Europe/London) → the UTC
 * instant, as ISO. Fixture feeds publish local kick-off times.
 */
export function zonedTimeToIso(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallClock = Date.UTC(y, m - 1, d, hh, mm);

  const offsetAt = (instant: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .formatToParts(new Date(instant))
        .map((p) => [p.type, p.value]),
    );
    return (
      Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) -
      instant
    );
  };

  // Second pass settles times near a daylight-saving change.
  let instant = wallClock - offsetAt(wallClock);
  instant = wallClock - offsetAt(instant);
  return new Date(instant).toISOString();
}
