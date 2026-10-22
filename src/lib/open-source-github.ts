import { OPEN_SOURCE_AUTHOR, selectContributions, type GitHubPullRequest } from "./open-source-policy";

// An authored connection has cursor pagination; unlike search, it has no 1,000-result ceiling.
const QUERY = `query AuthoredContributions($login: String!, $after: String) {
  user(login: $login) {
    pullRequests(first: 100, after: $after, states: [OPEN, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title url number state updatedAt isDraft mergedAt
        author { login }
        repository { isPrivate owner { __typename login } }
      }
    }
  }
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Invalid GitHub object");
  return value;
}

function string(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Invalid GitHub string");
  return value;
}

function date(value: unknown): string {
  const text = string(value);
  if (!Number.isFinite(Date.parse(text))) throw new Error("Invalid GitHub date");
  return text;
}

function parsePage(value: unknown): { items: GitHubPullRequest[]; nextCursor: string | null } {
  const response = record(value);
  if (response.errors !== undefined && (!Array.isArray(response.errors) || response.errors.length)) {
    throw new Error("GitHub returned GraphQL errors");
  }
  const connection = record(record(record(response.data).user).pullRequests);
  const page = record(connection.pageInfo);
  if (!Array.isArray(connection.nodes) || typeof page.hasNextPage !== "boolean") throw new Error("Incomplete GitHub page");
  const nextCursor = page.hasNextPage ? string(page.endCursor) : null;
  if (nextCursor && !connection.nodes.length) throw new Error("Empty GitHub page before end of history");
  const items = connection.nodes.flatMap((value): GitHubPullRequest[] => {
    const node = record(value);
    const repository = record(node.repository);
    const owner = record(repository.owner);
    if (typeof repository.isPrivate !== "boolean") throw new Error("Invalid GitHub repository visibility");
    if (repository.isPrivate || owner.__typename !== "Organization") return [];
    if (typeof node.number !== "number" || !Number.isSafeInteger(node.number) || node.number < 1 ||
      typeof node.isDraft !== "boolean" || (node.state !== "OPEN" && node.state !== "MERGED")) {
      throw new Error("Invalid GitHub pull request");
    }
    const url = new URL(string(node.url));
    const organization = string(owner.login);
    const [urlOwner, repositoryName, kind, number] = url.pathname.slice(1).split("/");
    if (url.origin !== "https://github.com" || urlOwner.toLowerCase() !== organization.toLowerCase() ||
      !repositoryName || kind !== "pull" || number !== String(node.number)) throw new Error("Invalid GitHub pull request URL");
    const mergedAt = node.state === "MERGED" ? date(node.mergedAt) : null;
    const updatedAt = date(node.updatedAt);
    if (mergedAt && Date.parse(mergedAt) > Date.parse(updatedAt)) throw new Error("Invalid GitHub activity order");
    return [{
      title: string(node.title), html_url: url.href, number: node.number,
      state: node.state === "OPEN" ? "open" : "closed", updated_at: updatedAt,
      draft: node.isDraft, user: { login: string(record(node.author).login) },
      pull_request: { merged_at: mergedAt },
    }];
  });
  return { items, nextCursor };
}

export async function fetchOpenSourceHistory({
  token,
  fetcher = fetch,
  signal = AbortSignal.timeout(8000),
}: { token: string; fetcher?: typeof fetch; signal?: AbortSignal }): Promise<GitHubPullRequest[]> {
  if (!token) throw new Error("GitHub GraphQL requires a server token");
  const items: GitHubPullRequest[] = [];
  const cursors = new Set<string>();
  let after: string | null = null;
  do {
    signal.throwIfAborted();
    const response = await fetcher("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { login: OPEN_SOURCE_AUTHOR, after } }),
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error(`GitHub authored contributions: ${response.status}`);
    const page = parsePage(await response.json());
    items.push(...page.items);
    after = page.nextCursor;
    if (after) {
      if (cursors.has(after)) throw new Error("GitHub repeated a pagination cursor");
      cursors.add(after);
      const selected = selectContributions(items);
      const oldestMerged = Math.min(...selected.map(item => Date.parse(item.activityAt)));
      const pageBoundary = Math.min(...page.items.map(item => Date.parse(item.updated_at)));
      // Older pages cannot beat six merged winners once their update times are
      // older than every selected merge. Open PRs never justify stopping early.
      if (selected.length === 6 && selected.every(item => item.status === "Merged") && pageBoundary <= oldestMerged) break;
    }
  } while (after);
  const selected = selectContributions(items);
  if (!selected.length) throw new Error("GitHub returned no qualifying contributions");
  const selectedUrls = new Set(selected.map(item => item.href));
  // Persist only the public, curated display candidates, never personal/friend/private history.
  return items.filter(item => selectedUrls.has(item.html_url));
}
