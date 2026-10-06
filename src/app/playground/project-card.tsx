import type { Project } from '@/lib/playground/types';
import { formatDelta, heroDelta } from '@/lib/playground/display';
import styles from './playground.module.css';

export function ProjectCard({ project }: { project: Pick<Project, 'name' | 'languages' | 'benchmarks'> }) {
  const delta = heroDelta(project);
  return <div className={styles.card} aria-hidden="true">
    <span className={styles.cardName}>{project.name}</span>
    <span className={styles.languages}>{project.languages.slice(0, 2).join(' · ')}</span>
    {delta !== null && <span className={styles.delta}>{formatDelta(delta)}</span>}
  </div>;
}
