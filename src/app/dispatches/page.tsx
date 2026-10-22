import type { Metadata } from "next";
import { EditorialLink, LinkLabel } from "@/components/editorial-link";
import { StatusPage } from "@/components/status-page";
import styles from "@/components/status-page.module.css";
import { PAGE_DITHERS } from "@/lib/dither-themes";
export const metadata: Metadata = { title: "Dispatches", robots: { index: false, follow: false } };
export default function DispatchesPage() {
  return <StatusPage dither={PAGE_DITHERS.dispatches} eyebrow="Notes from the work" title="Dispatches" description="Engineering notes, build logs, and things learned along the way.">
    <div className={styles.empty}><p>Nothing published yet.</p><EditorialLink href="/"><LinkLabel>Meet the person</LinkLabel></EditorialLink></div>
  </StatusPage>;
}
