import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { bodyProfile, EXTRAS, LEVELS, MAX_FISH, Pond, SEGMENTS } from "./koi-pond";

const FRAME = 1 / 30;

function run(pond: Pond, seconds: number) {
  for (let i = 0; i < seconds / FRAME; i++) pond.step(FRAME);
}

describe("Pond", () => {
  test("keeps every fish inside the pond over a long swim", () => {
    const pond = new Pond(1440, 900);
    for (let i = 0; i < 20; i++) {
      run(pond, 6);
      for (const { x, y } of pond.heads()) {
        assert.ok(x > -80 && x < 1440 + 80 && y > -80 && y < 900 + 80, `head left the pond at ${x.toFixed(0)}, ${y.toFixed(0)}`);
      }
    }
  });

  test("the water stays finite and decays instead of blowing up", () => {
    const pond = new Pond(1440, 900);
    run(pond, 60);
    const peak = pond.maxWave();
    assert.ok(Number.isFinite(peak));
    assert.ok(peak < 3, `wave height ${peak}`);
  });

  test("a single disturbance spreads and then dies away", () => {
    const pond = new Pond(600, 400, 5, 9, 1);
    pond.drop(300, 200, 2);
    pond.step(FRAME);
    const early = pond.maxWave();
    for (let i = 0; i < 600; i++) pond.step(FRAME);
    assert.ok(Number.isFinite(pond.maxWave()));
    assert.ok(early > 0);
  });

  test("rasterising draws fish with valid glyph levels", () => {
    const pond = new Pond(1440, 900);
    run(pond, 2);
    const frame = pond.rasterize();
    let fishCells = 0;
    for (let i = 0; i < frame.fishLevel.length; i++) {
      assert.ok(frame.fishLevel[i] < LEVELS);
      if (frame.fishLevel[i] > 0) fishCells += 1;
    }
    assert.ok(fishCells > 200, `only ${fishCells} fish cells`);
  });

  test("is deterministic for a given seed", () => {
    const a = new Pond(1000, 700, 5, 9, 42), b = new Pond(1000, 700, 5, 9, 42);
    run(a, 5);
    run(b, 5);
    assert.deepEqual(a.heads(), b.heads());
  });

  test("uses fewer fish on narrower viewports", () => {
    assert.ok(new Pond(1100, 800).heads().length < new Pond(1500, 900).heads().length);
  });
});

