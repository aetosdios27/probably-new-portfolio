// Light and dark. The boot script (boot-script.ts) writes `data-theme` on <html> before first
// paint; everything else reads it from there, so CSS, the pond and the toggle can never disagree.

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_STORAGE_KEY = "aetos:theme";
/** Page background per theme, for the browser chrome (`theme-color`). Mirrors --background. */
export const THEME_BACKGROUND: Record<Theme, string> = { dark: "#000000", light: "#f5f2ea" };

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

export function currentTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return isTheme(value) ? value : "dark";
}

/** Applies a theme and remembers it. Storage can be unavailable (private windows); the theme still applies. */
export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
}

/** Calls back whenever `data-theme` changes, whoever changed it. Returns the unsubscribe. */
export function onThemeChange(listener: (theme: Theme) => void) {
  const observer = new MutationObserver(() => listener(currentTheme()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
