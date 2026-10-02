import Image from "next/image";
import { highlightProjects, identity } from "@/content/portfolio";
import { OpenSourceSection } from "@/components/open-source-section";
import { fractionalAge } from "./age";
import { IdentitySentence, LiveAge } from "./living-text";
import { DottedRule } from "./dotted-rule";
import { Crosshatch } from "./crosshatch";
import { DotMatrix } from "./dot-matrix";
import { PlaygroundLink } from "./playground-link";
import { ProjectLink } from "./project-link";
import styles from "./page.module.css";

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
      <section className={styles.highlights} aria-labelledby="highlights-heading">
        <DotMatrix className={`${styles.hatch} ${styles.leftHatch}`} />
        <DotMatrix className={`${styles.hatch} ${styles.rightHatch}`} />
        <DottedRule axis="horizontal" className={`${styles.rule} ${styles.topRule}`} />
        <DottedRule axis="horizontal" className={`${styles.rule} ${styles.bottomRule}`} />
        <h2 id="highlights-heading" className={styles.sectionHeading}>Selected Work</h2>
        <ul className={styles.projectList}>
          {highlightProjects.map((project) => (
            <li key={project.name} className={styles.projectRow}>
              <ProjectLink name={project.name} href={project.href} context={project.context} />
              {project.date ? <time dateTime={project.date}>{project.label}</time> : <span className={styles.projectStatus}>{project.label}</span>}
            </li>
          ))}
        </ul>
      </section>
      <OpenSourceSection />
    </main>
  );
}
