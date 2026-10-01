"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import styles from "./playground-link.module.css";

const WORD = "Playground";
const TRAIL_LENGTH = 5;
// Luminous, slightly softened colors for the near-black canvas. Randomize
// only on entry so a held letter keeps its color instead of flickering.
const COLORS = ["#B6CE8A", "#E7A6BC", "#EDBA8B", "#E5D7AE", "#91C9DB", "#B9ABDF"];
// Proportional pixel glyphs: narrow letters keep their own shapes rather than
// stretching a monospaced font into Inter's differently sized letter cells.
const GLYPHS: Record<string, string[]> = {
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  l: ["10", "10", "10", "10", "10", "10", "11"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  y: ["00000", "00000", "10001", "10001", "10001", "10001", "01111", "00001", "01110"],
  g: ["00000", "00000", "01111", "10001", "10001", "10001", "01111", "00001", "01110"],
  r: ["000", "000", "110", "101", "100", "100", "100"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10001", "01111"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
};

export function PlaygroundLink() {
  const [colors, setColors] = useState(() => [...WORD].map((_, index) => COLORS[index % COLORS.length]));
  const [trail, setTrail] = useState<number[]>([]);
  const catchUpTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function cancelCatchUp() {
    catchUpTimers.current.forEach(clearTimeout);
    catchUpTimers.current = [];
  }

  function clearTrail() {
    cancelCatchUp();
    setTrail([]);
  }

  useEffect(() => () => {
    catchUpTimers.current.forEach(clearTimeout);
  }, []);

  function recolor(index: number) {
    cancelCatchUp();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTrail((current) => reducedMotion ? [index] : [...current.filter((letter) => letter !== index), index].slice(-TRAIL_LENGTH));
    if (!reducedMotion) {
      // Each pause lets the tail catch up, oldest first. Resuming movement
      // cancels these deadlines so stale timers cannot erase a fresh trail.
      catchUpTimers.current = Array.from({ length: TRAIL_LENGTH - 1 }, (_, step) =>
        setTimeout(() => setTrail((current) => current.slice(-(TRAIL_LENGTH - 1 - step))), 180 + step * 120),
      );
    }
    setColors((current) => {
      const choices = COLORS.filter((color) => color !== current[index]);
      const next = [...current];
      next[index] = choices[Math.floor(Math.random() * choices.length)];
      return next;
    });
  }

  return (
    <Link
      href="/#playground-heading"
      className={styles.link}
      aria-label="Playground"
      onPointerLeave={clearTrail}
      onPointerCancel={clearTrail}
      onBlur={clearTrail}
    >
      {[...WORD].map((letter, index) => {
        const rows = GLYPHS[letter];
        const width = rows[0].length;
        return (
          <span
            key={index}
            className={styles.letter}
            data-active={trail.includes(index)}
            aria-hidden="true"
            style={{ "--pixel-color": colors[index] } as CSSProperties}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse" || event.pointerType === "pen") recolor(index);
            }}
          >
            <span className={styles.normal}>{letter}</span>
            <svg
              className={styles.pixel}
              viewBox={`0 0 ${width} 9`}
              width={width * 1.25}
              height={11.25}
              focusable="false"
            >
              {rows.flatMap((row, y) => [...row].flatMap((pixel, x) =>
                pixel === "1" ? [<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />] : [],
              ))}
            </svg>
          </span>
        );
      })}
    </Link>
  );
}
