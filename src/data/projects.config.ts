import type { Project } from '@/lib/playground/types';
const fieldOverrides: Record<string, Partial<Omit<Project, 'slug'>>> = {};

// Explicit editorial ranking; unlisted qualifying projects follow by stars,
// then pushed_at. Only these settings control the published shortlist.
export const projectsConfig: {
  order: string[];
  selected: string[];
  sites: Record<string, string>;
  comingSoon: string[];
  hidden: string[];
  forceInclude: string[];
  excludePatterns: RegExp[];
  descriptors: Record<string, string>;
  displayNames: Record<string, string>;
  overrides: Record<string, Partial<Omit<Project, 'slug'>>>;
} = {
  order: ['kiban', 'kurogane', 'styx', 'scribe', 'webnotes', 'konto', 'raijin', 'susano', 'shiden', 'iris', 'axiom-core', 'folio'],
  // The expanded group on the Playground index, and the projects that show a GitHub activity list.
  selected: ['kiban', 'kurogane', 'styx', 'scribe', 'webnotes', 'konto'],
  // Deployed sites, found through each repo's homepage field or its separate website repo.
  sites: {
    kiban: 'https://kiban-website.vercel.app',
    scribe: 'https://scribeit.dev',
    webnotes: 'https://web-notes-lyart.vercel.app',
  },
  // Deployed sites that exist but are not public yet: shown blurred, with a "launching soon" tooltip.
  comingSoon: ['kiban'],
  hidden: ['homebrew-axiom', 'axiom-registry', 'aisc-project', 'kiban-website', 'vmrl', 'android-lab-project'],
  forceInclude: ['kiban', 'kurogane', 'styx', 'scribe', 'raijin', 'susano', 'konto', 'iris', 'shiden', 'webnotes'],
  excludePatterns: [/clone$/i, /notes/i, /landing-page/i, /-site$/i, /portfolio/i, /solution/i, /cohort/i, /^cp-/i, /^learning-/i, /logs?$/i],
  descriptors: {
    susano: 'An in-memory analytical database in C++23 under active development, with only a build and CTest smoke test so far.',
    shiden: 'A small Redis-compatible in-memory server in Go that speaks RESP2 over TCP with key expiry, built as a learning system.',
    kurogane: 'A from-scratch Rust implementation of Raft behind a replicated in-memory key/value state machine, now feature-frozen.',
    iris: 'A Linux image viewer in Rust on GTK4/libadwaita, with a Vulkan renderer, RAW support, and ICC-aware color conversion.',
    raijin: 'Deterministic distributed-system testing.',
  },
  displayNames: {
    'axiom-core': 'Axiom',
  },
  // Deep-dive fields can still be overridden individually.
  get overrides() {
    const merged = { ...fieldOverrides };
    for (const [slug, descriptor] of Object.entries(this.descriptors)) merged[slug] = { ...merged[slug], descriptor };
    for (const [slug, name] of Object.entries(this.displayNames)) merged[slug] = { ...merged[slug], name };
    return merged;
  },
};
