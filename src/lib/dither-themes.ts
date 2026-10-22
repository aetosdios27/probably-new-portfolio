import type { DitherMode, DitherMouseEffect } from "@/components/react-bits/dither";
import { accentFor, ACCENT_COLORS } from "@/lib/accent-palette";
import type { ActivityItem } from "@/lib/repo-activity";

// Every page shares one frame (placement, fade toward the rails, opacity). A theme
// varies only the pattern and the colour, plus speed and amplitude for liveliness.
export type DitherTheme = {
  mode: DitherMode;
  /** The pattern colour. Dimmed and dithered, so it can be darker than text could be. */
  color: string;
  /** The same hue made readable as small text; it becomes the page's --accent. */
  text: string;
  speed: number;
  frequency: number;
  amplitude: number;
  mouseEffect?: DitherMouseEffect;
};

const [PISTACHIO, ROSE, APRICOT, CREAM, CYAN] = ACCENT_COLORS;
const BASE = { speed: 0.04, frequency: 3, amplitude: 0.3 };

export const PAGE_DITHERS = {
  playground: { ...BASE, mode: "bayer", color: PISTACHIO, text: PISTACHIO },
  notFound: { ...BASE, mode: "noise", color: CREAM, text: CREAM, speed: 0.08 },
  error: { ...BASE, mode: "crosshatch", color: ROSE, text: ROSE },
  dispatches: { ...BASE, mode: "bayer2", color: CYAN, text: CYAN, speed: 0.02 },
} satisfies Record<string, DitherTheme>;

// Pattern and hue follow each project's own site where it has one: Kiban's yellow
// and its levelled ASCII pyramid, Scribe's electric blue and halftone globe, WebNotes'
// slate app. Konto has no site, so it takes a ledger grid in green. Styx and Kurogane
// have none either and use palette hues. Anything else falls back to a hashed accent.
const PROJECT_DITHERS: Record<string, Partial<DitherTheme>> = {
  kiban: { mode: "lines", color: "#f5d547", frequency: 2.2 },
  kurogane: { mode: "bayer", color: APRICOT, mouseEffect: "ripple" },
  styx: { mode: "bayer", color: CYAN, frequency: 4.5, speed: 0.07 },
  scribe: { mode: "halftone", color: "#4f6bff", text: "#8aa0ff" },
  webnotes: { mode: "crosshatch", color: "#9aa8f0", speed: 0.03 },
  konto: { mode: "bayer4", color: "#7dd3b0", frequency: 2.6 },
};

const DAY = 86_400_000;

/** A project that moved recently gets a livelier field; a dormant one settles. */
export function projectDither(slug: string, activity: ActivityItem[] = []): DitherTheme {
  const override = PROJECT_DITHERS[slug];
  const color = override?.color ?? accentFor(slug);
  // Text defaults to the pattern colour; a theme whose pattern is too dark to read sets its own.
  const theme: DitherTheme = { ...BASE, mode: "bayer", ...override, color, text: override?.text ?? color };
  if (activity.length === 0) return theme;
  const recent = activity.filter(({ date }) => Date.now() - new Date(date).getTime() < 30 * DAY).length;
  const intensity = Math.min(1, recent / 8);
  return { ...theme, amplitude: 0.18 + 0.2 * intensity, speed: theme.speed * (0.6 + 0.8 * intensity) };
}
