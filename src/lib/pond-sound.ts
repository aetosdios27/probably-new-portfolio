import { soundEnabled } from "./sound";
import { audio, bloop, splash } from "./synth";

// The pond's own voice: a food drop landing on water, and the quiet gulp of a koi taking a pellet. Both
// share the site's sound switch and volume. A click makes one plop plus a short sprinkle of plips for the
// scattered food, limited to one every 180 ms; each pellet eaten makes one soft gulp, at most one every
// 300 ms.

let lastGulp = 0;
let lastPlop = 0;

/** Food dropped on the pond. */
export function plop() {
  if (!soundEnabled()) return;
  const stamp = performance.now();
  if (stamp - lastPlop < 180) return;
  lastPlop = stamp;
  const v = audio();
  if (!v) return;
  const now = v.ctx.currentTime;
  const pitch = 0.9 + Math.random() * 0.2;
  splash(v, now, 0.18);
  bloop(v, now, 340 * pitch, 880 * pitch, 0.5, 0.26);
  bloop(v, now + 0.11, 300 * pitch, 640 * pitch, 0.16, 0.2);
  for (let i = 0; i < 4; i++) {
    const at = now + 0.09 + Math.random() * 0.3;
    const high = (1100 + Math.random() * 700) * pitch;
    bloop(v, at, high * 0.7, high, 0.07 + Math.random() * 0.05, 0.09);
  }
}

/** A koi taking a pellet. */
export function gulp() {
  if (!soundEnabled()) return;
  const stamp = performance.now();
  if (stamp - lastGulp < 300) return;
  lastGulp = stamp;
  const v = audio();
  if (!v) return;
  const pitch = 0.85 + Math.random() * 0.3;
  bloop(v, v.ctx.currentTime, 260 * pitch, 420 * pitch, 0.12, 0.11);
}
