import { openSource } from "@/content/portfolio";
import snapshot from "@/content/open-source-snapshot.json";
import { OPEN_SOURCE_ORGANIZATIONS, selectContributions, type GitHubPullRequest } from "./open-source-policy";

const descriptions = Object.fromEntries(openSource.map((item) => [item.href, item.description]));

export async function getOpenSourceContributions() {
  const query = ["is:pr", "author:aetosdios27", ...OPEN_SOURCE_ORGANIZATIONS.map((org) => `org:${org}`)].join(" ");
  const params = new URLSearchParams({ q: query, sort: "updated", order: "desc", per_page: "100" });
  const token = process.env.GITHUB_TOKEN;
  try {
    const response = await fetch(`https://api.github.com/search/issues?${params}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`GitHub contribution search: ${response.status}`);
    const data: { items: GitHubPullRequest[]; incomplete_results: boolean } = await response.json();
    if (!Array.isArray(data.items) || data.incomplete_results) throw new Error("Incomplete GitHub contribution response");
    return selectContributions(data.items, descriptions);
  } catch {
    // No loading chrome or error UI in the document. The verified snapshot
    // follows exactly the same filtering, status, and ordering policy.
    return selectContributions(snapshot.items, descriptions);
  }
}
