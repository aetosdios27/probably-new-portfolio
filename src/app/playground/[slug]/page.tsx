import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProjects, getProject } from '@/lib/playground/projects';
import { formatDelta } from '@/lib/playground/display';
import { SectionBreak } from '@/components/section-break';
import { EditorialLink, LinkLabel } from '@/components/editorial-link';
import { PlaygroundFrame } from '../frame';
import styles from '../playground.module.css';

export const dynamicParams = false;
export function generateStaticParams() { return getProjects().map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const project = getProject((await params).slug);
  if (!project) notFound();
  return { title: { absolute: `${project.name} | playground` }, description: project.descriptor };
}
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const project = getProject((await params).slug);
  if (!project) notFound();
  return <PlaygroundFrame>
    <h1 className={styles.title}>{project.name}</h1>
    {project.about.length > 0 && <><SectionBreak /><section className={styles.section} aria-labelledby="about-heading">
      <h2 id="about-heading" className={styles.heading}>About</h2>
      <div className={styles.prose}>{project.about.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    </section></>}
    {project.benchmarks?.length ? <><SectionBreak /><section className={styles.section} aria-labelledby="benchmarks-heading">
      <h2 id="benchmarks-heading" className={styles.heading}>Benchmarks</h2>
      <dl className={styles.index}>{project.benchmarks.map((row, index) => <div key={index} className={styles.metricRow}>
        <dt>{row.label}</dt><dd className={styles.measurement}>
          {row.baseline !== null && <><span>{row.baseline}</span><span aria-label="to"> → </span></>}
          <span>{row.result}</span>{row.delta !== null && <span className={styles.delta}> {formatDelta(row.delta)}</span>}
        </dd>
      </div>)}</dl>
    </section></> : null}
    {project.demos.length > 0 && <><SectionBreak /><section className={styles.section} aria-labelledby="demo-heading">
      <h2 id="demo-heading" className={styles.heading}>Demo</h2>
      <ul className={styles.index}>{project.demos.map(link => <li key={link.url}>
        <EditorialLink href={link.url} target="_blank" rel="noopener noreferrer" className={styles.demoRow}>
          <LinkLabel>{link.label}</LinkLabel><span className={styles.descriptor}>{new URL(link.url).host}</span>
        </EditorialLink>
      </li>)}</ul>
    </section></>}
  </PlaygroundFrame>;
}