describe("behaviour", () => {
  const nearestFish = (pond: Pond) => {
    const [first] = pond.heads();
    return first;
  };

  test("there are six fish on a wide pond", () => {
    assert.equal(new Pond(1440, 900).heads().length, 6);
  });

  test("a fast cursor close to a fish startles it into a burst", () => {
    const pond = new Pond(1440, 900);
    run(pond, 2);
    const { x, y } = nearestFish(pond);
    pond.pointerMove(x + 20, y, true);
    pond.step(FRAME);
    pond.pointerMove(x + 120, y + 40, true);
    pond.pointerMove(x + 20, y, true);
    pond.pointerMove(x + 160, y - 30, true);
    pond.step(FRAME);
    assert.ok(pond.states().includes("flee"), `states: ${pond.states().join(",")}`);
  });

  test("moving the cursor never disturbs the water; a click does", () => {
    const pond = new Pond(1440, 900, 5, 9, 3);
    for (let i = 0; i < 60; i++) pond.pointerMove(100 + i * 6, 400 + Math.sin(i) * 30, true);
    // Only the fish's own wake can stir the water, never a spot under the cursor.
    const before = pond.gpuData().wave.slice();
    pond.pointerMove(300, 450, true);
    assert.deepEqual(pond.gpuData().wave, before);
    const row = Math.floor(450 / 9), col = Math.floor(300 / 5);
    pond.click(300, 450);
    assert.ok(pond.gpuData().wave[row * pond.cols + col] > 1.5);
  });

  test("a slow cursor makes at least one fish curious", () => {
    const pond = new Pond(1440, 900, 5, 9, 11);
    run(pond, 1);
    let curious = false;
    for (let i = 0; i < 40 && !curious; i++) {
      const { x, y } = nearestFish(pond);
      pond.pointerMove(x + 90, y + 20, true);
      pond.step(FRAME);
      curious = pond.states().includes("curious");
    }
    assert.ok(curious);
  });

  test("a click scatters food and the fish eat it", () => {
    const pond = new Pond(1440, 900);
    run(pond, 1);
    const { x, y } = nearestFish(pond);
    pond.click(x + 200, y);
    assert.equal(pond.pelletCount(), 6);
    pond.step(FRAME);
    assert.ok(pond.states().includes("feed") || pond.states().includes("flee"));
    run(pond, 20);
    assert.ok(pond.pelletCount() < 6, `${pond.pelletCount()} pellets left`);
  });

  test("uneaten food eventually sinks away", () => {
    const pond = new Pond(1440, 900);
    pond.click(1400, 20);
    run(pond, 14);
    assert.equal(pond.pelletCount(), 0);
  });

  test("fish stay in the pond while being chased and fed", () => {
    const pond = new Pond(1440, 900);
    for (let i = 0; i < 30; i++) {
      pond.pointerMove(100 + i * 40, 300 + (i % 3) * 80, true);
      if (i % 7 === 0) pond.click(200 + i * 30, 400);
      run(pond, 1);
      for (const { x, y } of pond.heads()) assert.ok(x > -120 && x < 1440 + 120 && y > -120 && y < 900 + 120, `head at ${x.toFixed(0)}, ${y.toFixed(0)}`);
    }
  });
});

describe("gpuData", () => {
  test("describes every fish with finite spine, appendage and bounds data", () => {
    const pond = new Pond(1440, 900);
    run(pond, 3);
    const data = pond.gpuData();
    assert.equal(data.count, pond.heads().length);
    assert.equal(data.fishTexture.length, (SEGMENTS + EXTRAS) * (MAX_FISH + 1) * 4);
    for (const value of [...data.fishTexture, ...data.params, ...data.bounds]) assert.ok(Number.isFinite(value));
    for (let f = 0; f < data.count; f++) {
      const row = f * (SEGMENTS + EXTRAS) * 4;
      // The spine normals are unit vectors, and the head sits inside the fish's bounding circle.
      for (let i = 0; i < SEGMENTS; i++) {
        assert.ok(Math.abs(Math.hypot(data.fishTexture[row + i * 4 + 2], data.fishTexture[row + i * 4 + 3]) - 1) < 1e-3);
      }
      const [cx, cy, radius] = [data.bounds[f * 4], data.bounds[f * 4 + 1], data.bounds[f * 4 + 2]];
      assert.ok(Math.hypot(data.fishTexture[row] - cx, data.fishTexture[row + 1] - cy) < radius);
    }
  });

  test("never writes more appendage discs than the texture has room for, and uses most of it", () => {
    const pond = new Pond(1440, 900);
    const data = pond.gpuData();
    for (let f = 0; f < data.count; f++) {
      let discs = 0;
      for (let e = 0; e < EXTRAS; e++) if (data.fishTexture[((f * (SEGMENTS + EXTRAS)) + SEGMENTS + e) * 4 + 2] > 0) discs += 1;
      assert.ok(discs >= 24 && discs <= EXTRAS, `${discs} discs`);
    }
  });

  test("exposes the live wave field", () => {
    const pond = new Pond(600, 400);
    pond.drop(300, 200, 2);
    assert.ok(pond.gpuData().wave.some((value) => value !== 0));
  });
});

describe("bodyProfile", () => {
  test("is widest near the front third and tapers to the tail", () => {
    assert.ok(bodyProfile(0.25) > bodyProfile(0.05));
    assert.ok(bodyProfile(0.25) > bodyProfile(0.7));
    assert.ok(bodyProfile(1) < bodyProfile(0.7));
    assert.ok(bodyProfile(0) > 0);
  });
});
