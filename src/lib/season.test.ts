import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { BOOT_SCRIPT } from "./boot-script";
import { resolveSeason, seasonAt, seasonOf, SEASONS } from "./season";

const india = (iso: string) => new Date(`${iso}T12:00:00+05:30`);

function boot(search: string, now: number, stored: string | null, prefersLight: boolean, storedMode: string | null = null) {
  const dataset: Record<string, string> = {};
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date> | []) { if (args.length) super(...(args as [number])); else super(now); }
    static now() { return now; }
  }
  new Function("document", "location", "localStorage", "matchMedia", "Date", BOOT_SCRIPT)(
    { documentElement: { dataset } }, { search }, { getItem: (key: string) => (key === "aetos:mode" ? storedMode : stored) }, () => ({ matches: prefersLight }), FakeDate);
  return dataset;
}

describe("seasons", () => {
  test("each season runs from the 15th for two months", () => {
    assert.equal(seasonOf(3, 14), "winter");
    assert.equal(seasonOf(3, 15), "spring");
    assert.equal(seasonOf(5, 15), "summer");
    assert.equal(seasonOf(7, 15), "monsoon");
    assert.equal(seasonOf(9, 15), "autumn");
    assert.equal(seasonOf(11, 14), "autumn");
    assert.equal(seasonOf(11, 15), "prewinter");
    assert.equal(seasonOf(12, 31), "prewinter");
    assert.equal(seasonOf(1, 14), "prewinter");
    assert.equal(seasonOf(1, 15), "winter");
  });

  test("mid-season is unblended, and a turn is approached and left without a jump", () => {
    assert.deepEqual(seasonAt(india("2026-10-15")), { season: "autumn", toward: "autumn", blend: 0 });
    const before = seasonAt(india("2026-11-10"));
    assert.equal(before.season, "autumn");
    assert.equal(before.toward, "prewinter");
    assert.ok(before.blend > 0.2 && before.blend < 0.3);
    const justBefore = seasonAt(new Date("2026-11-14T23:59:00+05:30"));
    const justAfter = seasonAt(new Date("2026-11-15T00:01:00+05:30"));
    assert.deepEqual([justBefore.season, justBefore.toward], ["autumn", "prewinter"]);
    assert.deepEqual([justAfter.season, justAfter.toward], ["prewinter", "autumn"]);
    assert.ok(Math.abs(justBefore.blend - 0.5) < 0.01 && Math.abs(justAfter.blend - 0.5) < 0.01);
  });

  test("the year boundary sits inside pre-winter", () => {
    assert.deepEqual(seasonAt(india("2026-12-31")), { season: "prewinter", toward: "prewinter", blend: 0 });
    assert.equal(seasonAt(india("2027-01-12")).toward, "winter");
  });

  test("follows the date in India, not the visitor's", () => {
    assert.equal(seasonAt(new Date("2026-11-14T19:00:00Z")).season, "prewinter");
  });

  test("a season in the query string pins it", () => {
    assert.deepEqual(resolveSeason("?season=monsoon", india("2026-01-01")), { season: "monsoon", toward: "monsoon", blend: 0 });
    assert.equal(resolveSeason("?season=nope", india("2026-10-15")).season, "autumn");
  });
});

describe("boot script", () => {
  test("agrees with the calendar on every day of the year", () => {
    for (let day = 0; day < 366; day++) {
      const now = Date.UTC(2028, 0, 1, 6) + day * 86_400_000;
      assert.equal(boot("", now, null, false).season, seasonAt(new Date(now)).season, new Date(now).toISOString());
    }
  });

  test("theme: query, then stored choice, then system, then dark", () => {
    const now = Date.UTC(2026, 5, 1);
    assert.equal(boot("?theme=light", now, "dark", false).theme, "light");
    assert.equal(boot("", now, "light", false).theme, "light");
    assert.equal(boot("", now, null, true).theme, "light");
    assert.equal(boot("", now, "junk", false).theme, "dark");
    for (const season of SEASONS) assert.equal(boot(`?season=${season}`, now, null, false).season, season);
  });

  test("mode: query, then stored choice, then the site", () => {
    const now = Date.UTC(2026, 5, 1);
    assert.equal(boot("", now, null, false).mode, "site");
    assert.equal(boot("", now, null, false, "ai").mode, "ai");
    assert.equal(boot("?mode=site", now, null, false, "ai").mode, "site");
    assert.equal(boot("?mode=ai", now, null, false).mode, "ai");
    assert.equal(boot("", now, null, false, "junk").mode, "site");
  });
});
