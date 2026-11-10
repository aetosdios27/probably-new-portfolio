// The pond keeps the six seasons of the Indian calendar (the ritus), each about two months long and
// turning mid-month. It follows the date in India, so every visitor sees the season where the site
// was written rather than their own.

export const SEASONS = ["spring", "summer", "monsoon", "autumn", "prewinter", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/** Month (1-12) in which each season begins, on TURN_DAY. */
const STARTS: Record<Season, number> = { spring: 3, summer: 5, monsoon: 7, autumn: 9, prewinter: 11, winter: 1 };
const TURN_DAY = 15;
/** Days on either side of a turn over which one season gives way to the next. */
const BLEND_DAYS = 10;
const DAY_MS = 86_400_000;
const INDIA_OFFSET_MS = 5.5 * 3_600_000;

export function isSeason(value: unknown): value is Season {
  return typeof value === "string" && (SEASONS as readonly string[]).includes(value);
}

/** Pure calendar rule shared with the boot script: the season of a month (1-12) and day. */
export function seasonOf(month: number, day: number): Season {
  const index = Math.floor(((month + 9) % 12) / 2);
  const started = month % 2 === 1 ? day >= TURN_DAY : true;
  return SEASONS[started ? index : (index + 5) % 6];
}

/**
 * Where a moment falls in the year: the season it belongs to, the neighbour it is turning from or
 * into, and how far that turn has gone. `blend` is 0 through most of a season and reaches 0.5 on
 * the turn itself, so a renderer can mix `season * (1 - blend) + toward * blend` and never jump.
 */
export type SeasonMoment = { season: Season; toward: Season; blend: number };

export function seasonAt(date: Date): SeasonMoment {
  const india = new Date(date.getTime() + INDIA_OFFSET_MS);
  const year = india.getUTCFullYear();
  const season = seasonOf(india.getUTCMonth() + 1, india.getUTCDate());
  const index = SEASONS.indexOf(season);
  // The turns that bound this season: the one that began it and the one that will end it.
  const startMonth = STARTS[season];
  let began = Date.UTC(year, startMonth - 1, TURN_DAY);
  if (began > india.getTime()) began = Date.UTC(year - 1, startMonth - 1, TURN_DAY);
  const ends = Date.UTC(new Date(began).getUTCFullYear(), new Date(began).getUTCMonth() + 2, TURN_DAY);
  const sinceStart = (india.getTime() - began) / DAY_MS;
  const untilEnd = (ends - india.getTime()) / DAY_MS;
  if (untilEnd < BLEND_DAYS) return { season, toward: SEASONS[(index + 1) % 6], blend: 0.5 * (1 - untilEnd / BLEND_DAYS) };
  if (sinceStart < BLEND_DAYS) return { season, toward: SEASONS[(index + 5) % 6], blend: 0.5 * (1 - sinceStart / BLEND_DAYS) };
  return { season, toward: season, blend: 0 };
}

/** `?season=winter` pins one season with no blending, for previews and screenshots. */
export function seasonOverride(search: string): Season | null {
  const value = new URLSearchParams(search).get("season");
  return isSeason(value) ? value : null;
}

export function resolveSeason(search: string, date: Date): SeasonMoment {
  const pinned = seasonOverride(search);
  return pinned ? { season: pinned, toward: pinned, blend: 0 } : seasonAt(date);
}
