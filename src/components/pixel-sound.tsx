import styles from "./pixel-sound.module.css";

// An 11 x 11 pixel speaker. Each entry is a column and the rows it fills; the speaker is static, the
// two sound waves pulse in steps while sound is on, and a muted speaker swaps them for a cross.
const SPEAKER: [number, number, number][] = [
  [0, 3, 7], [1, 3, 7], [2, 3, 7], [3, 2, 8], [4, 1, 9], [5, 0, 10],
];
const WAVES: [number, number, number, number][] = [
  [7, 3, 7, 1],
  [9, 1, 9, 2],
];
const CROSS: [number, number][] = [
  [7, 3], [11, 3], [8, 4], [10, 4], [9, 5], [8, 6], [10, 6], [7, 7], [11, 7],
];

export function PixelSound({ on, className = "" }: { on: boolean; className?: string }) {
  return (
    <svg className={`${styles.icon} ${className}`.trim()} viewBox="0 0 12 11" width="24" height="22" aria-hidden="true" focusable="false">
      {SPEAKER.map(([x, from, to]) => <rect key={x} x={x} y={from} width="1" height={to - from + 1} />)}
      {on
        ? WAVES.map(([x, from, to, step]) => <rect key={x} className={styles.wave} data-step={step} x={x} y={from} width="1" height={to - from + 1} />)
        : CROSS.map(([x, y]) => <rect key={`${x}-${y}`} className={styles.cross} x={x} y={y} width="1" height="1" />)}
    </svg>
  );
}
