// Curate organizations explicitly. Friend/startup repos cannot enter this feed
// through activity volume or popularity heuristics. Add organizations deliberately.
export const OPEN_SOURCE_ORGANIZATIONS = [
  "zed-industries", "TraceMachina", "HelixDB", "facebook", "tursodatabase", "zilliztech",
] as const;

export type GitHubPullRequest = {
  title: string;
  html_url: string;
  number: number;
  state: string;
  updated_at: string;
  draft?: boolean;
  user: { login: string };
  pull_request: { merged_at: string | null };
};

export type Contribution = {
  name: string;
  description: string;
  number: number;
  status: "Merged" | "Open";
  href: string;
  organization: string;
  activityAt: string;
};

const REPOSITORY_NAMES: Record<string, string> = {
  zed: "Zed", nativelink: "NativeLink", "helix-db": "HelixDB",
  rocksdb: "RocksDB", turso: "Turso", knowhere: "Knowhere",
};

export function selectContributions(items: GitHubPullRequest[], descriptions: Record<string, string> = {}): Contribution[] {
  const allowed = new Set(OPEN_SOURCE_ORGANIZATIONS.map((org) => org.toLowerCase()));
  const candidates = items.flatMap((item): Contribution[] => {
    const url = new URL(item.html_url);
    const [organization, repository, kind] = url.pathname.slice(1).split("/");
    if (url.hostname !== "github.com" || kind !== "pull" || !allowed.has(organization.toLowerCase()) ||
      item.user.login.toLowerCase() !== "aetosdios27" || item.draft || (!item.pull_request.merged_at && item.state !== "open")) return [];
    return [{
      name: REPOSITORY_NAMES[repository.toLowerCase()] ?? repository,
      description: descriptions[item.html_url] ?? item.title.trim().replace(/^(?:fix|feat|refactor|perf)(?:\([^)]*\))?:\s*/i, ""),
      number: item.number,
      status: item.pull_request.merged_at ? "Merged" : "Open",
      href: item.html_url,
      organization: organization.toLowerCase(),
      activityAt: item.pull_request.merged_at ?? item.updated_at,
    }];
  });
  const recent = (a: Contribution, b: Contribution) => Date.parse(b.activityAt) - Date.parse(a.activityAt);
  const merged = candidates.filter((item) => item.status === "Merged").sort(recent);
  const open = candidates.filter((item) => item.status === "Open").sort(recent);
  const seen = new Set<string>();
  const result: Contribution[] = [];
  // Merged first during selection, then newest first in presentation. One PR
  // per repository keeps repetitive activity from monopolizing the short list.
  for (const item of [...merged, ...open]) {
    const repository = item.href.split("/pull/")[0].toLowerCase();
    if (seen.has(repository)) continue;
    if (item.status === "Open" && result.some((entry) => entry.status === "Open")) continue;
    seen.add(repository);
    result.push(item);
    if (result.length === 6) break;
  }
  return result.sort(recent);
}
