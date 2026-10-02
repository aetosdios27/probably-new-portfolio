"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { useState, type ReactElement } from "react";
import styles from "./context-tooltip.module.css";

export function ContextTooltip({
  content,
  children,
  side = "left",
  delayDuration = 350,
}: {
  content: string;
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip.Provider delayDuration={delayDuration} skipDelayDuration={0}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className={styles.content}
            side={side}
            sideOffset={8}
            collisionPadding={16}
            aria-hidden={open ? undefined : true}
          >
            {content}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
