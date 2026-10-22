import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { refreshOpenSourceSnapshot } from "./generate-open-source";
import snapshot from "../src/content/open-source-snapshot.json";

describe("durable contribution snapshot", () => {
  test("never overwrites a good snapshot on empty, partial, or failed refreshes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contribution-snapshot-"));
    const path = join(dir, "snapshot.json");
    const original = JSON.stringify(snapshot);
    const empty = { data: { user: { pullRequests: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } };
    try {
      await writeFile(path, original);
      for (const response of [Response.json(empty), Response.json({ ...empty, errors: [{ message: "partial" }] }), new Response("unavailable", { status: 503 })]) {
        await assert.rejects(refreshOpenSourceSnapshot({ path, token: "test-token", fetcher: async () => response }));
        assert.equal(await readFile(path, "utf8"), original);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("saves a verified new PR and leaves an unchanged snapshot byte-identical", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contribution-snapshot-"));
    const path = join(dir, "snapshot.json");
    const fetcher: typeof fetch = async () => Response.json({ data: { user: { pullRequests: {
      nodes: [{ title: "fix: a new contribution", url: "https://github.com/zed-industries/zed/pull/999", number: 999,
        state: "MERGED", updatedAt: "2026-10-22T00:00:00Z", mergedAt: "2026-10-22T00:00:00Z", isDraft: false,
        author: { login: "aetosdios27" }, repository: { isPrivate: false, owner: { __typename: "Organization", login: "zed-industries" } } }],
      pageInfo: { hasNextPage: false, endCursor: null },
    } } } });
    try {
      await writeFile(path, JSON.stringify(snapshot));
      await refreshOpenSourceSnapshot({ path, token: "test-token", fetcher });
      const saved = await readFile(path, "utf8");
      const data = JSON.parse(saved);
      assert.deepEqual(data.items.map((item: { number: number }) => item.number), [999]);
      assert.ok(Number.isFinite(Date.parse(data.checkedAt)));
      await refreshOpenSourceSnapshot({ path, token: "test-token", fetcher });
      assert.equal(await readFile(path, "utf8"), saved);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
