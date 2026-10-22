import snapshot from '@/data/projects.generated.json';
import { projectsConfig } from '@/data/projects.config';
import type { Project, Provenance, RenderedProject } from './types';

export function getProjects(): RenderedProject[] {
  return (snapshot.projects as Project[]).filter(project => !projectsConfig.hidden.includes(project.slug))
    .map(project => {
      const override = projectsConfig.overrides[project.slug] ?? {};
      const provenance = Object.fromEntries(Object.keys(project).map(key => [key, Object.hasOwn(override, key) ? 'override' : 'github'])) as Provenance;
      return { ...project, ...override, provenance };
    }).sort((a, b) => {
      const ai = projectsConfig.order.indexOf(a.slug), bi = projectsConfig.order.indexOf(b.slug);
      if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : Infinity) - (bi >= 0 ? bi : Infinity);
      return b.stars - a.stars || b.pushed_at.localeCompare(a.pushed_at) || a.slug.localeCompare(b.slug);
    });
}
export function getSelectedProjects() { return getProjects().filter(project => isSelected(project.slug)); }
export function getProject(slug: string) { return getProjects().find(project => project.slug === slug); }

const OWNER = 'aetosdios27';
export function repoUrl(slug: string) { return `https://github.com/${OWNER}/${slug}`; }
export function isSelected(slug: string) { return projectsConfig.selected.includes(slug); }
export function siteUrl(project: Pick<Project, 'slug' | 'homepage'>) { return projectsConfig.sites[project.slug] ?? project.homepage ?? null; }
export function isComingSoon(slug: string) { return projectsConfig.comingSoon.includes(slug); }
