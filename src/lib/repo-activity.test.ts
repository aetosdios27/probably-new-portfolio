import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { mergeActivity } from "./repo-activity";

const commit = (sha: string, message: string, date: string) => ({
  sha, html_url: `https://github.com/aetosdios27/x/commit/${sha}`,
  commit: { message, author: { date }, committer: { date } },
});
const pull = (number: number, merged: string | null, state: "open" | "closed" = "closed", created = "2026-01-01T00:00:00Z") => ({
  number, title: `pr ${number}`, html_url: `https://github.com/aetosdios27/x/pull/${number}`,
  state, merged_at: merged, closed_at: merged, created_at: created,
});

describe("mergeActivity", () => {
  test("drops the squash commit that repeats a listed pull request", () => {
    const items = mergeActivity(
      [commit("aaaaaaa1", "feat: thing (#7)", "2026-10-02T00:00:00Z"), commit("bbbbbbb2", "chore: direct push", "2026-10-01T00:00:00Z")],
      [pull(7, "2026-10-02T00:00:00Z")],
    );
    assert.deepEqual(items.map(({ ref }) => ref), ["#7", "bbbbbbb"]);
  });

  test("labels merged, open and closed pull requests and sorts newest first", () => {
    const items = mergeActivity([], [pull(1, "2026-03-01T00:00:00Z"), pull(2, null, "open", "2026-02-01T00:00:00Z"), pull(3, null, "closed", "2026-01-15T00:00:00Z")]);
    assert.deepEqual(items.map(({ ref, state }) => [ref, state]), [["#1", "merged"], ["#2", "open"], ["#3", "closed"]]);
  });

  test("keeps a commit whose pull request number is not in the list", () => {
    assert.equal(mergeActivity([commit("ccccccc3", "fix: other (#99)", "2026-10-02T00:00:00Z")], []).length, 1);
  });

  test("limits the result", () => {
    const many = Array.from({ length: 30 }, (_, index) => pull(index + 1, `2026-02-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`));
    assert.equal(mergeActivity([], many, 10).length, 10);
  });
});
