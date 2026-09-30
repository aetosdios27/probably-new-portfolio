import Image from "next/image";
import { BrandIcon, ExternalArrow, PullRequestIcon } from "@/components/icons";
import { ContributionHeatmap } from "@/components/contribution-heatmap";
import { furtherWork, identity, openSource, playground, selectedWork, socialLinks } from "@/content/portfolio";

export default function WorkPage() {
  const [featured, ...projects] = selectedWork;
  return (
    <main id="main">
      <section className="intro" aria-labelledby="intro-heading">
        <div className="identity-row">
          <Image src={identity.avatar} alt="Pushpendra's GitHub profile picture" width={52} height={52} priority className="profile-picture" />
          <div>
            <h1 id="intro-heading">{identity.intro}</h1>
            <p>{identity.descriptor}</p>
          </div>
        </div>
        <ul className="utility-links" aria-label="Connect and resources">
          {socialLinks.map(link => (
            <li key={link.label}>
              {link.href ? <a className="text-link" href={link.href}><BrandIcon name={link.icon} />{link.label}<ExternalArrow /></a> : <span className="pending-link" title={`${link.label} link to be added`}><BrandIcon name={link.icon} />{link.label}<span className="sr-only"> — link to be added</span></span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="work-section" aria-labelledby="work-heading">
        <div className="section-heading"><h2 id="work-heading">Selected Work</h2><span>01 — 04</span></div>
        <article className="featured-project">
          <div className="project-eyebrow"><span>01</span><span>Storage / {featured.language}</span></div>
          <h3><a className="project-title-link" href={featured.href}>{featured.name}<ExternalArrow /></a></h3>
          <p className="featured-description">{featured.description}</p>
          <p className="project-context">{featured.context}</p>
          <dl className="engineering-notes">
            <div><dt>Durability</dt><dd>Write-ahead logging.<br />Recovery after interruption.</dd></div>
            <div><dt>Storage</dt><dd>Sorted tables.<br />Leveled compaction.</dd></div>
            <div><dt>Concurrency</dt><dd>Snapshot isolation.<br />Gate-free reads.</dd></div>
          </dl>
          <details className="project-details">
            <summary>A closer look <span className="details-indicator" aria-hidden="true" /></summary>
            <div className="details-body"><p>Writes reach a write-ahead log, then an in-memory memtable. Flushes produce sorted tables; compaction merges them while preserving versions that active snapshots still need.</p><p>Deterministic fault injection checks recovery at syscall boundaries. Durability is claimed only after a successful sync.</p><p>In a 16-thread benchmark with 90% reads and 10% writes, replacing engine-wide read gating with an atomically published ReadView increased GET throughput from 468K to 4.22M per second. These are workload-specific results, documented in the project.</p><a className="text-link" href={`${featured.href}#architecture`}>Read the architecture <ExternalArrow /></a></div>
          </details>
        </article>
        <div className="selected-projects">
          {projects.map((project, i) => (
            <article key={project.name} className="project-row">
              <span className="project-number" aria-hidden="true">0{i + 2}</span>
              <div>
                <div className="project-row-heading"><h3><a className="project-title-link" href={project.href}>{project.name}<ExternalArrow /></a></h3>{project.language && <span className="project-language">{project.language}</span>}</div>
                <p className="project-description">{project.description}</p>
                {project.context && <p className="project-context">{project.context}</p>}
              </div>
            </article>
          ))}
        </div>
        <div className="further-work">
          <p className="further-work-label">Also built</p>
          <ul>{furtherWork.map(project => <li key={project.name}><a className="further-work-row" href={project.href}><span>{project.name}</span><span>{project.description}</span><ExternalArrow /></a></li>)}</ul>
        </div>
      </section>

      <section className="open-source-section" aria-labelledby="oss-heading">
        <div className="section-heading"><h2 id="oss-heading">Open Source</h2><span>A few contributions</span></div>
        <ul className="contribution-list">
          {openSource.map(item => <li key={item.number}><a className="contribution-row" href={item.href}><span className="repository-name">{item.name}</span><span className="contribution-description">{item.description}</span><span className="contribution-status"><PullRequestIcon /><span>{item.status}</span><span className="sr-only"> pull request </span>#{item.number}</span><ExternalArrow /></a></li>)}
        </ul>
      </section>

      <section className="playground-section" aria-labelledby="playground-heading">
        <div className="section-heading"><h2 id="playground-heading">{playground.title}</h2><span>Always learning</span></div>
        <p className="section-description">{playground.description}</p>
        <div className="playground-grid">
          {playground.projects.map(project => <article key={project.name}><h3><a className="project-title-link" href={project.href}>{project.name}<ExternalArrow /></a></h3><p>{project.description}</p></article>)}
        </div>
      </section>
      <ContributionHeatmap />
    </main>
  );
}
