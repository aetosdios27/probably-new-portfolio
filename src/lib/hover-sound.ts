import { soundEnabled } from "./sound";
import { audio, bloop, chip, ping } from "./synth";

// Hover is the easiest place to make a site noisy, so it is held to strict rules. Only a few things that
// feel like physical objects make hover sounds: the dock, the contribution squares, a locked link and the
// Playground word and the name reveal. A hover only counts after the pointer has rested on the thing for a moment, so flicking
// across the screen is silent; nothing sounds until the visitor has clicked or pressed a key once; only a
// mouse with real hover counts; the whole site gets at most one hover sound every 80 ms; and the same
// thing will not sound again for half a second.

const DWELL = 60;
const SITE_GAP = 80;
const REENTRY = 500;

let interacted = false;
let lastAny = 0;
const unlockListeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const lastByKey = new Map<string, number>();

if (typeof window !== "undefined") {
  // Browsers only let a page make sound after a click or key press (moving the mouse does not count), so the
  // first one switches hover sounds on. The UI can show a hint until that has happened.
  const mark = () => {
    interacted = true;
    unlockListeners.forEach((listener) => listener());
  };
  addEventListener("pointerdown", mark, { once: true, capture: true, passive: true });
  addEventListener("keydown", mark, { once: true, capture: true, passive: true });
}

export function subscribeUnlocked(listener: () => void) {
  unlockListeners.add(listener);
  return () => { unlockListeners.delete(listener); };
}

/** Whether the visitor has clicked or pressed a key yet, which is what lets the page make sound. */
export function isUnlocked() {
  return interacted;
}

function allowed() {
  return interacted && soundEnabled() && matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Plays `sound` if the pointer is still on `key` after the dwell time and every rule above holds. */
export function hoverIntent(key: string, sound: () => void) {
  if (!allowed()) return;
  if (performance.now() - (lastByKey.get(key) ?? -Infinity) < REENTRY) return;
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    const now = performance.now();
    if (now - lastAny < SITE_GAP) return;
    lastAny = now;
    lastByKey.set(key, now);
    sound();
  }, DWELL));
}

/** The pointer left before the dwell time passed. */
export function hoverCancel(key: string) {
  clearTimeout(timers.get(key));
  timers.delete(key);
}

/** A dock icon: a small glass tick that rises a whole tone for each icon along the dock. */
export function dockTick(index: number) {
  const v = audio();
  if (v) ping(v, v.ctx.currentTime, 1318.5 * 2 ** ((index * 2) / 12), 0.07, 0.11);
}

// A pentatonic scale, so any run of notes sounds consonant however the pointer wanders.
const PENTATONIC = [0, 2, 4, 7, 9];

/** A contribution square: a soft bell whose pitch follows how active the day was. */
export function starNote(level: number, seed: number) {
  const v = audio();
  if (!v) return;
  const degree = (level * 2 + (seed % 3)) % 10;
  const semitones = PENTATONIC[degree % 5] + 12 * Math.floor(degree / 5);
  ping(v, v.ctx.currentTime, 659.25 * 2 ** (semitones / 12), 0.05, 0.45, 2);
}

/** A link that is not live yet: a low, muffled knock. */
export function lockedKnock() {
  const v = audio();
  if (!v) return;
  const now = v.ctx.currentTime;
  bloop(v, now, 175, 92, 0.2, 0.14);
  bloop(v, now + 0.005, 330, 160, 0.05, 0.06);
}

/** The Playground word: three rising pixel blips, the same step as the letters turning to pixels. */
export function playgroundBlips() {
  const v = audio();
  if (!v) return;
  const now = v.ctx.currentTime;
  [1046.5, 1318.5, 1568].forEach((freq, i) => chip(v, now + i * 0.05, freq, 0.035, 0.05));
}

/** The name resolves: a soft upward glide landing on a quiet glass note. */
export function nameReveal() {
  if (!soundEnabled()) return;
  const v = audio();
  if (!v) return;
  const now = v.ctx.currentTime;
  bloop(v, now, 440, 659.25, 0.035, 0.13);
  ping(v, now + 0.07, 880, 0.025, 0.17, 2);
}
