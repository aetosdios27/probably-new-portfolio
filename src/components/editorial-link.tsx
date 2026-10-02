import Link from "next/link";
import type { ComponentPropsWithRef, ReactNode } from "react";
import styles from "./editorial-link.module.css";

export function EditorialLink({ href, className = "", children, ...props }: ComponentPropsWithRef<"a"> & { href: string }) {
  return <Link href={href} className={`${styles.link} ${className}`} {...props}>{children}</Link>;
}

export function LinkLabel({ children }: { children: ReactNode }) {
  return (
    <span className={styles.label}>
      <span className={styles.name}>{children}</span>
      <svg className={styles.arrow} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
        <path d="M3 9 9 3M3.5 3H9v5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
