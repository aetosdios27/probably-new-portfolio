import type { Project } from './types';
export function heroDelta(project: Pick<Project, 'benchmarks'>) {
  return project.benchmarks?.filter(row => row.delta !== null).sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))[0]?.delta ?? null;
}
export function formatDelta(delta: number) { return `${delta > 0 ? '+' : ''}${delta}%`; }
