"use client";

import { useEffect, useState } from "react";
import type { Activity } from "react-github-calendar";
import styles from "./github-activity.module.css";

const dayMilliseconds = 86_400_000;

export function GitHubActivity() {
  const [days, setDays] = useState<Activity[]>([]);

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
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <section className={styles.section} aria-labelledby="activity-heading">
      <div className={styles.heading}>
        <h2 id="activity-heading">A little, often.</h2>
      </div>
      <div className={styles.calendar} tabIndex={0} role="region" aria-label="GitHub contribution calendar; scroll horizontally to explore the last year">
        <div className={styles.graph}>
          <div className={styles.months} aria-hidden="true">
            {months.map((month, index) => <span key={index} style={{ gridColumn: `${month.column} / span 3` }}>{month.label}</span>)}
          </div>
          <div className={styles.cells} role="img" aria-label={days.length ? `${total} contributions in the last year` : "GitHub contribution calendar loading"}>
            {cells.map((day) => <span key={day.date} className={styles.cell} data-level={day.level} style={{ gridColumn: day.column, gridRow: day.row }} title={`${day.count} contributions on ${day.date}`} />)}
          </div>
        </div>
      </div>
      {days.length > 0 && <p className={styles.caption}>{total} contributions in the last year</p>}
    </section>
  );
}
