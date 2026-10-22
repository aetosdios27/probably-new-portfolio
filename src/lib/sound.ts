import { play, setEnabled, setVolume, unlock, type PlayOptions, type SoundName } from "cuelume";

const STORAGE_KEY = "aetos:sound";
const VOLUME = 0.55;

type Listener = () => void;
const listeners = new Set<Listener>();
let enabled = true;
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    enabled = localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    enabled = true;
  }
  setEnabled(enabled);
  setVolume(VOLUME);
}

export function subscribeSound(listener: Listener) {
  load();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function soundVolume() {
  return VOLUME;
}

export function soundEnabled() {
  load();
  return enabled;
}

/** Sound is on by default and only ever starts after the visitor has interacted with the page. */
export function setSoundEnabled(next: boolean) {
  load();
  enabled = next;
  setEnabled(next);
  try {
    localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    // Storage can be unavailable; the choice then lasts for the session.
  }
  if (next) void unlock();
  listeners.forEach((listener) => listener());
}

const lastPlayed = new Map<string, number>();

/** Plays one cue, at most once per `gap` ms per key, so busy moments never stack into noise. */
export function cue(name: SoundName, options: PlayOptions = {}, key: string = name, gap = 120) {
  load();
  const now = performance.now();
  if (now - (lastPlayed.get(key) ?? -Infinity) < gap) return;
  lastPlayed.set(key, now);
  play(name, options);
}

/** Flips sound on or off; turning it on confirms itself with one quiet cue. */
export function toggleSound() {
  const next = !soundEnabled();
  setSoundEnabled(next);
  if (next) cue("toggle", { emphasis: "subtle" }, "sound-toggle", 0);
}
