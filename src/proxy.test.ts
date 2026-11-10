import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { prefersMarkdown } from "./proxy";

describe("markdown negotiation", () => {
  test("agents that ask for markdown get it", () => {
    assert.equal(prefersMarkdown("text/markdown"), true);
    assert.equal(prefersMarkdown("text/markdown, text/html;q=0.9"), true);
    assert.equal(prefersMarkdown("text/x-markdown, */*"), true);
  });
  test("browsers and generic clients get the page", () => {
    assert.equal(prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"), false);
    assert.equal(prefersMarkdown("*/*"), false);
    assert.equal(prefersMarkdown(null), false);
    assert.equal(prefersMarkdown("text/html, text/markdown;q=0.5"), false);
    assert.equal(prefersMarkdown("text/markdown;q=0"), false);
  });
});
