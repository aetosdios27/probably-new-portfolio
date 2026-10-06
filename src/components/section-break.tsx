import styles from "./construction.module.css";

export function SectionBreak({ cap }: { cap?: "top" | "bottom" }) {
  return <div className={`${styles.break} ${cap ? styles[cap] : ""}`} aria-hidden="true" />;
}
