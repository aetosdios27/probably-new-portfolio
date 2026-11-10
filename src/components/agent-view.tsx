import type { ReactNode } from "react";
import { getAgentMarkdown, SITE_URL } from "@/lib/agent-document";
import { AgentControls } from "./agent-controls";
import styles from "./agent-view.module.css";

const LINKABLE = /(https?:\/\/[^\s)<>\]]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

// The markdown stays exactly as written, character for character; only its URLs and addresses
// become clickable for a person reading it.
function linkify(markdown: string): ReactNode[] {
  return markdown.split(LINKABLE).map((part, index) => {
    if (index % 2 === 0) return part;
    const href = part.includes("@") && !part.startsWith("http") ? `mailto:${part}` : part;
    return <a key={index} href={href} className={styles.link}>{part}</a>;
  });
}

// The whole site as markdown, in every page's HTML. Hidden until AI mode, and readable by any agent
// that scrapes the page instead of asking for /index.md.
export async function AgentView() {
  const markdown = await getAgentMarkdown();
  return (
    <section className={`agent-view ${styles.view}`} aria-label="This site as markdown, for AI agents">
      <AgentControls markdown={markdown} siteUrl={SITE_URL} />
      <pre className={styles.markdown}>{linkify(markdown)}</pre>
    </section>
  );
}
