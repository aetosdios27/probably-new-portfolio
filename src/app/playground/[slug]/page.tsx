import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getProjects, getProject, isSelected, repoUrl, siteUrl } from '@/lib/playground/projects';
import { FaGithub } from 'react-icons/fa6';
import { LuGlobe } from 'react-icons/lu';
import { IconLink, IconLinkRow } from '@/components/icon-link';
import { getRepoActivity } from '@/lib/repo-activity';
import { RepoActivity } from '@/components/repo-activity';
import { formatDelta } from '@/lib/playground/display';
import { SectionBreak } from '@/components/section-break';
import { EditorialLink, LinkLabel } from '@/components/editorial-link';
import { PlaygroundFrame } from '../frame';
import styles from '../playground.module.css';
import { projectDither } from '@/lib/dither-themes';

export const dynamicParams = false;
export function generateStaticParams() { return getProjects().map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const project = getProject((await params).slug);
  if (!project) notFound();
  const title = `${project.name} | playground`;
  return {
    title: { absolute: title },
    description: project.descriptor,
    alternates: { canonical: `/playground/${project.slug}` },
    openGraph: { title, description: project.descriptor, url: `/playground/${project.slug}` },
  };
}
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const project = getProject((await params).slug);
  if (!project) notFound();
  const projectMeta = project.languages.slice(0, 4).join(' · ');
  const site = siteUrl(project);
  const demos = project.demos.filter(({ url }) => !site || new URL(url).host !== new URL(site).host);
  const siteHost = site ? new URL(site).host : '';
  const activity = isSelected(project.slug) ? await getRepoActivity(project.slug) : [];
  return <PlaygroundFrame dither={projectDither(project.slug, activity)}>
    <header>
      <h1 className={`${styles.title} ${styles.detailTitle}`}>{project.name}</h1>
      {project.descriptor && <p className={styles.lede}>{project.descriptor}</p>}
      {projectMeta && <p className={`${styles.projectMeta} type-meta`}>{projectMeta}</p>}
      <IconLinkRow className={`${styles.projectLinks} type-meta`}>
        {site && <IconLink href={site} icon={LuGlobe} label={siteHost} external ariaLabel={`${project.name} website: ${siteHost}`} />}
        <IconLink href={repoUrl(project.slug)} icon={FaGithub} label="GitHub" external ariaLabel={`${project.name} on GitHub`} />
      </IconLinkRow>
      {project.image && <figure className={styles.hero}>
        <Image src={project.image} alt={`${project.name} preview`} width={620} height={400} />
      </figure>}
    </header>
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
    {demos.length > 0 && <><SectionBreak /><section className={styles.section} aria-labelledby="demo-heading">
      <h2 id="demo-heading" className={styles.heading}>Demo</h2>
      <ul className={styles.index}>{demos.map(link => <li key={link.url}>
        <EditorialLink href={link.url} target="_blank" rel="noopener noreferrer" className={styles.demoRow}>
          <LinkLabel>{link.label}</LinkLabel><span className={styles.descriptor}>{new URL(link.url).host}</span>
        </EditorialLink>
      </li>)}</ul>
    </section></>}
    {activity.length > 0 && <><SectionBreak /><RepoActivity name={project.name} repoUrl={repoUrl(project.slug)} items={activity} /></>}
  </PlaygroundFrame>;
}
