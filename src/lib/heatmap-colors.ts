export type HeatmapCell = { date: string; column: number; row: number };

export function hash(text: string) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}

/**
 * Gives every cell a starting palette index that looks random but is a pure function of
 * the data: the same dates always get the same colours. A cell never matches the cell to
 * its left or above it, so neighbours always differ.
 */
export function assignColors(cells: HeatmapCell[], paletteSize: number): Map<string, number> {
  const assigned = new Map<string, number>();
  const byPosition = new Map(cells.map((cell) => [`${cell.column}:${cell.row}`, cell.date]));
  const ordered = [...cells].sort((a, b) => a.column - b.column || a.row - b.row);
  for (const cell of ordered) {
    const taken = new Set<number>();
    for (const key of [`${cell.column - 1}:${cell.row}`, `${cell.column}:${cell.row - 1}`]) {
      const neighbour = byPosition.get(key);
      const color = neighbour ? assigned.get(neighbour) : undefined;
      if (color !== undefined) taken.add(color);
    }
    const preferred = hash(cell.date) % paletteSize;
    let index = preferred;
    for (let step = 0; step < paletteSize && taken.has(index); step++) index = (preferred + step + 1) % paletteSize;
    assigned.set(cell.date, index);
  }
  return assigned;
}

export type Twinkle = { period: number; delay: number; jitter: number };

const MIN_PERIOD_SECONDS = 5;
const PERIOD_RANGE_SECONDS = 6;

/**
 * Each square is its own star. Its period (5-11s), its starting point in that period, and
 * how bright it flares are all seeded from its date, so the field looks random, never
 * moves in lockstep, and is identical on every load.
 */
export function twinkleFor(date: string): Twinkle {
  const seed = hash(date);
  const period = MIN_PERIOD_SECONDS + ((seed % 1000) / 1000) * PERIOD_RANGE_SECONDS;
  const delay = -(((seed >>> 10) % 1000) / 1000) * period;
  const jitter = 0.85 + (((seed >>> 20) % 1000) / 1000) * 0.15;
  return { period, delay, jitter };
}
