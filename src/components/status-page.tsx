import type { ReactNode } from "react";
import { PageFrame } from "@/components/page-frame";
import type { DitherTheme } from "@/lib/dither-themes";
import styles from "./status-page.module.css";

export function StatusPage({
  dither,
  eyebrow,
  title,
  description,
  children,
}: {
  dither: DitherTheme;
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <PageFrame className={styles.page} gutters={dither}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h1 className={styles.title}>{title}</h1>
      {description ? <p className={styles.description}>{description}</p> : null}
      {children}
    </PageFrame>
  );
}
