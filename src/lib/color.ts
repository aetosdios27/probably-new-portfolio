// sRGB hex <-> OKLCH, so JavaScript can derive the same light-theme colours that CSS derives with
// `oklch(from <colour> L calc(c * k) h)`. Out-of-gamut results are clipped per channel, as Chrome does.

type Oklch = { l: number; c: number; h: number };

const toLinear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const toGamma = (channel: number) => (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function hexChannels(hex: string) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexChannels(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI };
}

export function oklchToHex({ l: L, c, h }: Oklch) {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb.map((channel) => Math.round(clamp01(toGamma(clamp01(channel))) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** The colour at a fixed OKLCH lightness, keeping its hue and scaling its chroma. */
export function atLightness(hex: string, lightness: number, chroma = 1) {
  const { c, h } = hexToOklch(hex);
  return oklchToHex({ l: lightness, c: c * chroma, h });
}

export function relativeLuminance(hex: string) {
  const [r, g, b] = hexChannels(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(foreground: string, background: string) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
