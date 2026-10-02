import type { Metadata } from "next";
import { playground } from "@/content/portfolio";
import { EditorialLink, LinkLabel } from "@/components/editorial-link";

export const metadata: Metadata = { title: "Playground" };

export default function PlaygroundPage() {
  return (
    <main id="main" className="reading-page playground-page">
      <h1>{playground.title}</h1>
      <ul className="quiet-index">
        {playground.projects.map((project) => (
          <li key={project.name}>
            <EditorialLink className="quiet-index-link" href={project.href}>
              <span>
                <span className="quiet-index-title"><LinkLabel>{project.name}</LinkLabel></span>
                <span className="quiet-index-description">{project.description}</span>
              </span>
              <span className="index-year">{project.year}</span>
            </EditorialLink>
          </li>
        ))}
      </ul>
    </main>
  );
}
