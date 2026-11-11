import type { Pulse } from "./koi-renderer";
import { currentMode, setMode, type Mode } from "./mode";

// Switching between the site and AI mode is a pulse from the control that was pressed. Its front is
// one registered CSS length, --pulse-r, animated on <html>; everything that changes reads it, so the
// pond (in its shader), the rails, bands and dock (masks), the markdown (a second, trailing front,
// --reveal-r) and the visible ring all move together on the browser's own clock.
//
// Into AI mode: the pulse takes the pond and the frame's flourishes away, leaving the plain page; the
// trailing front then turns that page into its markdown. Out of it: the markdown opens from the exit
// control first, and the pulse brings the pond back behind it.

// Slow enough to watch the pond come apart, and for the plain page to show before the text arrives.
// A gentle ease-out: a pulse leaves fast and loses energy as it spreads.
const PULSE_MS = 1400;
const TRAIL_MS = 1250;
const TRAIL_DELAY_MS = 550;
const EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

type Point = { x: number; y: number };
type Active = Point & { reach: number; direction: 1 | -1; animations: Animation[] };
let active: Active | null = null;

const root = () => document.documentElement;
const DECOR = 'main#main > [aria-hidden="true"]:not(canvas), [data-site-dock] nav';

/** The pulse now, for the pond to draw, or null when nothing is switching. */
export function currentPulse(): Pulse | null {
  if (!active) return null;
  const style = getComputedStyle(root());
  const radius = parseFloat(style.getPropertyValue("--pulse-r")) || 0;
  const trail = parseFloat(style.getPropertyValue("--reveal-r")) || 0;
  return { x: active.x, y: active.y, radius, reach: active.reach, direction: active.direction, trail };
}

export function centerOf(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function farthestCorner({ x, y }: Point) {
  return Math.max(Math.hypot(x, y), Math.hypot(innerWidth - x, y), Math.hypot(x, innerHeight - y), Math.hypot(innerWidth - x, innerHeight - y));
}

// The masks on the flourishes are in each element's own coordinates, so each learns where the
// origin is relative to itself.
function stampDecor(origin: Point) {
  for (const element of document.querySelectorAll<HTMLElement>(DECOR)) {
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--ox", `${origin.x - rect.left}px`);
    element.style.setProperty("--oy", `${origin.y - rect.top}px`);
    element.dataset.pulseDecor = "";
  }
}

function finish() {
  if (!active) return;
  for (const animation of active.animations) animation.cancel();
  for (const element of document.querySelectorAll<HTMLElement>("[data-pulse-decor]")) {
    delete element.dataset.pulseDecor;
    element.style.removeProperty("--ox");
    element.style.removeProperty("--oy");
  }
  delete root().dataset.transition;
  active = null;
}

function still() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches || typeof root().animate !== "function";
}

function run(next: Mode, origin: Point) {
  finish();
  if (still()) {
    setMode(next);
    scrollTo(0, 0);
    return;
  }
  const html = root();
  const reach = farthestCorner(origin) + 220;
  const direction = next === "ai" ? 1 : -1;
  const view = document.querySelector<HTMLElement>(".agent-view");
  html.style.setProperty("--pulse-x", `${origin.x}px`);
  html.style.setProperty("--pulse-y", `${origin.y}px`);

  if (next === "site") {
    // The markdown becomes an overlay at the same scroll position, the site appears beneath it.
    const scrolled = scrollY;
    html.dataset.transition = "to-site";
    if (view) view.scrollTop = scrolled;
    setMode("site");
    scrollTo(0, 0);
  } else {
    html.dataset.transition = "to-ai";
    if (view) view.scrollTop = 0;
  }
  stampDecor(origin);

  const timing = (delay: number, duration: number): KeyframeAnimationOptions => ({ duration, delay, easing: EASE, fill: "forwards" });
  const pulse = html.animate({ "--pulse-r": ["0px", `${reach}px`] }, timing(next === "ai" ? 0 : TRAIL_DELAY_MS, PULSE_MS));
  const trail = html.animate({ "--reveal-r": ["0px", `${reach}px`] }, timing(next === "ai" ? TRAIL_DELAY_MS : 0, TRAIL_MS));
  const state: Active = { ...origin, reach, direction, animations: [pulse, trail] };
  active = state;

  Promise.all(state.animations.map((animation) => animation.finished)).then(() => {
    if (active !== state) return;
    if (next === "ai") {
      setMode("ai");
      scrollTo(0, 0);
    }
    finish();
  }, () => {});
}

export function enterAiMode(origin: Point) {
  if (currentMode() === "ai" && !active) return;
  run("ai", origin);
}

export function exitAiMode(origin: Point) {
  if (currentMode() === "site" && !active) return;
  run("site", origin);
}
