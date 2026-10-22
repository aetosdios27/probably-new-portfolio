"use client";

import type { ReactNode } from "react";
import { hoverCancel, hoverIntent, lockedKnock } from "@/lib/hover-sound";
import { ContextTooltip } from "./context-tooltip";
import styles from "./soon-link.module.css";

// A link to something that is not public yet. It looks like its sibling icon links, but the address is
// blurred and nothing navigates; a tooltip on hover or keyboard focus says when to come back.
// With no label (the compact index) the icon itself is blurred.
export function SoonLink({ icon, label = "", ariaLabel }: { icon: ReactNode; label?: string; ariaLabel: string }) {
  const iconOnly = !label;
  return (
    <ContextTooltip content="Launching soon" side="top">
      <span className={`${styles.soon} ${iconOnly ? styles.iconOnly : ""}`.trim()} role="link" aria-disabled="true" aria-label={ariaLabel} tabIndex={0}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") hoverIntent("soon-link", lockedKnock); }}
        onPointerLeave={() => hoverCancel("soon-link")}>
        <span className={styles.icon} aria-hidden="true">{icon}</span>
        {!iconOnly && <span className={styles.label} aria-hidden="true">{label}</span>}
      </span>
    </ContextTooltip>
  );
}
