import type { Metadata } from 'next';
import { getProjects } from '@/lib/playground/projects';
import { PlaygroundFrame } from './frame';
import { ProjectIndex } from './project-index';
import { FallingIcons } from './falling-icons';
import { SectionBreak } from '@/components/section-break';
import styles from './playground.module.css';

export const metadata: Metadata = { title: { absolute: 'playground' } };
export default function PlaygroundPage() {
  const projects = getProjects().map(({ name, slug, descriptor, image, languages, benchmarks }) => ({ name, slug, descriptor, image, languages, benchmarks }));
  return <PlaygroundFrame>
    <section className={styles.section} aria-labelledby="playground-heading">
      <h1 id="playground-heading" className={styles.title}>Playground</h1>
      <ProjectIndex projects={projects} />
    </section>
    <SectionBreak />
    <FallingIcons />
  </PlaygroundFrame>;
}
