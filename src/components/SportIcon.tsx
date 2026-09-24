import type { SportId } from "@/lib/domain/types";

/**
 * Sport iconography.
 *
 * Custom line artwork rather than emoji: emoji render differently on every
 * platform, can't inherit colour, and read as a placeholder in a product asking
 * people to spend money.
 *
 * These depict generic objects — a ball, a wicket, a checkered flag — so
 * there's no trademark question, unlike club crests. All are drawn on the same
 * 24px grid with a single stroke weight so they sit together as a set, and use
 * `currentColor` so they take the accent of whatever they're placed in.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ART: Record<SportId, React.ReactNode> = {
  // Ball with the classic pentagon-and-seams panelling.
  soccer: (
    <>
      <circle cx="12" cy="12" r="8.75" {...STROKE} />
      <path d="M12 7.4l3.55 2.6-1.36 4.2H9.81L8.45 10z" {...STROKE} />
      <path
        d="M12 3.25V7.4M20.3 10.1l-4.75-.1M17.1 19.6l-2.91-5.4M6.9 19.6l2.91-5.4M3.7 10.1l4.75-.1"
        {...STROKE}
      />
    </>
  ),

  // Bat and ball. A wicket is more distinctive in principle, but three thin
  // stumps under a bail collapse into an illegible smudge at 24px — the bat's
  // single bold diagonal survives the size.
  cricket: (
    <>
      <path
        d="M5.6 16.6L14.6 7.6a2 2 0 0 1 2.8 2.8L8.4 19.4a2 2 0 0 1-2.8-2.8z"
        {...STROKE}
      />
      <path d="M16 9l3.3-3.3" {...STROKE} strokeWidth={2} />
      <circle cx="5.6" cy="6.4" r="2.7" {...STROKE} />
    </>
  ),

  basketball: (
    <>
      <circle cx="12" cy="12" r="8.75" {...STROKE} />
      <path d="M12 3.25v17.5M3.25 12h17.5" {...STROKE} />
      <path d="M12 3.25c-3.6 3.9-3.6 13.6 0 17.5" {...STROKE} />
      <path d="M12 3.25c3.6 3.9 3.6 13.6 0 17.5" {...STROKE} />
    </>
  ),

  // Checkered flag — reads as motorsport far faster than a car silhouette does
  // at 24px.
  motorsport: (
    <>
      <path d="M5.2 3.4v17.2" {...STROKE} />
      <path d="M5.2 4.6h14.6v8.8H5.2z" {...STROKE} />
      <path
        d="M5.2 4.6h3.65v2.2H5.2zM12.5 4.6h3.65v2.2H12.5zM8.85 6.8h3.65v2.2H8.85zM16.15 6.8h3.65v2.2h-3.65zM5.2 9h3.65v2.2H5.2zM12.5 9h3.65v2.2H12.5zM8.85 11.2h3.65v2.2H8.85zM16.15 11.2h3.65v2.2h-3.65z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),

  // Racket rather than a ball: a tennis ball and a baseball are nearly the same
  // shape at this size.
  tennis: (
    <>
      <ellipse
        cx="10.4"
        cy="8.8"
        rx="5.3"
        ry="6.4"
        transform="rotate(-35 10.4 8.8)"
        {...STROKE}
      />
      <path d="M13.9 13.6l5.6 6.6" {...STROKE} />
      <path d="M7 6.3l6.4 6.1M12.9 5.2l-5 7.6" {...STROKE} strokeWidth={1} />
    </>
  ),

  "combat-sports": (
    <>
      <path
        d="M7.6 9.1a4.6 4.6 0 0 1 4.6-4.6h1.6a4.6 4.6 0 0 1 4.6 4.6v3.3a3.7 3.7 0 0 1-3.7 3.7h-3.4a3.7 3.7 0 0 1-3.7-3.7z"
        {...STROKE}
      />
      <path d="M7.6 10.4H6.2a2.4 2.4 0 0 0 0 4.8h1.4" {...STROKE} />
      <path d="M9.4 16.1h7.4v2.6a1.3 1.3 0 0 1-1.3 1.3h-4.8a1.3 1.3 0 0 1-1.3-1.3z" {...STROKE} />
    </>
  ),

  baseball: (
    <>
      <circle cx="12" cy="12" r="8.75" {...STROKE} />
      <path d="M6.6 5.2c2.5 1.9 4 4.1 4 6.8s-1.5 4.9-4 6.8" {...STROKE} />
      <path d="M17.4 5.2c-2.5 1.9-4 4.1-4 6.8s1.5 4.9 4 6.8" {...STROKE} />
    </>
  ),

  golf: (
    <>
      <path d="M8.6 3.6v15.2" {...STROKE} />
      <path d="M8.6 3.6l8.6 2.9-8.6 2.9z" {...STROKE} />
      <ellipse cx="8.6" cy="19.8" rx="4.6" ry="1.7" {...STROKE} />
      <circle cx="16.6" cy="18.6" r="1.9" {...STROKE} />
    </>
  ),

  // Tilted, not horizontal. Drawn flat, a pointed oval with a line of laces
  // through the middle reads unmistakably as an eye; the diagonal is what makes
  // it a ball.
  "american-football": (
    <g transform="rotate(-35 12 12)">
      <path d="M3.6 12c3-5.3 13.8-5.3 16.8 0-3 5.3-13.8 5.3-16.8 0z" {...STROKE} />
      <path d="M9.2 12h5.6" {...STROKE} />
      <path d="M10.5 10.6v2.8M12 10.6v2.8M13.5 10.6v2.8" {...STROKE} />
    </g>
  ),

  "ice-hockey": (
    <>
      <path d="M7.2 3.6l3.1 11.4" {...STROKE} />
      <path d="M10.3 15h5.1" {...STROKE} />
      <ellipse cx="18.6" cy="17.4" rx="2.6" ry="1.6" {...STROKE} />
      <path d="M16 17.4v1.5c0 .9 1.2 1.6 2.6 1.6s2.6-.7 2.6-1.6v-1.5" {...STROKE} />
    </>
  ),
};

export function SportIcon({
  sport,
  size = 24,
  className,
}: {
  sport: SportId;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      {ART[sport]}
    </svg>
  );
}
