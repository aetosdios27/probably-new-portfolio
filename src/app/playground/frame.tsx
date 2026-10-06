import type { ReactNode } from 'react';
import { SectionBreak } from '@/components/section-break';
import construction from '@/components/construction.module.css';
import styles from './playground.module.css';

export function PlaygroundFrame({ children }: { children: ReactNode }) {
  return <main id="main" className={`${styles.page} ${construction.frame}`}>
    <div aria-hidden="true" className={`${construction.rail} ${construction.leftRail}`} />
    <div aria-hidden="true" className={`${construction.rail} ${construction.rightRail}`} />
    <SectionBreak cap="top" />
    {children}
    <SectionBreak cap="bottom" />
  </main>;
}
