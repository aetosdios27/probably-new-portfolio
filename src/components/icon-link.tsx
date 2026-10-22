import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import styles from "./icon-link.module.css";

type IconLinkBaseProps = {
  href: string;
  icon: IconType;
  label: ReactNode;
  external?: boolean;
  className?: string;
};

type IconLinkProps = IconLinkBaseProps & (
  | { iconOnly: true; ariaLabel: string }
  | { iconOnly?: false; ariaLabel?: string }
);

export function IconLink({ href, icon: Icon, label, external = false, ariaLabel, className = "", iconOnly = false }: IconLinkProps) {
  return (
    <a
      className={`${styles.link} ${iconOnly ? styles.iconOnly : ""} ${className}`.trim()}
      href={href}
      aria-label={ariaLabel}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      <span className={styles.icon} aria-hidden="true"><Icon /></span>
      {!iconOnly && <span className={styles.label}>{label}</span>}
    </a>
  );
}

export function IconLinkRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.row} ${className}`.trim()}>{children}</div>;
}
