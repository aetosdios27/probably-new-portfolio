"use client";

import { useEffect, useSyncExternalStore } from "react";
import { LuMoon, LuSun } from "react-icons/lu";
import { DockIcon, DockItem, DockLabel } from "./ui/dock";
import { dockTick, hoverCancel, hoverIntent } from "@/lib/hover-sound";
import { currentTheme, followSystemTheme, onThemeChange, setTheme, THEME_BACKGROUND, type Theme } from "@/lib/theme";
import styles from "./theme-toggle.module.css";

function paintBrowserChrome(theme: Theme) {
  // Next renders one theme-color per system scheme; a chosen theme overrides both.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute("content", THEME_BACKGROUND[theme]);
}

function switchTheme(next: Theme) {
  const instant = !document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (instant) setTheme(next);
  // A newer toggle skips the running transition; its update has already applied, so nothing is lost.
  else document.startViewTransition(() => setTheme(next)).finished.catch(() => {});
}

// The icon and tooltip name the theme a press switches to, and both come from CSS on html[data-theme],
// so the first paint is right before React knows the theme. Only the switch state waits for hydration.
export function ThemeToggle({ index }: { index: number }) {
  const light = useSyncExternalStore(onThemeChange, () => currentTheme() === "light", () => false);
  const key = `dock-${index}`;

  useEffect(() => {
    paintBrowserChrome(currentTheme());
    const stopPainting = onThemeChange(paintBrowserChrome);
    const stopFollowing = followSystemTheme();
    return () => {
      stopPainting();
      stopFollowing();
    };
  }, []);

  return (
    <DockItem className="aspect-square" role="switch" aria-label="Light theme" aria-checked={light} data-cuelume-tap=""
      onHover={() => hoverIntent(key, () => dockTick(index))}
      onHoverEnd={() => hoverCancel(key)}
      onClick={() => switchTheme(currentTheme() === "light" ? "dark" : "light")}>
      <DockLabel><span className={styles.toLight}>Light</span><span className={styles.toDark}>Dark</span></DockLabel>
      <DockIcon>
        <span className={styles.icons} aria-hidden="true">
          <LuSun className={styles.sun} />
          <LuMoon className={styles.moon} />
        </span>
      </DockIcon>
    </DockItem>
  );
}
