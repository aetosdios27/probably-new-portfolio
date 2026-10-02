import { EditorialLink, LinkLabel } from "./editorial-link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Pushpendra Singh</span>
      <EditorialLink className="text-link" href="https://github.com/aetosdios27/probably-new-portfolio"><LinkLabel>View source</LinkLabel></EditorialLink>
    </footer>
  );
}
