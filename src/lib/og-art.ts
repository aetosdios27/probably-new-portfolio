// Share-image artwork. It is the site in miniature: black canvas, a content column between dashed
// rails, hatch bands top and bottom, and a dithered pond in the margins that fades toward the column.
// Everything is generated as one SVG string (deterministic, no assets) and embedded as an image, which
// is the form Satori renders fastest.

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_RAIL = { left: 144, right: 1056 } as const;

const CELL = 6;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

// A small koi, one letter per cell: r red, w white, k black spot, . empty.
const KOI = [
  "..........wwww.........",
  "......wwwwwrrwwww......",
  "...wwwrrrrrrrrrrwww....",
  ".wwwwrrrrkkrrrrrrrww...",
  "wwwwwwwrrrrrrrrrrwwwww.",
  ".wwwwrrrrkkrrrrrrrww...",
  "...wwwrrrrrrrrrrwww....",
  "......wwwwwrrwwww......",
  "..........wwww.........",
];
const KOI_COLORS: Record<string, string> = { r: "#e2553a", w: "#f2ece0", k: "#14110f" };

/** The pond, as the margin art for a share image. `palette` goes from dark water to light. */
export function pondArt({ palette, seed = 7, windows = false, koi = false }: { palette: [string, string, string]; seed?: number; windows?: boolean; koi?: boolean }) {
  const { width, height } = OG_SIZE;
  const random = rng(seed);
  const paths = new Map<string, string>();
  const put = (color: string, x: number, y: number, w = 1, h = 1) => {
    paths.set(color, `${paths.get(color) ?? ""}M${x * CELL} ${y * CELL}h${w * CELL}v${h * CELL}h${-w * CELL}z`);
  };
  const cols = width / CELL, rows = height / CELL;

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x = cx * CELL;
      const distance = x < OG_RAIL.left ? OG_RAIL.left - x : x > OG_RAIL.right ? x - OG_RAIL.right : 0;
      if (distance === 0) continue;
      const fade = smooth(0, 144, distance) * 0.85;
      const wave = 0.5 + 0.28 * Math.sin(x * 0.013 + cy * 0.21 + seed) + 0.22 * Math.sin(x * 0.031 - cy * 0.09 + seed * 2.1);
      const level = Math.floor(wave * fade * 3.2 + (BAYER4[(cy % 4) * 4 + (cx % 4)] / 16 - 0.5) * 0.9);
      if (level >= 1) put(palette[Math.min(2, level - 1)], cx, cy);
    }
  }

  // Lit windows along the top, from towers reflected in the water: all yellow.
  if (windows) {
    const yellows = ["#f6c744", "#ffe28a", "#f0a92c"];
    for (const side of [0, 1]) {
      const from = side === 0 ? 0 : OG_RAIL.right / CELL + 2;
      const to = side === 0 ? OG_RAIL.left / CELL - 2 : cols;
      for (let tower = from; tower < to - 3; tower += 9) {
        const reach = 6 + Math.floor(random() * 22);
        for (let wy = 3; wy < reach; wy += 4) {
          for (let wx = 1; wx < 7; wx += 3) {
            if (random() < 0.3) put(yellows[Math.floor(random() * 3)], tower + wx, wy, 2, 2);
          }
        }
      }
    }
  }

  if (koi) {
    const ox = 5, oy = Math.floor(rows * 0.62);
    KOI.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") put(KOI_COLORS[ch], ox + x, oy + y); }));
  }

  const rects = [...paths].map(([color, d]) => `<path fill="${color}" d="${d}"/>`).join("");
  const band = (y: number) => `<rect x="0" y="${y}" width="${width}" height="44" fill="url(#hatch)"/><path d="M0 ${y}H${width}M0 ${y + 44}H${width}" stroke="#f2f2f2" stroke-opacity="0.3" stroke-dasharray="2.5 3.5" fill="none"/>`;
  const rails = [OG_RAIL.left, OG_RAIL.right].map(x => `<path d="M${x} 0V${height}" stroke="#f2f2f2" stroke-opacity="0.3" stroke-dasharray="2.5 3.5" fill="none"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#000"/><path d="M0 0H8" stroke="#f2f2f2" stroke-opacity="0.1" stroke-width="1"/></pattern></defs><rect width="${width}" height="${height}" fill="#000"/>${rects}<rect x="${OG_RAIL.left}" y="0" width="${OG_RAIL.right - OG_RAIL.left}" height="${height}" fill="#000"/>${band(48)}${band(height - 92)}${rails}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
