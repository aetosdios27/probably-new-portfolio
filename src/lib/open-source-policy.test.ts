import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { selectContributions, type GitHubPullRequest } from "./open-source-policy";
import snapshot from "../content/open-source-snapshot.json";
import { getOpenSourceContributions } from "./open-source";

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

  test("server feed fetches qualifying organizations with hourly revalidation", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (input, options) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, "api.github.com");
      assert.ok(url.searchParams.get("q")?.includes("author:aetosdios27"));
      assert.ok(url.searchParams.get("q")?.includes("org:zed-industries"));
      assert.equal((options as RequestInit & { next: { revalidate: number } }).next.revalidate, 3600);
      return new Response(JSON.stringify({ items: [pr("facebook/rocksdb", 99)], incomplete_results: false }));
    }) as typeof fetch;
    try {
      assert.deepEqual((await getOpenSourceContributions()).map((item) => item.number), [99]);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("API failure serves the verified, curated snapshot", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response("rate limited", { status: 403 })) as typeof fetch;
    try {
      assert.deepEqual(await getOpenSourceContributions(), selectContributions(snapshot.items,
        { "https://github.com/zed-industries/zed/pull/61048": "Honor window preferences when opening remote projects",
          "https://github.com/TraceMachina/nativelink/pull/2548": "Handle zero digests in CompressionStore",
          "https://github.com/HelixDB/helix-db/pull/1071": "Share one property decode across ORDER BY keys",
          "https://github.com/facebook/rocksdb/pull/15126": "Fix JNI local-reference leaks in ByteBuffer multiGet",
          "https://github.com/tursodatabase/turso/pull/8465": "Restore SQLite numeric-affinity whitespace parity",
          "https://github.com/zilliztech/knowhere/pull/1787": "Bound DiskANN AIO pool waits and fail fast" }));
    } finally {
      globalThis.fetch = original;
    }
  });

  test("a stalled request aborts at the three-second budget and serves the snapshot", async () => {
    const originalFetch = globalThis.fetch;
    const originalTimeout = AbortSignal.timeout;
    let requestedTimeout = 0;
    // Exercise the real abort/fallback path without waiting three seconds.
    AbortSignal.timeout = (milliseconds) => {
      requestedTimeout = milliseconds;
      return originalTimeout(1);
    };
    globalThis.fetch = ((_input, options) => new Promise((_resolve, reject) => {
      const signal = options?.signal;
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    })) as typeof fetch;
    try {
      const result = await getOpenSourceContributions();
      assert.equal(requestedTimeout, 3000);
      assert.deepEqual(result.map((item) => item.href), selectContributions(snapshot.items).map((item) => item.href));
    } finally {
      globalThis.fetch = originalFetch;
      AbortSignal.timeout = originalTimeout;
    }
  });
});
