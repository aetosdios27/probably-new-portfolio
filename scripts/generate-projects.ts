import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { intro, plain, benchmarks, readmeLinks, screenshotUrls } from '../src/lib/playground/extract';
import type { Project } from '../src/lib/playground/types';
import { projectsConfig } from '../src/data/projects.config';

const USER = 'aetosdios27';
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
async function api(path: string, optional = false) {
  const response = await fetch(`https://api.github.com/${path}`, { headers, signal: AbortSignal.timeout(20000) });
  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub ${path}: ${response.status}. Snapshot not replaced.`);
  return response.json();
}
type Repo = { name: string; description: string | null; homepage: string | null; fork: boolean; archived: boolean; stargazers_count: number; pushed_at: string; default_branch: string };
type Source = Pick<Project, 'slug' | 'pushed_at' | 'readme' | 'languages'> & { readme_path?: string };

export function usableDescriptor(text: string): boolean {
  return Boolean(text.trim()) && !/bootstrapped with|create-next-app|https?:\/\//i.test(text)
    && !/^(this is a\b|video walkthrough\b|config files for\b)/i.test(text.trim());
}

export function shortenDescriptor(text: string): string {
  const sentence = plain(text).match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? plain(text);
  if (sentence.length <= 160) return sentence;
  const prefix = sentence.slice(0, 160);
  const boundary = prefix.lastIndexOf(' ');
  let cut = boundary > 0 ? prefix.slice(0, boundary) : '';
  // Remove incomplete conjunctions/articles left behind by a word-boundary cut.
  cut = cut.trim().replace(/[,;:.!?]+$/, '').replace(/(?:\s+(?:and|or|the|a|an|with|for|to|of|in|on|at|by|from|into))+$/i, '').replace(/[,;:.!?]+$/, '');
  return cut ? `${cut}…` : '';
}

export function descriptorFor(description: string | null, readme: string): string {
  if (description && usableDescriptor(description)) return shortenDescriptor(description);
  // Scan prose after the title, rather than trusting the first intro block.
  // Metadata, badges, headings, fenced examples and boilerplate cannot become
  // the descriptor. Keep the first usable source sentence verbatim before trim.
  const cleaned = readme.replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<\/?[a-z][^>]*>/gi, '');
  for (const block of cleaned.split(/\n\s*\n/)) {
    if (/^\s*#{2,}\s/.test(block)) {
      if (/^\s*#+\s+(about|overview|introduction)\b/i.test(block)) continue;
      break; // Installation instructions are not the project's introduction.
    }
    if (/^\s*(#|\||[-*]\s|\d+\.|[-*_]{3,}\s*$|\[[^\]]+\]:)/.test(block)) continue;
    const text = plain(block.replace(/^>\s?/gm, ''));
    if (!usableDescriptor(text)) continue;
    const sentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
    if (sentence && usableDescriptor(sentence)) return shortenDescriptor(sentence);
  }
  return '';
}

async function main() {
  const cached: Source[] = await readFile('src/data/projects.generated.json', 'utf8')
    .then(text => { const data = JSON.parse(text) as { sources?: Source[]; projects: Project[] }; return data.sources ?? data.projects; })
    .catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
  const repos: Repo[] = [];
  for (let page = 1; ; page++) {
    const batch: Repo[] = await api(`users/${USER}/repos?type=owner&per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  await mkdir('public/playground', { recursive: true });
  const projects: Project[] = [];
  const sources: Source[] = [];
  const audit: { repo: string; included: boolean; reason: string }[] = [];
  // Four workers keep API and image requests bounded, without a dependency.
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < repos.length) {
      const repo = repos[cursor++];
      const slug = repo.name.toLowerCase();
      const forced = projectsConfig.forceInclude.includes(slug);
      const pattern = projectsConfig.excludePatterns.find(pattern => pattern.test(repo.name));
      const rejection = projectsConfig.hidden.includes(slug) ? 'hidden'
        : forced ? null : repo.fork ? 'fork' : repo.archived ? 'archived'
        : slug === USER ? 'profile config' : pattern ? `pattern ${pattern}` : null;
      if (rejection) { audit.push({ repo: repo.name, included: false, reason: rejection }); continue; }
      const path = `repos/${USER}/${encodeURIComponent(repo.name)}`;
      const previous = cached.find(project => project.slug === repo.name.toLowerCase() && project.pushed_at === repo.pushed_at);
      const [readmeData, languageData] = previous ? [null, null] : await Promise.all([api(`${path}/readme`, true), api(`${path}/languages`)]);
      const readme = previous?.readme ?? (readmeData ? Buffer.from(readmeData.content, 'base64').toString('utf8') : '');
      const languages = previous?.languages ?? Object.entries(languageData).sort((a, b) => Number(b[1]) - Number(a[1])).map(([language]) => language);
      const readmePath = previous?.readme_path ?? readmeData?.path ?? 'README.md';
      sources.push({ slug, pushed_at: repo.pushed_at, readme, languages, readme_path: readmePath });
      const about = intro(readme);
      const descriptor = projectsConfig.descriptors[slug] ?? projectsConfig.overrides[slug]?.descriptor ?? descriptorFor(repo.description, readme);
      const gateReason = !descriptor ? 'no descriptor' : plain(readme).length < 400 ? 'short readme' : null;
      if (gateReason && !forced) { audit.push({ repo: repo.name, included: false, reason: gateReason }); continue; }
      audit.push({ repo: repo.name, included: true, reason: forced ? `force-included${gateReason ? ` (${gateReason})` : ''}` : 'quality gate passed' });
      const candidates = [...(repo.homepage && /^https?:\/\//.test(repo.homepage) ? [{ label: 'Website', url: repo.homepage }] : []), ...readmeLinks(readme)];
      const demos = [];
      for (const link of candidates.filter((item, index, all) => all.findIndex(other => other.url === item.url) === index)) {
        try {
          const response = await fetch(link.url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) });
          if (response.status >= 200 && response.status < 400) demos.push(link);
        } catch { /* An unverified demo is omitted, never invented. */ }
      }
      let image: string | null = null;
      const rawBase = `https://raw.githubusercontent.com/${USER}/${repo.name}/${repo.default_branch}/${readmePath}`;
      for (const url of screenshotUrls(readme, rawBase)) {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
          const mime = response.headers.get('content-type') ?? '';
          if (!response.ok || !/^image\/(png|jpeg|webp)/.test(mime)) continue;
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length > 10 * 1024 * 1024) continue;
          const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
          image = `/playground/${repo.name.toLowerCase()}.${ext}`;
          await writeFile(`public${image}`, bytes);
          break;
        } catch { /* A missing screenshot uses the generated card. */ }
      }
      projects.push({ name: projectsConfig.displayNames[slug] ?? repo.name[0].toUpperCase() + repo.name.slice(1), slug, description: repo.description, homepage: repo.homepage || null,
        languages,
        stars: repo.stargazers_count, pushed_at: repo.pushed_at, readme,
        descriptor, about, benchmarks: benchmarks(readme), demos, image });
      console.log(`Fetched ${repo.name}: ${about.length} intro paragraphs, ${demos.length} verified demos, ${image ? 'screenshot' : 'card'}`);
    }
  }));
  projects.sort((a, b) => {
    const ai = projectsConfig.order.indexOf(a.slug), bi = projectsConfig.order.indexOf(b.slug);
    if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : Infinity) - (bi >= 0 ? bi : Infinity);
    return b.stars - a.stars || b.pushed_at.localeCompare(a.pushed_at) || a.slug.localeCompare(b.slug);
  });
  audit.sort((a, b) => a.repo.localeCompare(b.repo));
  await mkdir('src/data', { recursive: true });
  const destination = 'src/data/projects.generated.json';
  sources.sort((a, b) => a.slug.localeCompare(b.slug));
  await writeFile(`${destination}.tmp`, JSON.stringify({ fetchedAt: new Date().toISOString(), audit, sources, projects }, null, 2) + '\n');
  await rename(`${destination}.tmp`, destination);
  console.table(audit.map(row => ({ Repository: row.repo, Decision: row.included ? 'included' : 'excluded', Reason: row.reason })));
  console.table(projects.map(project => ({ Name: project.name, Descriptor: project.descriptor || '(name only: force-included)' })));
  const empty = projects.filter(project => !project.descriptor);
  console.log(`Rows: ${projects.length}. Empty descriptors: ${empty.map(project => project.name).join(', ') || 'none'}. Ellipsis descriptors: ${projects.filter(project => project.descriptor.endsWith('…')).length}.`);
}
if (process.argv[1]?.endsWith('generate-projects.ts')) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
