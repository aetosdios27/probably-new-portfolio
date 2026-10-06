export type Benchmark = { label: string; baseline: string | null; result: string; delta: number | null; source: string };
export type Demo = { label: string; url: string };
export type Project = {
  name: string; slug: string; description: string | null; homepage: string | null;
  languages: string[]; stars: number; pushed_at: string; readme: string;
  descriptor: string; about: string[]; benchmarks: Benchmark[] | null;
  demos: Demo[]; image: string | null;
};
export type Provenance = Record<keyof Project, "github" | "override">;
export type RenderedProject = Project & { provenance: Provenance };
