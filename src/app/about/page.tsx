import type { Metadata } from "next";
import Image from "next/image";
import { identity } from "@/content/portfolio";
import { fractionalAge } from "./age";
import { IdentitySentence, LiveAge } from "./living-text";
import { DottedRule } from "./dotted-rule";
import { Crosshatch } from "./crosshatch";
import { PlaygroundLink } from "./playground-link";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "About" };
export default function AboutPage() {
  // Server snapshot keeps the initial HTML and hydration value identical;
  // the client owns subsequent clock updates.
  // eslint-disable-next-line react-hooks/purity
  const initialAge = fractionalAge(Date.now());
  return (
    <main id="main" className={styles.page}>
      <DottedRule axis="vertical" className={`${styles.rule} ${styles.leftRule}`} />
      <DottedRule axis="vertical" className={`${styles.rule} ${styles.rightRule}`} />
      <div className={styles.content}>
        <Crosshatch className={`${styles.hatch} ${styles.leftHatch}`} />
        <Crosshatch className={`${styles.hatch} ${styles.rightHatch}`} />
        <DottedRule axis="horizontal" className={`${styles.rule} ${styles.topRule}`} />
        <DottedRule axis="horizontal" className={`${styles.rule} ${styles.bottomRule}`} />
        <Image
          src={identity.avatar}
          alt="Pushpendra’s profile picture"
          width={40}
          height={40}
          className={styles.avatar}
        />

        <h1 className={styles.greeting}>Hello, <span lang="hi">नमस्ते</span></h1>

        <div className={styles.thoughts}>
          <p>
            <IdentitySentence />
          </p>
          <p><LiveAge initialAge={initialAge} /> years in. Currently a pre-final year CS undergrad by day, and a builder outside uni hours.</p>
          <p className={styles.invitation}>Explore my <PlaygroundLink /></p>
        </div>
      </div>
    </main>
  );
}
