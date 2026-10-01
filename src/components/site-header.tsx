"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const routes = [{ label: "Work", href: "/" }, { label: "About", href: "/about" }, { label: "Dispatches", href: "/dispatches" }];

function RouteNavigation({ label }: { label: string }) {
  const pathname = usePathname();
  return <nav aria-label={label}>
    {routes.map(({ label: title, href }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{title}</Link>)}
  </nav>;
}

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/about") return null;

  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Pushpendra Singh, home">Pushpendra Singh<span className="wordmark-dot" aria-hidden="true">.</span></Link>
      <RouteNavigation label="Primary navigation" />
    </header>
  );
}
