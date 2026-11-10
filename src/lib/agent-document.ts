import { unstable_cache } from "next/cache";
import { CONTACT } from "@/content/contact";
import { highlightProjects, identity, skills } from "@/content/portfolio";
import { agentMarkdown, llmsTxt, type AgentDocumentData } from "./agent-markdown";
import { getOpenSourceContributions } from "./open-source";
import { OPEN_SOURCE_AUTHOR } from "./open-source-policy";
import { getProjects, isComingSoon, isSelected, repoUrl, siteUrl } from "./playground/projects";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aetosdios.xyz";

// The same public source the homepage heatmap draws from. Only the total is useful to an agent.
const getContributionsLastYear = unstable_cache(async () => {
  const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${OPEN_SOURCE_AUTHOR}?y=last`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`contributions: ${response.status}`);
  const data = (await response.json()) as { contributions: { count: number }[] };
  return data.contributions.reduce((sum, day) => sum + day.count, 0);
}, ["contributions-last-year-v1"], { revalidate: 3600 });

async function loadData(): Promise<AgentDocumentData> {
  const [contributions, contributionsLastYear] = await Promise.all([
    getOpenSourceContributions(),
    getContributionsLastYear().catch(() => null),
  ]);
  return {
    siteUrl: SITE_URL,
    name: identity.name,
    givenName: identity.givenName,
    summary: identity.summary,
    status: identity.status,
    timezone: identity.timezone,
    contact: CONTACT,
    skills,
    highlights: highlightProjects,
    projects: getProjects().map((p) => ({
      name: p.name,
      slug: p.slug,
      descriptor: p.descriptor,
      languages: p.languages,
      repo: repoUrl(p.slug),
      site: isComingSoon(p.slug) ? null : siteUrl(p),
      about: p.about,
      benchmarks: p.benchmarks ?? [],
      selected: isSelected(p.slug),
    })),
    contributions,
    contributionsLastYear,
    // The site keeps Indian time (the footer clock, the seasons), so the date does too.
    updated: new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10),
  };
}

export async function getAgentMarkdown() { return agentMarkdown(await loadData()); }
export async function getLlmsTxt() { return llmsTxt(await loadData()); }
