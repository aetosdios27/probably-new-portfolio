import { writeFile } from 'node:fs/promises';
import { projectsConfig } from '../src/data/projects.config';
import { fetchRepoActivity } from '../src/lib/repo-activity';

// Refreshes the fallback used when the GitHub API is unavailable at render time.
const slugs = projectsConfig.selected;
const result: Record<string, Awaited<ReturnType<typeof fetchRepoActivity>>> = {};
for (const slug of slugs) result[slug] = await fetchRepoActivity(slug);
await writeFile(new URL('../src/content/repo-activity-snapshot.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(`Snapshot written for ${slugs.join(', ')}`);
