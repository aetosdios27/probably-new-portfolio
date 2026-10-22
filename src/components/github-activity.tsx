"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type AnimationEvent, type CSSProperties, type PointerEvent } from "react";
import type { Activity } from "react-github-calendar";
import { VIVID_ACCENT_COLORS } from "@/lib/accent-palette";
import { assignColors, twinkleFor } from "@/lib/heatmap-colors";
import { hoverCancel, hoverIntent, isUnlocked, starNote, subscribeUnlocked } from "@/lib/hover-sound";
import { soundEnabled, subscribeSound } from "@/lib/sound";
import styles from "./github-activity.module.css";

const dayMilliseconds = 86_400_000;
const paletteVars = Object.fromEntries(VIVID_ACCENT_COLORS.map((color, index) => [`--c${index}`, color])) as CSSProperties;

export function GitHubActivity() {
  const [days, setDays] = useState<Activity[]>([]);
  const grid = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const unlocked = useSyncExternalStore(subscribeUnlocked, isUnlocked, () => false);
  const soundOn = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  // Browsers keep a page silent until the first click or key press, so say so, briefly, until then.
  const hint = !days.length || !soundOn ? null : unlocked ? "psst, hover the squares. they ring." : "psst, click anywhere, then hover the squares.";

  // Animate only while the grid is on screen and the tab is visible.
  useEffect(() => {
    const node = grid.current;
    if (!node) return;
    let onScreen = false;
    const sync = () => setPlaying(onScreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); });
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  // Each cell's colour layer is fully transparent at the end of its own cycle, so that is
  // when it moves on to a different palette colour: never visibly, never in step with others.
  function nextColor(event: AnimationEvent<HTMLDivElement>) {
    const cell = event.target;
    if (!(cell instanceof HTMLElement) || cell === event.currentTarget) return;
    const current = Number(cell.dataset.color);
    const choices = VIVID_ACCENT_COLORS.map((_, index) => index).filter((index) => index !== current);
    const next = choices[Math.floor(Math.random() * choices.length)];
    cell.dataset.color = String(next);
    cell.style.setProperty("--base", `var(--c${next})`);
  }

  // Active days ring like a small bell when the pointer rests on them. One handler on the grid covers
  // every cell; quiet days stay silent.
  function activeCell(event: PointerEvent<HTMLDivElement>) {
    const cell = event.target;
    if (event.pointerType !== "mouse" || !(cell instanceof HTMLElement) || !cell.dataset.date || cell.dataset.level === "0") return null;
    return cell;
  }
  function ringCell(event: PointerEvent<HTMLDivElement>) {
    const cell = activeCell(event);
    if (!cell) return;
    const seed = [...cell.dataset.date!].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    hoverIntent(`star-${cell.dataset.date}`, () => starNote(Number(cell.dataset.level), seed));
  }
  function quietCell(event: PointerEvent<HTMLDivElement>) {
    const cell = event.target;
    if (cell instanceof HTMLElement && cell.dataset.date) hoverCancel(`star-${cell.dataset.date}`);
  }

  useEffect(() => {
    const controller = new AbortController();
    // Same public data source used by react-github-calendar; only presentation
    // changes from its fixed-width SVG to a responsive, week-indexed grid.
    fetch("https://github-contributions-api.jogruber.de/v4/aetosdios27?y=last&client=react-github-calendar", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Contribution request failed");
        return response.json();
      })
      .then((data: { contributions: Activity[] }) => {
        if (!controller.signal.aborted) setDays(data.contributions);
      })
      .catch(() => { /* Keep the reserved graph space on network failure. */ });
    return () => controller.abort();
  }, []);

  const first = days[0] ? new Date(`${days[0].date}T00:00:00Z`) : null;
  const start = first ? first.getTime() - first.getUTCDay() * dayMilliseconds : 0;
  const lastWeek = days.length ? Math.floor((Date.parse(days.at(-1)!.date) - start) / (7 * dayMilliseconds)) : 52;
  const firstWeek = Math.max(0, lastWeek - 52);
  const cells = days.flatMap((day) => {
    const date = new Date(`${day.date}T00:00:00Z`);
    const column = Math.floor((date.getTime() - start) / (7 * dayMilliseconds)) - firstWeek + 1;
    if (column < 1 || column > 53) return [];
    return [{ ...day, column, row: date.getUTCDay() + 1 }];
  });
  const months = cells.flatMap((day, index) => {
    if (day.column > 51 || (index > 0 && day.date.slice(0, 7) === cells[index - 1].date.slice(0, 7))) return [];
    return [{ label: new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), column: day.column }];
  });
  const colors = assignColors(cells, VIVID_ACCENT_COLORS.length);
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <section className={styles.section} aria-labelledby="activity-heading">
      <div className={styles.heading}>
        <h2 id="activity-heading">A little, often.</h2>
        {hint && <p className={styles.hint}>{hint}</p>}
      </div>
      <div className={styles.calendar} tabIndex={0} role="region" aria-label="GitHub contribution calendar; scroll horizontally to explore the last year">
        <div className={styles.graph}>
          <div className={styles.months} aria-hidden="true">
            {months.map((month, index) => <span key={index} style={{ gridColumn: `${month.column} / span 3` }}>{month.label}</span>)}
          </div>
          <div ref={grid} className={styles.cells} style={paletteVars} data-playing={playing} onAnimationIteration={nextColor} onPointerOver={ringCell} onPointerOut={quietCell} role="img" aria-label={days.length ? `${total} contributions in the last year` : "GitHub contribution calendar loading"}>
            {cells.map((day) => {
              const start = colors.get(day.date) ?? 0;
              const twinkle = twinkleFor(day.date);
              const style = {
                gridColumn: day.column,
                gridRow: day.row,
                "--period": `${twinkle.period.toFixed(2)}s`,
                "--delay": `${twinkle.delay.toFixed(2)}s`,
                "--jitter": twinkle.jitter.toFixed(2),
                "--base": `var(--c${start})`,
              } as CSSProperties;
              return <span key={day.date} className={styles.cell} data-date={day.date} data-level={day.level} data-color={start} style={style} title={`${day.count} contributions on ${day.date}`} />;
            })}
          </div>
        </div>
      </div>
      {days.length > 0 && <p className={styles.caption}>{total} contributions in the last year</p>}
    </section>
  );
}
