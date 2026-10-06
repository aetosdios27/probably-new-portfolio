import type { Project } from '@/lib/playground/types';
const fieldOverrides: Record<string, Partial<Omit<Project, 'slug'>>> = {};

// Explicit editorial ranking; unlisted qualifying projects follow by stars,
// then pushed_at. Only these settings control the published shortlist.
export const projectsConfig: {
  order: string[];
  hidden: string[];
  forceInclude: string[];
  excludePatterns: RegExp[];
  descriptors: Record<string, string>;
  displayNames: Record<string, string>;
  overrides: Record<string, Partial<Omit<Project, 'slug'>>>;
} = {
  order: ['kiban', 'kurogane', 'styx', 'scribe', 'raijin', 'susano', 'shiden', 'konto', 'iris', 'webnotes'],
  hidden: ['homebrew-axiom', 'axiom-registry'],
  forceInclude: ['kiban', 'kurogane', 'styx', 'scribe', 'raijin', 'susano', 'konto', 'iris', 'shiden', 'webnotes'],
  excludePatterns: [/clone$/i, /notes/i, /landing-page/i, /-site$/i, /portfolio/i, /solution/i, /cohort/i, /^cp-/i, /^learning-/i, /logs?$/i],
  descriptors: {},
  displayNames: {},
  // Deep-dive fields can still be overridden individually.
  get overrides() {
    const merged = { ...fieldOverrides };
    for (const [slug, descriptor] of Object.entries(this.descriptors)) merged[slug] = { ...merged[slug], descriptor };
    for (const [slug, name] of Object.entries(this.displayNames)) merged[slug] = { ...merged[slug], name };
    return merged;
  },
};
