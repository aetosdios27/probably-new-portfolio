import { FaGithub } from 'react-icons/fa6';
import { LuGlobe } from 'react-icons/lu';
import { EditorialLink, LinkLabel } from '@/components/editorial-link';
import { IconLink } from '@/components/icon-link';
import { repoUrl } from '@/lib/playground/projects';
import type { Project } from '@/lib/playground/types';
import styles from './playground.module.css';

type IndexProject = Pick<Project, 'name' | 'slug' | 'descriptor' | 'languages'> & { site: string | null };

const languagesOf = (project: IndexProject) => project.languages.slice(0, 2).join(' · ');

export function ProjectIndex({ projects, selected: selectedSlugs }: { projects: IndexProject[]; selected: string[] }) {
  const isFeatured = (project: IndexProject) => selectedSlugs.includes(project.slug);
  const selected = projects.filter(isFeatured);
  const more = projects.filter(project => !isFeatured(project));
  return <>
    {selected.length > 0 && <section className={styles.group} aria-labelledby="featured-heading">
      <h2 id="featured-heading" className={styles.heading}>Selected</h2>
      <ul className={`${styles.projectIndex} ${styles.featured}`}>
        {selected.map(project => <li key={project.slug}>
          <div className={styles.indexRow}>
            <span className={styles.indexName}>
              <EditorialLink href={`/playground/${project.slug}`}><LinkLabel>{project.name}</LinkLabel></EditorialLink>
            </span>
            <span className={styles.rowMeta}>
              {project.languages.length > 0 && <span className={styles.languages}>{languagesOf(project)}</span>}
              {project.site && <IconLink href={project.site} icon={LuGlobe} label="" external ariaLabel={`${project.name} website`} iconOnly />}
              <IconLink href={repoUrl(project.slug)} icon={FaGithub} label="" external ariaLabel={`${project.name} on GitHub`} iconOnly />
            </span>
            <span className={styles.descriptor}>{project.descriptor}</span>
          </div>
        </li>)}
      </ul>
    </section>}
    {more.length > 0 && <section className={styles.group} aria-labelledby="more-heading">
      <h2 id="more-heading" className={styles.heading}>More</h2>
      <ul className={`${styles.projectIndex} ${styles.more}`}>
        {more.map(project => <li key={project.slug}>
          <EditorialLink href={repoUrl(project.slug)} target="_blank" rel="noopener noreferrer" className={styles.indexRow}>
            <span className={styles.indexName}><LinkLabel>{project.name}</LinkLabel></span>
            {project.languages.length > 0 && <span className={styles.languages}>{languagesOf(project)}</span>}
          </EditorialLink>
        </li>)}
      </ul>
    </section>}
  </>;
}
