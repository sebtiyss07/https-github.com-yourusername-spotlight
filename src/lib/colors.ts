/** Relative luminance (WCAG) of a #rrggbb colour: 0 is black, 1 is white. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * A team colour dark enough for white text on top: the team's main colour,
 * or its second colour when the main one is light (Fulham's white, Golden
 * State's gold), or a neutral dark when both are light.
 */
export function darkTeamColor(team: { primaryColor: string; secondaryColor: string }): string {
  if (luminance(team.primaryColor) < 0.3) return team.primaryColor;
  if (luminance(team.secondaryColor) < 0.3) return team.secondaryColor;
  return "#1f2340";
}
