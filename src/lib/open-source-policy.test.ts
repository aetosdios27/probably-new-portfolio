import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { selectContributions, type GitHubPullRequest } from "./open-source-policy";
import snapshot from "../content/open-source-snapshot.json";

function pr(repository: string, number: number, merged = true, date = "2026-10-01T00:00:00Z"): GitHubPullRequest {
  return {
    html_url: `https://github.com/${repository}/pull/${number}`, number,
    title: "fix: a specific implementation change", state: merged ? "closed" : "open",
    updated_at: date, user: { login: "aetosdios27" },
    pull_request: { merged_at: merged ? date : null },
  };
}

describe("curated contribution feed", () => {
  test("excludes personal repos, other authors, drafts, and closed unmerged PRs", () => {
    const allowed = pr("facebook/rocksdb", 1);
    const other = { ...pr("facebook/rocksdb", 2), user: { login: "someone-else" } };
    const draft = { ...pr("facebook/rocksdb", 3, false), draft: true };
    const closed = { ...pr("facebook/rocksdb", 4, false), state: "closed" };
    assert.deepEqual(selectContributions([allowed, pr("friend/tiny-repo", 5), other, draft, closed]).map((item) => item.number), [1]);
  });

  test("prefers merged over newer open PRs in the same repo and sorts by activity", () => {
    const result = selectContributions([
      pr("HelixDB/helix-db", 1, true, "2026-09-01T00:00:00Z"),
      pr("HelixDB/helix-db", 2, false, "2026-10-01T00:00:00Z"),
      pr("facebook/rocksdb", 3, false, "2026-09-10T00:00:00Z"),
      pr("zed-industries/zed", 4, true, "2026-09-05T00:00:00Z"),
    ]);
    assert.deepEqual(result.map((item) => item.number), [3, 4, 1]);
    assert.equal(result.filter((item) => item.status === "Open").length, 1);
  });

  test("caps the list at six and never displays more than one open PR", () => {
    const items = Array.from({ length: 8 }, (_, i) => pr(`facebook/repo-${i}`, i + 1));
    assert.equal(selectContributions(items).length, 6);
    assert.equal(selectContributions(items.map((item) => ({ ...item, state: "open", pull_request: { merged_at: null } }))).length, 1);
  });

  test("verified snapshot follows the live policy and preserves editorial descriptions", () => {
    const result = selectContributions(snapshot.items, { "https://github.com/zed-industries/zed/pull/61048": "Honor window preferences when opening remote projects" });
    assert.deepEqual(result.map((item) => item.name), ["HelixDB", "Knowhere", "Turso", "RocksDB", "Zed", "NativeLink"]);
    assert.equal(result.filter((item) => item.status === "Merged").length, 5);
    assert.equal(result.find((item) => item.name === "Zed")?.description, "Honor window preferences when opening remote projects");
  });

});
