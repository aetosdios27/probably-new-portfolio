"use client";

import { useEffect } from "react";
import { EditorialLink, LinkLabel } from "@/components/editorial-link";
import { StatusPage } from "@/components/status-page";
import styles from "@/components/status-page.module.css";
import { PAGE_DITHERS } from "@/lib/dither-themes";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <StatusPage dither={PAGE_DITHERS.error} eyebrow="Error" title="Something went wrong." description="An unexpected error stopped this page from loading. Try again, or return to the homepage.">
    <div className={styles.actions}>
      <button type="button" onClick={() => retry()} className={styles.button}>Try again</button>
      <EditorialLink href="/"><LinkLabel arrow={false}>Back to the homepage</LinkLabel></EditorialLink>
    </div>
  </StatusPage>;
}
