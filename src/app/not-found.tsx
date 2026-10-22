import type { Metadata } from "next";
import { EditorialLink, LinkLabel } from "@/components/editorial-link";
import { StatusPage } from "@/components/status-page";
import styles from "@/components/status-page.module.css";
import { PAGE_DITHERS } from "@/lib/dither-themes";

export const metadata: Metadata = { title: "Not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return <StatusPage dither={PAGE_DITHERS.notFound} eyebrow="404" title="This page does not exist." description="The link may be out of date, or the page may have moved.">
    <EditorialLink className={styles.action} href="/"><LinkLabel arrow={false}>Back to the homepage</LinkLabel></EditorialLink>
  </StatusPage>;
}
