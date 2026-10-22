// Luminous, slightly softened colors for the near-black canvas: pistachio,
// rose, apricot, cream, cyan, lavender. The only color the site uses beyond
// --accent, so keep it to rare moments.
export const ACCENT_COLORS = ["#B6CE8A", "#E7A6BC", "#EDBA8B", "#E5D7AE", "#91C9DB", "#B9ABDF"] as const;

export function accentFor(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

// The same six hues, pushed to roughly double the saturation. The softened set above reads as
// pastel on text; on a dark heatmap the squares need chroma to stand out from their grey.
export const VIVID_ACCENT_COLORS = ["#C4F06C", "#FF8DB8", "#FFB26B", "#FFE89E", "#5CD5FF", "#A99BFF"] as const;
