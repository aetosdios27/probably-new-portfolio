import styles from "./project-link.module.css";
import { EditorialLink, LinkLabel } from "@/components/editorial-link";
import { ContextTooltip } from "@/components/context-tooltip";

export function ProjectLink({ name, href, context }: { name: string; href: string; context: string }) {
  return (
    <ContextTooltip content={context}>
      <EditorialLink href={href} className={styles.link}><LinkLabel>{name}</LinkLabel></EditorialLink>
    </ContextTooltip>
  );
}
