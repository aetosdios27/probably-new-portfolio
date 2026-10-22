import { FaGithub } from "react-icons/fa6";
import { LuGitCommitHorizontal, LuGitMerge, LuGitPullRequest, LuGitPullRequestClosed } from "react-icons/lu";
import type { ActivityItem } from "@/lib/repo-activity";
import { LinkLabel } from "./editorial-link";
import { IconLink } from "./icon-link";
import editorialStyles from "./editorial-link.module.css";
import styles from "./repo-activity.module.css";

const GLYPHS = { commit: LuGitCommitHorizontal, merged: LuGitMerge, open: LuGitPullRequest, closed: LuGitPullRequestClosed };

function formatDate(value: string) {
  const date = new Date(value);
  const sameYear = date.getUTCFullYear() === new Date().getUTCFullYear();
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return sameYear ? day : `${day} ’${String(date.getUTCFullYear()).slice(2)}`;
}

export function RepoActivity({ name, repoUrl, items }: { name: string; repoUrl: string; items: ActivityItem[] }) {
  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className={styles.heading}>Activity</h2>
      <ul className={styles.list}>
        {items.map((item) => {
          const Glyph = GLYPHS[item.kind === "commit" ? "commit" : item.state ?? "open"];
          return (
            <li key={item.url}>
              <a className={styles.row} href={item.url} target="_blank" rel="noopener noreferrer"
                aria-label={`${item.kind === "pull" ? `Pull request ${item.ref}, ${item.state}` : `Commit ${item.ref}`}: ${item.title}`}>
                <time className={styles.date} dateTime={item.date}>{formatDate(item.date)}</time>
                <Glyph aria-hidden="true" className={styles.glyph} data-kind={item.kind === "commit" ? "commit" : item.state} />
                <span className={styles.title}>{item.title}</span>
                <span className={styles.ref}>{item.ref}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <IconLink className={`${styles.more} ${editorialStyles.link}`} href={repoUrl} icon={FaGithub}
        label={<LinkLabel>All activity for {name} on GitHub</LinkLabel>} external />
    </section>
  );
}
