// The site or AI mode. AI mode takes every flourish away and shows the site as plain markdown. The
// boot script (boot-script.ts) writes `data-mode` on <html> before first paint; everything else reads
// it from there, like the theme.

export const MODES = ["site", "ai"] as const;
export type Mode = (typeof MODES)[number];
export const MODE_STORAGE_KEY = "aetos:mode";

export function isMode(value: unknown): value is Mode {
  return value === "site" || value === "ai";
}

export function currentMode(): Mode {
  const value = document.documentElement.dataset.mode;
  return isMode(value) ? value : "site";
}

export function setMode(mode: Mode) {
  document.documentElement.dataset.mode = mode;
  try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch {}
}

/** Calls back whenever `data-mode` changes. Returns the unsubscribe. */
export function onModeChange(listener: (mode: Mode) => void) {
  const observer = new MutationObserver(() => listener(currentMode()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  return () => observer.disconnect();
}
