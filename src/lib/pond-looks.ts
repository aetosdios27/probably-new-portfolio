// What the pond looks like: six seasons, each by night (dark theme) and by day (light theme).
// A look is flat data, numbers and colours only, so two looks can be mixed field by field. The
// renderers and the simulation read one look and know nothing about seasons or themes; turning a
// season and cross-fading the theme are both just `mixLooks`.

import type { Season } from "./season";
import type { Theme } from "./theme";

export type RGB = readonly [number, number, number];

/** Every numeric field and the range it may take. Weights are 0 (layer off) to 1 unless noted. */
export const LOOK_SCALARS = {
  /** How much the pebbles stand out from the sand. */
  pebbles: [0, 1],
  /** How strongly the water's own tint covers the bed. 1 is the original pond; lower is clearer. */
  murk: [0, 1.5],
  algaeAmount: [0, 1],
  /** Brightness of the caustic net on the bed. */
  caustic: [0, 1],
  /** Brightness of the highlight a ripple leaves on the water. */
  ripple: [0, 1],
  /** Overall exposure of the water before lights are added. */
  gain: [0.4, 1.2],
  /**
   * How much light falls on everything that does not shine by itself: water, bed, ice, pads, leaves,
   * petals, snow, mist. Low at night. What emits (moon, sun, lit windows, lamps, fireflies, lightning)
   * is never scaled by it, so at night lights stay bright over a dark pond, as they do on real water.
   */
  ambient: [0, 1.2],
  /** How much of the sky the water mirrors. */
  mirror: [0, 1.5],
  /** Share of skyline windows that are lit. */
  windows: [0, 0.5],
  /** Brightness of everything that emits: windows, bridge lamps, carriage glass. */
  lights: [0, 1],
  /** Radius of the moon or sun in css px. */
  orbSize: [8, 80],
  /** Soft glow around the moon or sun. */
  orbGlow: [0, 1],
  /** 0 is a full disc (the sun); higher shades more of the moon away into a thinner crescent. */
  crescent: [0, 1],
  /** Where the body is on its way across the sky: 0 at rest, -1 below the west edge, 1 gone east. */
  orbX: [-1, 1],
  /** The glitter path under the moon or sun, and sparks along the caustics. */
  glitter: [0, 1.5],
  stars: [0, 1],
  /** Cloud cover in the mirrored sky. */
  clouds: [0, 1],
  /** A soft sheet-lightning glow about every half minute. */
  lightning: [0, 1],
  /** Speed of everything the air moves: clouds, mist, snow, things afloat. */
  wind: [0, 1],
  /** Density of lily pads. */
  pads: [0, 1],
  /** How many pads flower and how far the flowers have opened. */
  lotus: [0, 1],
  /** Petals afloat, with a few falling. */
  petals: [0, 1],
  /** Leaves afloat. */
  leaves: [0, 1],
  /** Falling snow, and snow lying on the ice. */
  snow: [0, 1],
  /** How far ice has crept in from the shallows. */
  ice: [0, 1],
  mist: [0, 1],
  /** Shadows of bare branches across the surface. */
  branches: [0, 1],
  fireflies: [0, 1],
  /** Raindrops per second per million css px of pond. They fall through the wave simulation. */
  rain: [0, 60],
  /** Tone of the ASCII ripple crests. */
  crest: [0, 1],
  /** Strength of the bloom around the glyphs. */
  halo: [0, 1],
  /**
   * How much the bloom also dims what lies behind it. 1 on a black page, where that is invisible
   * beyond the water; 0 on paper, where it would leave a grey smudge around every koi.
   */
  haloShade: [0, 1],
  /** How fast the koi swim; cold water slows them. */
  koiPace: [0.3, 1.2],
  /** Whether a koi near the rails keeps its dark shape after the water has faded. On for a black page only. */
  koiHold: [0, 1],
} as const satisfies Record<string, readonly [number, number]>;

/** Every colour field. */
export const LOOK_COLORS = [
  "bedLow", "bedHigh", "shallow", "deep", "algae", "causticColor", "rippleColor",
  "skyNear", "skyFar", "skyline", "train", "orb", "cloudColor",
  "padDark", "padLight", "lotusColor", "petalA", "petalB", "leafA", "leafB", "leafC",
  "snowColor", "iceColor", "mistColor",
  "koiBed", "glyphRipple", "glyphShadow",
] as const;

