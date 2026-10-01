import calendar from "@/content/contributions.json";

export type ContributionDay = { date: string; contributionCount: number; contributionLevel: string };
export type ContributionCalendar = { totalContributions: number; weeks: { contributionDays: ContributionDay[] }[] };

const levels: Record<string, number> = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

// Presentation-only integration point: replace the data source or port a supplied
// legacy component here. No runtime token or fabricated activity is required.
export function ContributionHeatmap({ data = calendar }: { data?: ContributionCalendar }) {
  const start = data.weeks[0]?.contributionDays[0]?.date;
  const end = data.weeks.at(-1)?.contributionDays.at(-1)?.date;
  const format = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <section className="activity-section" aria-labelledby="activity-heading">
      <div className="activity-header">
        <h2 id="activity-heading">A little, often.</h2>
        <a className="text-link" href="https://github.com/aetosdios27">On GitHub</a>
      </div>
      <figure className="contribution-figure">
        <div className="heatmap-scroll" tabIndex={0} aria-label="Contribution calendar; scroll horizontally to see all weeks">
          <div className="heatmap" role="img" aria-label={`${data.totalContributions.toLocaleString()} GitHub contributions, ${start && format(start)} to ${end && format(end)}. Activity snapshot captured ${calendar.capturedAt}.`}>
            {data.weeks.map((week, index) => (
              <div className="heatmap-week" key={index}>
                {week.contributionDays.map((day) => (
                  <span key={day.date} className="heatmap-cell" data-level={levels[day.contributionLevel] ?? 0} title={`${day.date}: ${day.contributionCount} contributions`} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <figcaption>
          <span>{data.totalContributions.toLocaleString()} contributions <span className="activity-period">· {start && format(start)} — {end && format(end)}</span></span>
          <span className="heatmap-legend" aria-label="Less to more activity">Less {[0, 1, 2, 3, 4].map(level => <span key={level} className="heatmap-cell" data-level={level} aria-hidden="true" />)} More</span>
        </figcaption>
      </figure>
      <p className="snapshot-note">Activity snapshot · {calendar.capturedAt}</p>
    </section>
  );
}
