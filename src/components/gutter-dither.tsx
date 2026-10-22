import Dither from "@/components/react-bits/dither";
import type { DitherTheme } from "@/lib/dither-themes";
import styles from "./gutter-dither.module.css";

// Two boxes outside the dashed rails, bounded above and below by the hatch
// bands. One WebGL context each; both pause when off-screen.
export function GutterDither({ theme }: { theme: DitherTheme }) {
  const shared = {
    ditherMode: theme.mode,
    waveColor: theme.color,
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
