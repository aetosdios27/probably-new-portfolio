import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { LOOK_COLORS, LOOK_SCALARS, LOOKS, mixLooks, type LookScalar, type PondLook } from "./pond-looks";
import { SEASONS } from "./season";
import { THEMES } from "./theme";

const SCALARS = Object.entries(LOOK_SCALARS) as [LookScalar, readonly [number, number]][];
const ALL: [string, PondLook][] = SEASONS.flatMap((season) => THEMES.map((theme): [string, PondLook] => [`${season} ${theme}`, LOOKS[season][theme]]));

function assertInRange(name: string, look: PondLook) {
  for (const [key, [min, max]] of SCALARS) {
    assert.ok(Number.isFinite(look[key]) && look[key] >= min && look[key] <= max, `${name}.${key} = ${look[key]} is outside ${min}..${max}`);
  }
  for (const key of LOOK_COLORS) {
    assert.equal(look[key].length, 3, `${name}.${key}`);
    for (const channel of look[key]) assert.ok(Number.isFinite(channel) && channel >= 0 && channel <= 1, `${name}.${key} has channel ${channel}`);
  }
}

describe("pond looks", () => {
  test("there are twelve: six seasons by night and by day", () => {
    assert.equal(ALL.length, 12);
    assert.equal(new Set(ALL.map(([, look]) => JSON.stringify(look))).size, 12);
  });

  test("every field of every look is finite and in range, with no stray fields", () => {
    const expected = [...Object.keys(LOOK_SCALARS), ...LOOK_COLORS].sort();
    for (const [name, look] of ALL) {
      assert.deepEqual(Object.keys(look).sort(), expected, name);
      assertInRange(name, look);
    }
  });

  test("a koi sits on black at night, so the dark theme is unchanged beneath the fish", () => {
    for (const season of SEASONS) assert.deepEqual(LOOKS[season].dark.koiBed, [0, 0, 0]);
  });

  test("it rains in the monsoon and the koi slow down in the cold", () => {
    for (const theme of THEMES) {
      assert.ok(LOOKS.monsoon[theme].rain > 0);
      assert.equal(LOOKS.summer[theme].rain, 0);
      assert.ok(LOOKS.winter[theme].koiPace < LOOKS.prewinter[theme].koiPace);
      assert.ok(LOOKS.prewinter[theme].koiPace < LOOKS.summer[theme].koiPace);
    }
  });
});

describe("mixLooks", () => {
  const a = LOOKS.monsoon.dark, b = LOOKS.winter.light;

  test("returns the endpoints at 0 and 1", () => {
    assert.deepEqual(mixLooks(a, b, 0), a);
    assert.deepEqual(mixLooks(a, b, 1), b);
    assert.deepEqual(mixLooks(a, b, -0.5), a);
    assert.deepEqual(mixLooks(a, b, 1.5), b);
  });

  test("is halfway on every field at 0.5", () => {
    const mid = mixLooks(a, b, 0.5);
    for (const [key] of SCALARS) assert.ok(Math.abs(mid[key] - (a[key] + b[key]) / 2) < 1e-12, key);
    for (const key of LOOK_COLORS) {
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(mid[key][i] - (a[key][i] + b[key][i]) / 2) < 1e-12, key);
    }
  });

  test("stays in range anywhere between any two looks", () => {
    for (const [nameA, lookA] of ALL) {
      for (const [nameB, lookB] of ALL) {
        for (const t of [0.25, 0.5, 0.75]) assertInRange(`${nameA} > ${nameB} @ ${t}`, mixLooks(lookA, lookB, t));
      }
    }
  });

  test("does not alias its inputs", () => {
    const mid = mixLooks(a, b, 0.5);
    assert.notEqual(mid.bedLow, a.bedLow);
    assert.notEqual(mid.bedLow, b.bedLow);
  });
});
