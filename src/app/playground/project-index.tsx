'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { EditorialLink, LinkLabel } from '@/components/editorial-link';
import type { Project } from '@/lib/playground/types';
import { ProjectCard } from './project-card';
import styles from './playground.module.css';

type PreviewProject = Pick<Project, 'name' | 'slug' | 'descriptor' | 'image' | 'languages' | 'benchmarks'>;
export function ProjectIndex({ projects }: { projects: PreviewProject[] }) {
  const [active, setActive] = useState<PreviewProject | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const position = useRef({ x: 0, y: 0 });
  const frame = useRef(0);
  function place(x: number, y: number) {
    position.current = { x, y };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const node = preview.current;
      if (!node) return;
      const width = node.offsetWidth, height = node.offsetHeight;
      const { x, y } = position.current;
      node.style.transform = `translate3d(${Math.max(8, Math.min(x + 16, innerWidth - width - 8))}px, ${Math.max(8, Math.min(y + 16, innerHeight - height - 8))}px, 0)`;
    });
  }
  function show(project: PreviewProject, x: number, y: number) {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    setActive(project); place(x, y);
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return <>
    <ul className={`${styles.index} ${styles.projectIndex}`}>
      {projects.map(project => <li key={project.slug}>
        <EditorialLink href={`/playground/${project.slug}`} className={styles.indexRow}
          onPointerEnter={event => { if (event.pointerType === 'mouse') show(project, event.clientX, event.clientY); }}
          onPointerMove={event => place(event.clientX, event.clientY)}
          onPointerLeave={() => setActive(null)}
          onFocus={event => { const rect = event.currentTarget.getBoundingClientRect(); show(project, rect.right, rect.top); }}
          onBlur={() => setActive(null)}>
          <LinkLabel>{project.name}</LinkLabel>
          <span className={styles.descriptor}>{project.descriptor}</span>
        </EditorialLink>
      </li>)}
    </ul>
    {active && createPortal(<div ref={preview} className={styles.preview} aria-hidden="true">
      {active.image ? <Image src={active.image} alt="" width="220" height="140" /> : <ProjectCard project={active} />}
    </div>, document.body)}
  </>;
}
