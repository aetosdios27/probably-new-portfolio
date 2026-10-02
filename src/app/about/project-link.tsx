import styles from "./project-link.module.css";
import { EditorialLink, LinkLabel } from "@/components/editorial-link";
import { ContextTooltip } from "@/components/context-tooltip";

export function ProjectLink({ name, href, context }: { name: string; href: string | null; context: string }) {
  if (!href) return (
    <ContextTooltip content={context}>
      <span className={`${styles.link} ${styles.pending}`} role="link" aria-disabled="true" tabIndex={0}>{name}</span>
    </ContextTooltip>
  );

  return (
    <ContextTooltip content={context}>
      <EditorialLink href={href} className={styles.link}><LinkLabel>{name}</LinkLabel></EditorialLink>
    </ContextTooltip>
  );
}
