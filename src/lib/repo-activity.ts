import snapshot from "@/content/repo-activity-snapshot.json";

export type ActivityItem = {
  kind: "commit" | "pull";
  title: string;
  url: string;
  date: string;
  /** Short SHA for commits, "#123" for pull requests. */
  ref: string;
  state?: "merged" | "open" | "closed";
};

type RawCommit = { sha: string; html_url: string; commit: { message: string; author: { date: string } | null; committer: { date: string } | null } };
type RawPull = { number: number; title: string; html_url: string; state: "open" | "closed"; merged_at: string | null; closed_at: string | null; created_at: string };

const OWNER = "aetosdios27";
const LIMIT = 10;

export function mergeActivity(commits: RawCommit[], pulls: RawPull[], limit = LIMIT): ActivityItem[] {
  const pullNumbers = new Set(pulls.map(({ number }) => number));
  const pullItems: ActivityItem[] = pulls.map((pull) => ({
    kind: "pull",
    title: pull.title,
    url: pull.html_url,
    date: pull.merged_at ?? pull.closed_at ?? pull.created_at,
    ref: `#${pull.number}`,
    state: pull.merged_at ? "merged" : pull.state,
  }));
  const commitItems: ActivityItem[] = commits.flatMap((entry) => {
    const title = entry.commit.message.split("\n")[0];
    // A squash or merge commit repeats its pull request; show the pull request only.
    const squashed = title.match(/\(#(\d+)\)$/) ?? title.match(/^Merge pull request #(\d+)/);
    if (squashed && pullNumbers.has(Number(squashed[1]))) return [];
    const date = entry.commit.author?.date ?? entry.commit.committer?.date;
    return date ? [{ kind: "commit" as const, title, url: entry.html_url, date, ref: entry.sha.slice(0, 7) }] : [];
  });
  return [...pullItems, ...commitItems].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export async function fetchRepoActivity(slug: string): Promise<ActivityItem[]> {
  const token = process.env.GITHUB_TOKEN;
  const init = {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(5000),
  };
  const [commitsResponse, pullsResponse] = await Promise.all([
    fetch(`https://api.github.com/repos/${OWNER}/${slug}/commits?per_page=20`, init),
    fetch(`https://api.github.com/repos/${OWNER}/${slug}/pulls?state=all&sort=updated&direction=desc&per_page=20`, init),
  ]);
  if (!commitsResponse.ok || !pullsResponse.ok) throw new Error(`GitHub activity for ${slug}: ${commitsResponse.status}/${pullsResponse.status}`);
  return mergeActivity(await commitsResponse.json(), await pullsResponse.json());
}

export async function getRepoActivity(slug: string): Promise<ActivityItem[]> {
  try {
    return await fetchRepoActivity(slug);
  } catch {
    // No error UI in the document: fall back to the last verified snapshot.
    return (snapshot as Record<string, ActivityItem[]>)[slug] ?? [];
  }
}
