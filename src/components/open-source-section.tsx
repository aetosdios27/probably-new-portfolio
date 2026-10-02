import Image from "next/image";
import { getOpenSourceContributions } from "@/lib/open-source";
import { EditorialLink, LinkLabel } from "./editorial-link";
import styles from "./open-source-section.module.css";

export async function OpenSourceSection() {
  const contributions = await getOpenSourceContributions();
  return (
    <section className={styles.section} aria-labelledby="open-source-heading">
      <h2 id="open-source-heading" className={styles.heading}>Open source</h2>
      <ul className={styles.list}>
        {contributions.map((contribution) => (
          <li key={contribution.href}>
            <EditorialLink className={styles.row} href={contribution.href}>
              <span className={styles.repository}>
                <Image className={styles.logo} src={`/images/organizations/${contribution.organization}.png`} width={13} height={13} alt="" />
                <LinkLabel>{contribution.name}</LinkLabel>
              </span>
              <span className={styles.description}>{contribution.description}</span>
              <span className={styles.metadata}>#{contribution.number} · {contribution.status}</span>
            </EditorialLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
