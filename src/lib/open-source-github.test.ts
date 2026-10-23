import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { fetchOpenSourceHistory } from "./open-source-github";

function pr(repository = "facebook/rocksdb", number = 1, ownerType = "Organization") {
  return {
    title: "fix: a specific change", url: `https://github.com/${repository}/pull/${number}`,
    number, state: "MERGED", updatedAt: "2026-10-01T00:00:00Z", isDraft: false,
    mergedAt: "2026-09-01T00:00:00Z", author: { login: "aetosdios27" },
    repository: { isPrivate: false, owner: { __typename: ownerType, login: repository.split("/")[0] } },
  };
}

function page(nodes: unknown[], nextCursor: string | null = null) {
  return { data: { user: { pullRequests: { nodes, pageInfo: { hasNextPage: nextCursor !== null, endCursor: nextCursor } } } } };
}

function fetchPages(pages: unknown[]): typeof fetch {
  let index = 0;
  return async () => {
    assert.ok(index < pages.length, "Unexpected extra GitHub request");
    return Response.json(pages[index++]);
  };
}

describe("authored contribution refresh", () => {
  test("paginates past personal history and uses one authored connection, without per-org searches", async () => {
    const bodies: unknown[] = [];
    const responses = fetchPages([
      page(Array.from({ length: 100 }, (_, i) => pr("aetosdios27/own-repo", i + 1, "User")), "page-2"),
      page([pr("zed-industries/zed", 2)]),
    ]);
    const result = await fetchOpenSourceHistory({ token: "test-token", fetcher: async (input, options) => {
      assert.equal(input, "https://api.github.com/graphql");
      assert.equal(options?.method, "POST");
      assert.equal(options?.cache, "no-store");
      bodies.push(JSON.parse(String(options?.body)));
      return responses(input, options);
    } });
    assert.equal(bodies.length, 2);
    for (const [index, body] of bodies.entries()) {
      assert.ok(body && typeof body === "object" && "variables" in body);
      assert.deepEqual(body.variables, { login: "aetosdios27", after: index ? "page-2" : null });
    }
    assert.deepEqual(result.map(item => item.html_url), ["https://github.com/zed-industries/zed/pull/2"]);
  });

  test("only returns public, curated contributions, including new repos at approved orgs", async () => {
    const privatePR = pr("facebook/private-repo", 2);
    privatePR.repository.isPrivate = true;
    const result = await fetchOpenSourceHistory({ token: "test-token", fetcher: fetchPages([page([
      pr("friend/tiny-repo", 3), privatePR, pr("new-startup/demo", 4),
      pr("aetosdios27/own", 5, "User"), pr("facebook/new-public-repo", 6),
    ])]) });
    assert.deepEqual(result.map(item => item.html_url), ["https://github.com/facebook/new-public-repo/pull/6"]);
  });

  test("applies merged priority after the complete history, not the first six open PRs", async () => {
    const open = Array.from({ length: 6 }, (_, i) => ({ ...pr(`facebook/repo-${i}`, i + 1), state: "OPEN", mergedAt: null }));
    const result = await fetchOpenSourceHistory({ token: "test-token", fetcher: fetchPages([
      page(open, "page-2"), page([pr("zed-industries/zed", 99)]),
    ]) });
    assert.ok(result.some(item => item.number === 99));
    assert.equal(result.filter(item => !item.pull_request.merged_at).length, 1);
  });

  test("has no search-style 1,000-result cutoff", async () => {
    const pages = Array.from({ length: 11 }, (_, index) => page(
      Array.from({ length: 100 }, (_, i) => pr("aetosdios27/own-repo", index * 100 + i + 1, "User")),
      `page-${index + 2}`,
    ));
    const result = await fetchOpenSourceHistory({ token: "test-token", fetcher: fetchPages([...pages, page([pr()])]) });
    assert.equal(result.length, 1);
  });

  test("stops only when older pages cannot change seven merged winners", async () => {
    const winners = Array.from({ length: 7 }, (_, i) => pr(`facebook/repo-${i}`, i + 1));
    const boundary = { ...pr("unapproved-org/old-repo", 20), updatedAt: "2026-08-01T00:00:00Z", mergedAt: "2026-07-01T00:00:00Z" };
    const result = await fetchOpenSourceHistory({ token: "test-token", fetcher: fetchPages([page([...winners, boundary], "older-page")]) });
    assert.equal(result.length, 7);
    // Seven merged PRs alone are insufficient: an old PR updated recently can
    // place a more recently merged eighth repository on a later page.
    const newerMerge = { ...pr("zed-industries/zed", 99), mergedAt: "2026-09-15T00:00:00Z" };
    const complete = await fetchOpenSourceHistory({ token: "test-token", fetcher: fetchPages([
      page(winners, "older-page"), page([newerMerge]),
    ]) });
    assert.ok(complete.some(item => item.number === 99));
  });

  test("rejects empty, irrelevant, malformed, and partial GraphQL results instead of caching them", async () => {
    for (const response of [page([]), page([pr("friend/demo")]), {},
      { ...page([pr()]), errors: [{ message: "partial result" }] },
      page([{ ...pr(), updatedAt: "invalid-date" }]),
      page([{ ...pr(), url: "https://example.com/facebook/rocksdb/pull/1" }]),
      page([{ ...pr(), repository: { owner: {} } }]),
      page([null]),
    ]) {
      await assert.rejects(fetchOpenSourceHistory({ token: "test-token", fetcher: fetchPages([response]) }));
    }
  });

  test("rejects pagination failure even after a valid first page", async () => {
    let requests = 0;
    await assert.rejects(fetchOpenSourceHistory({ token: "test-token", fetcher: async () => {
      if (++requests === 1) return Response.json(page([pr()], "page-2"));
      return new Response("rate limited", { status: 403 });
    } }));
    assert.equal(requests, 2);
  });

  test("rejects repeated cursors and empty intermediate pages", async () => {
    await assert.rejects(fetchOpenSourceHistory({ token: "test-token", fetcher: fetchPages([
      page([pr()], "same-cursor"), page([pr()], "same-cursor"),
    ]) }), /repeated/);
    await assert.rejects(fetchOpenSourceHistory({ token: "test-token", fetcher: fetchPages([page([], "page-2")]) }), /Empty/);
  });

  test("requires credentials and honors the total refresh deadline", async () => {
    await assert.rejects(fetchOpenSourceHistory({ token: "", fetcher: async () => {
      assert.fail("Must not call GitHub without a token");
    } }), /token/);
    await assert.rejects(fetchOpenSourceHistory({ token: "test-token", signal: AbortSignal.abort(), fetcher: async () => {
      assert.fail("Must not start a request after the deadline");
    } }));
    await assert.rejects(fetchOpenSourceHistory({ token: "test-token", signal: AbortSignal.timeout(5), fetcher: async (_input, options) => {
      return new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true }));
    } }));
  });
});
