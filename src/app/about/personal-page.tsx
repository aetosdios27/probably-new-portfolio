import Image from "next/image";
import { highlightProjects, identity } from "@/content/portfolio";
import { OpenSourceSection } from "@/components/open-source-section";
import { GitHubActivity } from "@/components/github-activity";
import { fractionalAge } from "./age";
import { IdentitySentence, LiveAge } from "./living-text";
import { SectionBreak } from "@/components/section-break";
import construction from "@/components/construction.module.css";
import { PlaygroundLink } from "./playground-link";
import { ProjectLink } from "./project-link";
import styles from "./page.module.css";

export default function AboutPage() {
  // Server snapshot keeps the initial HTML and hydration value identical;
  // the client owns subsequent clock updates.
  // eslint-disable-next-line react-hooks/purity
  const initialAge = fractionalAge(Date.now());
  return (
    <main id="main" className={`${styles.page} ${construction.frame}`}>
      <div aria-hidden="true" className={`${construction.rail} ${construction.leftRail}`} />
      <div aria-hidden="true" className={`${construction.rail} ${construction.rightRail}`} />
      <SectionBreak cap="top" />
      <div className={styles.content}>
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
      <SectionBreak />
      <section className={styles.highlights} aria-labelledby="highlights-heading">
        <h2 id="highlights-heading" className={styles.sectionHeading}>Selected Work</h2>
        <ul className={styles.projectList}>
          {highlightProjects.map((project) => (
            <li key={project.name} className={styles.projectRow}>
              <ProjectLink name={project.name} href={project.href} context={project.context} />
              <time dateTime={project.year}>{project.year}</time>
            </li>
          ))}
        </ul>
      </section>
      <SectionBreak />
      <OpenSourceSection />
      <SectionBreak />
      <GitHubActivity />
      <SectionBreak cap="bottom" />
    </main>
  );
}
