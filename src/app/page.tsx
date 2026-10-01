import Image from "next/image";
import { BrandIcon, PullRequestIcon } from "@/components/icons";
import { ContributionHeatmap } from "@/components/contribution-heatmap";
import { identity, openSource, playground, selectedWork, socialLinks } from "@/content/portfolio";

export default function WorkPage() {
  return (
    <main id="main">
      <section className="intro" aria-labelledby="intro-heading">
        <div className="identity-row">
          <Image src={identity.avatar} alt="Pushpendra's GitHub profile picture" width={60} height={60} priority className="profile-picture" />
          <div>
            <h1 id="intro-heading">{identity.intro}</h1>
            <p>{identity.descriptor}</p>
          </div>
        </div>
        <ul className="utility-links" aria-label="Connect and resources">
          {socialLinks.map(link => (
            <li key={link.label}>
              {link.href ? <a className="text-link" href={link.href}><BrandIcon name={link.icon} />{link.label}</a> : <span className="pending-link" title={`${link.label} link to be added`}><BrandIcon name={link.icon} />{link.label}<span className="sr-only"> — link to be added</span></span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="work-section" aria-labelledby="work-heading">
        <div className="section-heading"><h2 id="work-heading">Selected Work</h2></div>
        <ul className="project-index">
          {selectedWork.map(project => (
            <li key={project.name}>
              <a className="project-index-link" href={project.href}>
                <span className="project-index-copy"><span className="project-index-title">{project.name}</span><span className="project-index-description">{project.description}</span></span>
                <span className="index-year">{project.year}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="open-source-section" aria-labelledby="oss-heading">
        <div className="section-heading"><h2 id="oss-heading">Open Source</h2><span>A few contributions</span></div>
        <ul className="contribution-list">
          {openSource.map(item => <li key={item.number}><a className="contribution-row" href={item.href}><span className="repository-name">{item.name}</span><span className="contribution-description">{item.description}</span><span className="contribution-status"><PullRequestIcon /><span>{item.status}</span><span className="sr-only"> pull request #{item.number}</span></span></a></li>)}
        </ul>
      </section>

      <section className="playground-section" aria-labelledby="playground-heading">
        <div className="section-heading"><h2 id="playground-heading">{playground.title}</h2></div>
        <ul className="quiet-index">
          {playground.projects.map(project => <li key={project.name}><a className="quiet-index-link" href={project.href}><span><span className="quiet-index-title">{project.name}</span><span className="quiet-index-description">{project.description}</span></span><span className="index-year">{project.year}</span></a></li>)}
        </ul>
      </section>
      <ContributionHeatmap />
    </main>
  );
}
