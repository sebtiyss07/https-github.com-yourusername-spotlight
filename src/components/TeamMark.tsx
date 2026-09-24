/**
 * Team crest.
 *
 * Renders a licensed crest image when `logoUrl` is set, and otherwise a mark
 * built from the club's authentic colours. Club badges are registered
 * trademarks, so the generated form is the safe default and the image is the
 * opt-in — see `Team.logoUrl` and the README's licensing note.
 *
 * The generated form is deliberately restrained: a circular disc, the club's
 * two colours as a vertical split the way kit colours actually read, a hairline
 * edge, and the code set in semibold with open letterspacing. An earlier version
 * used a chunky rounded square with heavy black initials and looked like a
 * placeholder app icon — at small sizes, weight and roundness are what separate
 * "designed" from "unfinished".
 */

/** Relative luminance, per WCAG. Used to pick readable text on any colour. */
function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between two colours, per WCAG. Used to decide whether the
 * club's second colour is distinguishable from its first — many clubs list a
 * near-identical pair, and splitting a disc into two shades nobody can tell
 * apart just looks like a rendering fault.
 */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Fallback code when the data layer hasn't assigned a league-unique one. */
function initialsFor(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter((w) => w.length > 0 && !/^(FC|AFC|CF|SC|AC)$/i.test(w));

  const source = words.length > 0 ? words : [name];

  if (source.length === 1) return source[0].slice(0, 2).toUpperCase();
  return `${source[0][0]}${source[source.length - 1][0]}`.toUpperCase();
}

export function TeamMark({
  name,
  primary,
  secondary,
  logoUrl,
  abbreviation,
  size = 40,
}: {
  name: string;
  primary: string;
  secondary: string;
  logoUrl?: string;
  /** League-unique code from the data layer. Derived from the name if absent. */
  abbreviation?: string;
  size?: number;
}) {
  if (logoUrl) {
    return (
      // Plain <img>: licensed crests come from arbitrary CDNs, and registering
      // every host in next.config is friction for no gain on a 40px asset.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        aria-hidden
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  // Clubs playing in white (Fulham, Leeds, Real Madrid) would render white on
  // white. Pick text from measured luminance rather than assuming dark kits.
  const isLight = luminance(primary) > 0.6;
  const text = isLight ? "#0b1220" : "#ffffff";

  /**
   * The second colour is a rim, not a half-and-half split.
   *
   * Splitting the disc down the middle put half the code on each colour, and
   * text colour can only be chosen against one of them — so Arsenal (white
   * secondary, white text) rendered as "A" with the R invisible. A rim keeps
   * both club colours present while guaranteeing the code always sits on a
   * solid field.
   *
   * Skipped entirely when the two colours are too close to tell apart, which
   * would otherwise read as a rendering fault rather than a design.
   */
  const showRim = contrast(primary, secondary) >= 1.4;
  const rim = Math.max(2, Math.round(size * 0.09));

  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: showRim ? secondary : primary,
        padding: showRim ? rim : 0,
        boxShadow: isLight
          ? "inset 0 0 0 1px rgb(11 18 32 / 0.16)"
          : "0 1px 2px rgb(11 18 32 / 0.12)",
      }}
    >
      <span
        className="grid h-full w-full place-items-center rounded-full"
        style={{
          background: primary,
          boxShadow:
            showRim && isLight ? "inset 0 0 0 1px rgb(11 18 32 / 0.12)" : undefined,
        }}
      >
        <span
          className="font-semibold leading-none"
          style={{
            fontSize: size * (showRim ? 0.3 : 0.32),
            letterSpacing: "0.03em",
            color: text,
          }}
        >
          {abbreviation ?? initialsFor(name)}
        </span>
      </span>
    </span>
  );
}
