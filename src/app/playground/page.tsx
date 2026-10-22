import type { Metadata } from 'next';
import { getProjects, isComingSoon, siteUrl } from '@/lib/playground/projects';
import { projectsConfig } from '@/data/projects.config';
import { PlaygroundFrame } from './frame';
import { ProjectIndex } from './project-index';
import styles from './playground.module.css';
import { PAGE_DITHERS } from '@/lib/dither-themes';

const playgroundDescription = 'Selected projects and experiments by aetos, with descriptions, benchmarks, and links.';
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aetosdios.xyz';
const shareImage = { url: new URL('/opengraph-image', siteOrigin).toString(), width: 1200, height: 630, alt: 'Pushpendra Singh, aetos — systems engineer' };

export const metadata: Metadata = {
  title: { absolute: 'playground' },
  description: playgroundDescription,
  alternates: { canonical: '/playground' },
  openGraph: {
    type: 'website',
    siteName: 'aetos',
    title: 'playground — aetos',
    description: playgroundDescription,
    locale: 'en_US',
    images: [shareImage],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@aetosdios_',
    site: '@aetosdios_',
    title: 'playground — aetos',
    description: playgroundDescription,
    images: [shareImage],
  },
};
export default function PlaygroundPage() {
  const projects = getProjects().map(project => ({ name: project.name, slug: project.slug, descriptor: project.descriptor, languages: project.languages, site: siteUrl(project), soon: isComingSoon(project.slug) }));
  return <PlaygroundFrame dither={PAGE_DITHERS.playground}>
    <section className={styles.section} aria-labelledby="playground-heading">
      <h1 id="playground-heading" className={`${styles.title} ${styles.indexTitle}`}>Playground</h1>
      <ProjectIndex projects={projects} selected={projectsConfig.selected} />
    </section>
  </PlaygroundFrame>;
}
