import Image from "next/image";
import { getOpenSourceContributions } from "@/lib/open-source";
import { EditorialLink, LinkLabel } from "./editorial-link";
import { ContextTooltip } from "./context-tooltip";
import styles from "./open-source-section.module.css";

export async function OpenSourceSection() {
  const contributions = await getOpenSourceContributions();
  return (
    <section aria-labelledby="open-source-heading">
      <h2 id="open-source-heading" className={styles.heading}>Open source</h2>
      <ul className={styles.list}>
        {contributions.map((contribution) => (
          <li key={contribution.href} className={styles.row}>
            <ContextTooltip content={contribution.description}>
              <EditorialLink className={styles.repository} href={contribution.href} aria-label={`${contribution.name} pull request #${contribution.number}, ${contribution.status}`}>
                <Image className={styles.logo} src={`/images/organizations/${contribution.organization}.png`} width={13} height={13} alt="" />
                <LinkLabel>{contribution.name}</LinkLabel>
              </EditorialLink>
            </ContextTooltip>
            <span className={styles.metadata}>#{contribution.number} · {contribution.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
