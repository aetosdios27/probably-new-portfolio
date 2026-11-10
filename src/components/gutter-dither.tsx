"use client";

import { useSyncExternalStore } from "react";
import Dither from "@/components/react-bits/dither";
import { atLightness } from "@/lib/color";
import type { DitherTheme } from "@/lib/dither-themes";
import { currentTheme, onThemeChange } from "@/lib/theme";
import styles from "./gutter-dither.module.css";

// The pattern colours glow on black. On paper the same hue is printed as ink: darker, a little
// more saturated, so the dots read as a deliberate halftone rather than a faded stain.
const INK_LIGHTNESS = 0.52;
const INK_CHROMA = 1.3;

// Two boxes outside the dashed rails, bounded above and below by the hatch
// bands. One WebGL context each; both pause when off-screen.
export function GutterDither({ theme }: { theme: DitherTheme }) {
  const light = useSyncExternalStore(onThemeChange, () => currentTheme() === "light", () => false);
  const shared = {
    ditherMode: theme.mode,
    waveColor: light ? atLightness(theme.color, INK_LIGHTNESS, INK_CHROMA) : theme.color,
    backgroundColor: "transparent",
    waveSpeed: theme.speed,
    waveAmplitude: theme.amplitude,
    mouseEffect: theme.mouseEffect,
    colorNum: 4,
    pixelSize: 3,
  } as const;
  return (
    <div className={styles.gutters} aria-hidden="true">
      <div className={`${styles.box} ${styles.left}`}><Dither {...shared} waveFrequency={theme.frequency} /></div>
      <div className={`${styles.box} ${styles.right}`}><Dither {...shared} waveFrequency={theme.frequency * 0.8} scale={1.15} /></div>
    </div>
  );
}
