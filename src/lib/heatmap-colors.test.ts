import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { assignColors, twinkleFor, type HeatmapCell } from "./heatmap-colors";

const grid: HeatmapCell[] = Array.from({ length: 53 * 7 }, (_, index) => {
  const column = Math.floor(index / 7) + 1, row = (index % 7) + 1;
  return { date: `2026-${String(column).padStart(2, "0")}-${row}`, column, row };
});

describe("assignColors", () => {
  test("is a pure function of the cells", () => {
    assert.deepEqual([...assignColors(grid, 6)], [...assignColors([...grid].reverse(), 6)]);
  });

  test("never gives a cell the colour of its left or upper neighbour", () => {
    const colors = assignColors(grid, 6);
    const at = (column: number, row: number) => colors.get(`2026-${String(column).padStart(2, "0")}-${row}`)!;
    for (const { column, row } of grid) {
      if (column > 1) assert.notEqual(at(column, row), at(column - 1, row));
      if (row > 1) assert.notEqual(at(column, row), at(column, row - 1));
    }
  });

  test("uses every colour in the palette", () => {
    assert.equal(new Set(assignColors(grid, 6).values()).size, 6);
  });

  test("stays within the palette", () => {
    for (const color of assignColors(grid, 6).values()) assert.ok(color >= 0 && color < 6);
  });
});

describe("twinkleFor", () => {
  const dates = grid.map(({ date }) => date);

  test("is deterministic per date", () => {
    assert.deepEqual(twinkleFor("2026-05-04"), twinkleFor("2026-05-04"));
  });

  test("keeps every cell inside the intended ranges", () => {
    for (const date of dates) {
      const { period, delay, jitter } = twinkleFor(date);
      assert.ok(period >= 5 && period <= 11, `period ${period}`);
      assert.ok(delay <= 0 && delay >= -period, `delay ${delay}`);
      assert.ok(jitter >= 0.85 && jitter <= 1, `jitter ${jitter}`);
    }
  });

  test("never moves in lockstep: periods and starting points are spread out", () => {
    const periods = dates.map((date) => Math.round(twinkleFor(date).period));
    const starts = dates.map((date) => Math.round((twinkleFor(date).delay / twinkleFor(date).period) * 10));
    assert.ok(new Set(periods).size >= 6);
    assert.ok(new Set(starts).size >= 8);
  });
});
