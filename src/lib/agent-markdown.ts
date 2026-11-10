// The whole site as one markdown document, for AI agents and for the site's own AI mode. Pure: the
// loader (agent-document.ts) gathers the live data, this only writes it down.

import type { Contribution } from "./open-source-policy";
import type { Benchmark } from "./playground/types";

export type AgentProject = {
  name: string;
  slug: string;
  descriptor: string;
  languages: string[];
  repo: string;
  /** A public deployed site, if there is one. */
  site: string | null;
  about: string[];
  benchmarks: Benchmark[];
  selected: boolean;
};

export type AgentDocumentData = {
  siteUrl: string;
  name: string;
  givenName: string;
  summary: string;
  status: string;
  timezone: string;
  contact: { email: string; call: string; github: string; x: string; linkedin: string };
  skills: { languages: string[]; systems: string[]; tools: string[] };
  highlights: readonly { name: string; href: string; context: string }[];
  projects: AgentProject[];
  contributions: Contribution[];
  /** GitHub contributions in the last year, when the count could be fetched. */
  contributionsLastYear: number | null;
  updated: string;
};

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const list = (items: string[]) => items.join(", ");

function benchmarkTable(benchmarks: Benchmark[]) {
  const rows = benchmarks.map(({ label, baseline, result, delta }) =>
    `| ${cell(label.replace(/ · after · gets\/s$/, " throughput").replace(/ · after · us$/, " p99 latency").replace(/ · after · /, " · "))} | ${cell(baseline ?? "n/a")} | ${cell(result)} | ${delta == null ? "n/a" : `${delta > 0 ? "+" : ""}${delta}%`} |`);
  return ["| Measure | Before | After | Change |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

function project(p: AgentProject, url: (path: string) => string) {
  const lines = [`### ${p.name}`, "", p.descriptor, ""];
  lines.push(`- Languages: ${list(p.languages)}`);
  lines.push(`- Source: ${p.repo}`);
  if (p.site) lines.push(`- Site: ${p.site}`);
  lines.push(`- Page: ${url(`/playground/${p.slug}`)}`);
  if (p.about.length) lines.push("", ...p.about.flatMap((paragraph) => [paragraph, ""]).slice(0, -1));
  if (p.benchmarks.length) lines.push("", "Benchmarks (from the project's README):", "", benchmarkTable(p.benchmarks));
  return lines.join("\n");
}

export function agentMarkdown(d: AgentDocumentData): string {
  const url = (path: string) => new URL(path, d.siteUrl).toString();
  const selected = d.projects.filter((p) => p.selected);
  const more = d.projects.filter((p) => !p.selected);
  const contributions = d.contributions.map((c) =>
    `- **${c.name}**: ${c.description} ([#${c.number}](${c.href}), ${c.status.toLowerCase()}, ${c.activityAt.slice(0, 10)})`);

  return [
    `# ${d.name} (${d.givenName})`,
    "",
    `> ${d.summary} ${d.status}`,
    "",
    `This is the agent-readable version of ${url("/")}: everything the site says, as plain markdown, with no need to render or screenshot anything. It is regenerated hourly. Last updated ${d.updated}.`,
    "",
    "## At a glance",
    "",
    `- Who: ${d.name}, a systems engineer. ${d.status}`,
    `- Works on: storage engines, distributed consensus, network protocols, and developer tooling, mostly in Rust.`,
    `- Based in: ${d.timezone}`,
    `- Open source: pull requests to ${list(d.contributions.map((c) => c.name))}${d.contributionsLastYear == null ? "" : `; ${d.contributionsLastYear} GitHub contributions in the last year`}.`,
    `- Contact: ${d.contact.email}, or book a 15 minute call at ${d.contact.call}`,
    `- Resume (PDF): ${url("/resume.pdf")}`,
    "",
    "## Skills",
    "",
    `- Languages: ${list(d.skills.languages)}`,
    `- Systems: ${list(d.skills.systems)}`,
    `- Tools and frameworks: ${list(d.skills.tools)}`,
    "",
    "## Selected work",
    "",
    ...d.highlights.map((h) => `- [${h.name}](${h.href}): ${h.context}`),
    "",
    "## Projects",
    "",
    selected.map((p) => project(p, url)).join("\n\n"),
    "",
    ...(more.length ? ["## More projects", "", ...more.map((p) => `- [${p.name}](${p.repo}): ${p.descriptor}${p.languages.length ? ` (${list(p.languages)})` : ""}`), ""] : []),
    "## Open source contributions",
    "",
    "Pull requests to projects outside my own, one per repository, newest first.",
    "",
    ...contributions,
    "",
    "## Contact",
    "",
    `- Email: ${d.contact.email}`,
    `- Book a call: ${d.contact.call}`,
    `- GitHub: ${d.contact.github}`,
    `- X: ${d.contact.x}`,
    `- LinkedIn: ${d.contact.linkedin}`,
    "",
    "## Pages",
    "",
    `- Home: ${url("/")}`,
    `- Playground (all projects): ${url("/playground")}`,
    ...selected.map((p) => `- ${p.name}: ${url(`/playground/${p.slug}`)}`),
    `- This document: ${url("/index.md")}`,
    `- Index for agents: ${url("/llms.txt")}`,
    "",
  ].join("\n");
}

/** The llms.txt index: a short summary and where the full document lives. */
export function llmsTxt(d: AgentDocumentData): string {
  const url = (path: string) => new URL(path, d.siteUrl).toString();
  return [
    `# ${d.name}`,
    "",
    `> ${d.summary} ${d.status}`,
    "",
    "Everything on this site is available as one markdown document. Read it instead of rendering the pages.",
    "",
    "## Docs",
    "",
    `- [Full profile](${url("/index.md")}): who I am, skills, projects with benchmarks, open-source contributions, and contact`,
    `- [Resume](${url("/resume.pdf")}): PDF`,
    "",
    "## Projects",
    "",
    ...d.projects.filter((p) => p.selected).map((p) => `- [${p.name}](${url(`/playground/${p.slug}`)}): ${p.descriptor}`),
    "",
  ].join("\n");
}
