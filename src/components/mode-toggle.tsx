"use client";

import { LuBot } from "react-icons/lu";
import { dockTick, hoverCancel, hoverIntent } from "@/lib/hover-sound";
import { centerOf, enterAiMode } from "@/lib/mode-transition";
import { DockIcon, DockItem, DockLabel } from "./ui/dock";
import styles from "./socials-dock.module.css";

/** The way into AI mode. The way out lives in AI mode itself, since the dock goes with everything else. */
export function ModeToggle({ index }: { index: number }) {
  const key = `dock-${index}`;
  return (
    <DockItem className="aspect-square" aria-label="AI mode: this site as plain markdown" data-cuelume-tap=""
      onHover={() => hoverIntent(key, () => dockTick(index))}
      onHoverEnd={() => hoverCancel(key)}
      onClick={(event) => enterAiMode(centerOf(event.currentTarget))}>
      <DockLabel>AI mode</DockLabel>
      <DockIcon><LuBot aria-hidden="true" className={styles.icon} /></DockIcon>
    </DockItem>
  );
}
