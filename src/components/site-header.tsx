"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const routes = [{ label: "Work", href: "/" }, { label: "About", href: "/about" }, { label: "Dispatches", href: "/dispatches" }];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Pushpendra Singh, home">Pushpendra Singh<span className="wordmark-dot" aria-hidden="true">.</span></Link>
      <nav aria-label="Primary navigation">
        {routes.map(({ label, href }) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
    </header>
  );
}
