import type { ReactNode } from 'react';
import { PageFrame } from '@/components/page-frame';
import { SectionBreak } from '@/components/section-break';
import { SiteFooter } from '@/components/site-footer';
import type { DitherTheme } from '@/lib/dither-themes';
import styles from './playground.module.css';

export function PlaygroundFrame({ dither, children }: { dither: DitherTheme; children: ReactNode }) {
  return <PageFrame className={styles.page} gutters={dither}>{children}<SectionBreak /><SiteFooter /></PageFrame>;
}
