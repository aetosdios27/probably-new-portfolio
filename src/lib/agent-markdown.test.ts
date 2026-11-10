import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { agentMarkdown, llmsTxt, type AgentDocumentData } from "./agent-markdown";

const data: AgentDocumentData = {
  siteUrl: "https://example.dev",
  name: "aetos",
  givenName: "Pushpendra",
  summary: "A systems engineer.",
  status: "Undergraduate.",
  timezone: "India (IST)",
  contact: { email: "me@example.dev", call: "https://cal.example/15", github: "https://github.com/me", x: "https://x.com/me", linkedin: "https://linkedin.com/in/me" },
  skills: { languages: ["Rust", "Go"], systems: ["Storage"], tools: ["Tokio"] },
  highlights: [{ name: "Kiban", href: "https://github.com/me/kiban", context: "An LSM-tree." }],
  projects: [
    {
      name: "Kiban", slug: "kiban", descriptor: "A storage engine.", languages: ["Rust"], repo: "https://github.com/me/kiban", site: null,
      about: ["Writes go to a WAL."], selected: true,
      benchmarks: [
        { label: "90R/10W · after · gets/s", baseline: "468K gets/s", result: "4.22M gets/s", delta: 801.7, source: "" },
        { label: "90R/10W · after · us", baseline: "368us", result: "7.48us", delta: -98, source: "" },
        { label: "a | b", baseline: null, result: "1", delta: null, source: "" },
      ],
    },
    { name: "Iris", slug: "iris", descriptor: "An image viewer.", languages: ["Rust"], repo: "https://github.com/me/iris", site: "https://iris.dev", about: [], benchmarks: [], selected: false },
  ],
  contributions: [{ name: "Zed", description: "Honor window preferences", number: 61048, status: "Merged", href: "https://github.com/zed/pull/61048", organization: "zed-industries", activityAt: "2026-10-01T00:00:00Z" }],
  contributionsLastYear: 1629,
  updated: "2026-11-11",
};

describe("agent markdown", () => {
  const doc = agentMarkdown(data);

  test("says who, how to reach them, and where the resume is, near the top", () => {
    const glance = doc.slice(0, doc.indexOf("## Skills"));
    assert.match(doc, /^# aetos \(Pushpendra\)\n/);
    assert.match(glance, /me@example\.dev/);
    assert.match(glance, /https:\/\/cal\.example\/15/);
    assert.match(glance, /https:\/\/example\.dev\/resume\.pdf/);
    assert.match(glance, /1629 GitHub contributions/);
  });

  test("writes benchmarks as a table an agent can read, with plain names and safe cells", () => {
    assert.match(doc, /\| 90R\/10W throughput \| 468K gets\/s \| 4\.22M gets\/s \| \+801\.7% \|/);
    assert.match(doc, /\| 90R\/10W p99 latency \| 368us \| 7\.48us \| -98% \|/);
    assert.match(doc, /\| a \\\| b \| n\/a \| 1 \| n\/a \|/);
  });

  test("lists selected projects in full and the rest briefly, and every contribution", () => {
    assert.match(doc, /### Kiban\n\nA storage engine\./);
    assert.match(doc, /- Page: https:\/\/example\.dev\/playground\/kiban/);
    assert.match(doc, /## More projects\n\n- \[Iris\]\(https:\/\/github\.com\/me\/iris\): An image viewer\. \(Rust\)/);
    assert.match(doc, /\*\*Zed\*\*: Honor window preferences \(\[#61048\]\(https:\/\/github\.com\/zed\/pull\/61048\), merged, 2026-10-01\)/);
  });

  test("omits the contribution count when it could not be fetched", () => {
    assert.doesNotMatch(agentMarkdown({ ...data, contributionsLastYear: null }), /GitHub contributions in the last year/);
  });

  test("llms.txt points agents at the full document", () => {
    const index = llmsTxt(data);
    assert.match(index, /^# aetos\n\n> /);
    assert.match(index, /\[Full profile\]\(https:\/\/example\.dev\/index\.md\)/);
    assert.match(index, /\[Kiban\]\(https:\/\/example\.dev\/playground\/kiban\)/);
    assert.doesNotMatch(index, /Iris/);
  });
});