export type LookScalar = keyof typeof LOOK_SCALARS;
export type LookColor = (typeof LOOK_COLORS)[number];
export type PondLook = { readonly [K in LookScalar]: number } & { readonly [K in LookColor]: RGB };

const SCALAR_KEYS = Object.keys(LOOK_SCALARS) as LookScalar[];

/** `a` at t = 0, `b` at t = 1, every field interpolated linearly. */
export function mixLooks(a: PondLook, b: PondLook, t: number): PondLook {
  if (t <= 0 || a === b) return a;
  if (t >= 1) return b;
  const out = {} as { [K in LookScalar]: number } & { [K in LookColor]: RGB };
  for (const key of SCALAR_KEYS) out[key] = a[key] + (b[key] - a[key]) * t;
  for (const key of LOOK_COLORS) {
    const x = a[key], y = b[key];
    out[key] = [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  }
  return out;
}

// The pond after dark, as it was before it had seasons: clear blue water, a cool dusk sky, yellow
// windows. Every night look starts from this.
const NIGHT: PondLook = {
  bedLow: [0.16, 0.32, 0.44], bedHigh: [0.26, 0.45, 0.56], pebbles: 1,
  shallow: [0.04, 0.3, 0.5], deep: [0.02, 0.13, 0.34], murk: 1,
  algae: [0.05, 0.32, 0.22], algaeAmount: 1,
  causticColor: [0.8, 0.95, 1], caustic: 0.22,
  rippleColor: [0.4, 0.65, 0.8], ripple: 0.45,
  gain: 0.82, ambient: 0.66, mirror: 1,
  skyNear: [0.19, 0.31, 0.47], skyFar: [0.014, 0.022, 0.073],
  skyline: [0.04, 0.05, 0.12], windows: 0.26, lights: 1, train: [0.12, 0.16, 0.32],
  orb: [0.95, 0.97, 1], orbSize: 28, orbGlow: 0.25, crescent: 0.75, orbX: 0, glitter: 0.9, stars: 0.35,
  clouds: 0, cloudColor: [0.16, 0.2, 0.32], lightning: 0, wind: 0.2,
  pads: 0.32, padDark: [0.07, 0.3, 0.14], padLight: [0.3, 0.62, 0.26], lotus: 0.7, lotusColor: [1, 0.5, 0.72],
  petals: 0, petalA: [1, 0.72, 0.82], petalB: [1, 0.95, 0.96],
  leaves: 0, leafA: [0.95, 0.62, 0.16], leafB: [0.8, 0.32, 0.1], leafC: [0.72, 0.12, 0.14],
  snow: 0, snowColor: [0.66, 0.74, 0.95], ice: 0, iceColor: [0.42, 0.56, 0.78],
  mist: 0, mistColor: [0.3, 0.36, 0.5], branches: 0, fireflies: 0, rain: 0,
  koiBed: [0, 0, 0], glyphRipple: [0.36, 0.84, 1], glyphShadow: [0.3, 0.45, 0.5], crest: 0.45, halo: 0.6, haloShade: 1,
  koiPace: 1, koiHold: 1,
};

// The same pond at midday on warm paper: softened print colours, pale silhouettes where the lit
// skyline was, a sun where the moon was. Every day look starts from this.
const DAY: PondLook = {
  ...NIGHT,
  bedLow: [0.42, 0.64, 0.62], bedHigh: [0.66, 0.8, 0.7],
  shallow: [0.2, 0.6, 0.62], deep: [0.07, 0.38, 0.52], murk: 0.9,
  algae: [0.3, 0.6, 0.36], algaeAmount: 0.7,
  causticColor: [1, 1, 0.92], caustic: 0.3,
  rippleColor: [1, 1, 1], ripple: 0.4,
  gain: 1.08, ambient: 1, mirror: 0.28,
  skyNear: [0.84, 0.91, 0.95], skyFar: [0.46, 0.68, 0.88],
  skyline: [0.6, 0.67, 0.76], windows: 0.04, lights: 0.25, train: [0.74, 0.36, 0.3],
  orb: [1, 0.97, 0.84], orbSize: 26, orbGlow: 0.7, crescent: 0, glitter: 0.8, stars: 0,
  clouds: 0.3, cloudColor: [1, 0.99, 0.96],
  padDark: [0.16, 0.42, 0.22], padLight: [0.5, 0.74, 0.36], lotusColor: [0.98, 0.5, 0.68],
  petalA: [0.98, 0.62, 0.74], petalB: [1, 0.96, 0.95],
  leafA: [0.93, 0.62, 0.16], leafB: [0.8, 0.36, 0.12], leafC: [0.7, 0.16, 0.14],
  snowColor: [1, 1, 1], iceColor: [0.88, 0.93, 0.97], mistColor: [0.95, 0.93, 0.87],
  koiBed: [0.05, 0.27, 0.34], glyphRipple: [1, 1, 1], glyphShadow: [0.05, 0.16, 0.2], crest: 0.5, halo: 0.3, haloShade: 0,
  koiHold: 0,
};

export const LOOKS: Record<Season, Record<Theme, PondLook>> = {
  // Vasant: fresh jade water, lotus opening, petals adrift.
  spring: {
    dark: {
      ...NIGHT,
      bedLow: [0.14, 0.34, 0.36], bedHigh: [0.26, 0.48, 0.46],
      shallow: [0.05, 0.34, 0.36], deep: [0.04, 0.13, 0.3],
      algae: [0.08, 0.4, 0.22],
      skyNear: [0.34, 0.27, 0.56], skyFar: [0.035, 0.02, 0.1], skyline: [0.06, 0.04, 0.13],
      orb: [1, 0.9, 0.95], stars: 0.4,
      pads: 0.3, lotus: 0.5, lotusColor: [1, 0.6, 0.78],
      petals: 0.6, petalA: [1, 0.66, 0.8], petalB: [1, 0.93, 0.95],
      glyphRipple: [0.6, 0.9, 0.9],
    },
    light: {
      ...DAY,
      bedLow: [0.4, 0.66, 0.54], bedHigh: [0.68, 0.82, 0.66],
      shallow: [0.2, 0.6, 0.48], deep: [0.08, 0.4, 0.42],
      algae: [0.36, 0.66, 0.36],
      skyNear: [0.99, 0.76, 0.72], skyFar: [0.6, 0.7, 0.9], skyline: [0.66, 0.56, 0.72],
      orb: [1, 0.9, 0.78], orbSize: 28, glitter: 0.6,
      clouds: 0.32, cloudColor: [1, 0.93, 0.92],
      pads: 0.3, lotus: 0.5,
      petals: 0.6,
    },
  },
  // Grishma: the clearest turquoise, the strongest caustics, pads in full bloom, fireflies.
  summer: {
    dark: {
      ...NIGHT,
      bedLow: [0.14, 0.36, 0.44], bedHigh: [0.26, 0.5, 0.56],
      shallow: [0.03, 0.34, 0.48], deep: [0.03, 0.12, 0.34], murk: 0.85,
      caustic: 0.3,
      skyNear: [0.22, 0.25, 0.52], skyFar: [0.03, 0.02, 0.1], skyline: [0.05, 0.04, 0.12],
      orb: [1, 0.96, 0.86],
      pads: 0.55, lotus: 1,
      fireflies: 0.8,
    },
    light: {
      ...DAY,
      bedLow: [0.44, 0.76, 0.74], bedHigh: [0.74, 0.9, 0.78],
      shallow: [0.1, 0.64, 0.68], deep: [0.02, 0.4, 0.58], murk: 0.75,
      caustic: 0.55, ripple: 0.5,
      skyNear: [0.78, 0.92, 0.98], skyFar: [0.26, 0.6, 0.92],
      orb: [1, 0.99, 0.9], orbSize: 30, orbGlow: 0.9, glitter: 1.4,
      clouds: 0.18,
      pads: 0.55, lotus: 1,
    },
  },
  // Varsha: rain rings everywhere, grey-green storm water, low cloud rolling in the mirror.
  monsoon: {
    dark: {
      ...NIGHT,
      bedLow: [0.12, 0.26, 0.28], bedHigh: [0.2, 0.36, 0.36], pebbles: 0.6,
      shallow: [0.06, 0.25, 0.25], deep: [0.03, 0.1, 0.15], murk: 1.3,
      algae: [0.05, 0.3, 0.16],
      caustic: 0.05, rippleColor: [0.5, 0.66, 0.7], ripple: 0.5,
      skyNear: [0.2, 0.25, 0.3], skyFar: [0.03, 0.04, 0.07], skyline: [0.03, 0.04, 0.07],
      windows: 0.2,
      orb: [0.3, 0.34, 0.4], orbGlow: 0.1, glitter: 0.1, stars: 0,
      clouds: 0.9, cloudColor: [0.13, 0.16, 0.2], lightning: 1, wind: 0.8,
      pads: 0.45, lotus: 0.15, padDark: [0.05, 0.26, 0.14], padLight: [0.2, 0.5, 0.26],
      rain: 26,
      glyphRipple: [0.56, 0.8, 0.84], crest: 0.4,
    },
    light: {
      ...DAY,
      bedLow: [0.3, 0.44, 0.4], bedHigh: [0.46, 0.58, 0.5], pebbles: 0.6,
      shallow: [0.16, 0.38, 0.34], deep: [0.07, 0.22, 0.25], murk: 1.3,
      algae: [0.12, 0.4, 0.22], algaeAmount: 1,
      caustic: 0.05, ripple: 0.5,
      gain: 0.95, mirror: 0.95,
      skyNear: [0.74, 0.78, 0.78], skyFar: [0.42, 0.48, 0.52], skyline: [0.32, 0.38, 0.42],
      lights: 0.4, windows: 0.08,
      orb: [0.86, 0.88, 0.86], orbGlow: 0.3, glitter: 0.1,
      clouds: 0.88, cloudColor: [0.34, 0.39, 0.44], wind: 0.8,
      pads: 0.45, lotus: 0.15, padDark: [0.08, 0.32, 0.18], padLight: [0.3, 0.58, 0.3],
      rain: 26, crest: 0.45,
    },
  },
  // Sharad: amber, rust and crimson leaves on deep teal water, and a huge harvest moon.
  autumn: {
    dark: {
      ...NIGHT,
      bedLow: [0.1, 0.3, 0.36], bedHigh: [0.2, 0.42, 0.44],
      shallow: [0.03, 0.28, 0.34], deep: [0.02, 0.11, 0.22],
      algae: [0.14, 0.28, 0.12], algaeAmount: 0.7,
      causticColor: [1, 0.86, 0.6],
      skyNear: [0.34, 0.24, 0.3], skyFar: [0.04, 0.025, 0.08], skyline: [0.06, 0.04, 0.09],
      orb: [1, 0.76, 0.38], orbSize: 62, orbGlow: 0.6, glitter: 1.2, stars: 0.25,
      pads: 0.14, lotus: 0, padDark: [0.2, 0.26, 0.08], padLight: [0.5, 0.5, 0.18],
      leaves: 0.42,
      glyphRipple: [0.5, 0.82, 0.86],
    },
    light: {
      ...DAY,
      bedLow: [0.2, 0.46, 0.48], bedHigh: [0.44, 0.62, 0.54],
      shallow: [0.04, 0.34, 0.42], deep: [0.01, 0.19, 0.32], murk: 1.15,
      algae: [0.3, 0.44, 0.2], algaeAmount: 0.5,
      causticColor: [1, 0.9, 0.6], caustic: 0.3,
      mirror: 0.5,
      skyNear: [1, 0.82, 0.5], skyFar: [0.62, 0.68, 0.7], skyline: [0.62, 0.44, 0.34],
      orb: [1, 0.8, 0.36], orbSize: 38, orbGlow: 1, glitter: 1.2,
      clouds: 0.2, cloudColor: [1, 0.93, 0.8],
      pads: 0.14, lotus: 0, padDark: [0.36, 0.42, 0.14], padLight: [0.7, 0.66, 0.26],
      leaves: 0.42,
    },
  },
  // Hemant: the quiet one. Mist low over still, dark, clear water; bare branches; a crisp sky.
  prewinter: {
    dark: {
      ...NIGHT,
      bedLow: [0.1, 0.22, 0.34], bedHigh: [0.18, 0.34, 0.46],
      shallow: [0.03, 0.18, 0.32], deep: [0.01, 0.07, 0.2], murk: 0.9,
      algaeAmount: 0.3,
      caustic: 0.12, ripple: 0.38,
      skyNear: [0.12, 0.21, 0.42], skyFar: [0.008, 0.014, 0.06],
      orb: [0.86, 0.93, 1], orbSize: 24, orbGlow: 0.45, glitter: 0.8, stars: 1,
      pads: 0.06, lotus: 0, padDark: [0.16, 0.2, 0.1], padLight: [0.34, 0.36, 0.18],
      leaves: 0.14, leafA: [0.62, 0.42, 0.16], leafB: [0.5, 0.26, 0.1], leafC: [0.4, 0.14, 0.1],
      mist: 0.6, mistColor: [0.3, 0.38, 0.56], branches: 1, wind: 0.1,
      koiPace: 0.85,
    },
    light: {
      ...DAY,
      bedLow: [0.2, 0.36, 0.42], bedHigh: [0.38, 0.52, 0.52],
      shallow: [0.08, 0.28, 0.38], deep: [0.03, 0.14, 0.27], murk: 1.05,
      algae: [0.24, 0.4, 0.3], algaeAmount: 0.3,
      causticColor: [1, 0.95, 0.76], caustic: 0.14, ripple: 0.34,
      mirror: 0.5,
      skyNear: [0.98, 0.9, 0.7], skyFar: [0.74, 0.8, 0.84], skyline: [0.66, 0.64, 0.62],
      orb: [1, 0.93, 0.7], orbSize: 24, orbGlow: 1, glitter: 0.7,
      clouds: 0.1, cloudColor: [1, 0.96, 0.86],
      pads: 0.06, lotus: 0, padDark: [0.3, 0.34, 0.16], padLight: [0.5, 0.5, 0.26],
      leaves: 0.14, leafA: [0.72, 0.5, 0.2], leafB: [0.6, 0.34, 0.14], leafC: [0.48, 0.2, 0.14],
      mist: 0.55, mistColor: [0.97, 0.94, 0.85], branches: 0.7, wind: 0.1,
      koiPace: 0.85,
    },
  },
  // Shishir: steel-blue water, thin ice creeping in from the shallows, snow. The koi slow down.
  winter: {
    dark: {
      ...NIGHT,
      bedLow: [0.12, 0.24, 0.4], bedHigh: [0.22, 0.36, 0.52],
      shallow: [0.05, 0.2, 0.4], deep: [0.02, 0.08, 0.26],
      algaeAmount: 0,
      caustic: 0.1, rippleColor: [0.5, 0.66, 0.9],
      skyNear: [0.14, 0.24, 0.52], skyFar: [0.015, 0.025, 0.11], skyline: [0.04, 0.05, 0.14],
      windows: 0.32,
      orb: [0.9, 0.94, 1], orbSize: 24, glitter: 0.6, stars: 0.2,
      clouds: 0.35, cloudColor: [0.2, 0.26, 0.42], wind: 0.35,
      pads: 0, lotus: 0,
      snow: 0.9, ice: 0.72,
      koiPace: 0.6,
    },
    light: {
      ...DAY,
      bedLow: [0.34, 0.5, 0.62], bedHigh: [0.56, 0.68, 0.76],
      shallow: [0.22, 0.42, 0.6], deep: [0.1, 0.25, 0.46], murk: 1,
      algaeAmount: 0,
      caustic: 0.12, causticColor: [1, 1, 1],
      skyNear: [0.9, 0.93, 0.96], skyFar: [0.62, 0.72, 0.84], skyline: [0.56, 0.62, 0.72],
      lights: 0.5, windows: 0.1,
      orb: [1, 0.98, 0.92], orbSize: 22, orbGlow: 0.5, glitter: 0.35,
      clouds: 0.5, cloudColor: [0.97, 0.98, 1], wind: 0.35,
      pads: 0, lotus: 0,
      snow: 0.9, ice: 0.72,
      koiPace: 0.6,
    },
  },
};

const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** The moon and the sun are different bodies; seasons only change a body's colour and size. */
function sameBody(a: PondLook, b: PondLook) {
  return Math.abs(a.crescent - b.crescent) < 0.05;
}

function withBody(look: PondLook, body: PondLook, orbX: number): PondLook {
  return { ...look, orb: body.orb, orbSize: body.orbSize, orbGlow: body.orbGlow, glitter: body.glitter, crescent: body.crescent, orbX };
}

/**
 * The look `progress` (0 to 1) of the way from `from` to `to`. Everything blends except the body in
 * the sky, which never morphs: when night becomes day the moon leaves to the east, then the sun
 * arrives from the west, each with its own colour, size and shape. If the same body is still showing
 * (a toggle reversed mid-flight) it glides back to rest instead.
 */
export function skyChange(from: PondLook, to: PondLook, progress: number): PondLook {
  const t = Math.min(1, Math.max(0, progress));
  const mixed = mixLooks(from, to, smooth(t));
  if (sameBody(from, to)) return withBody(mixed, to, from.orbX + (to.orbX - from.orbX) * easeOut(t));
  if (t < 0.5) return withBody(mixed, from, from.orbX + (1 - from.orbX) * easeIn(t * 2));
  return withBody(mixed, to, -1 + (to.orbX + 1) * easeOut(t * 2 - 1));
}
