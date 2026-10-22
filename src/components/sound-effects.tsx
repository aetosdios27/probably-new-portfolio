"use client";

import { useEffect } from "react";
import { cue } from "@/lib/sound";

const INTERACTIVE = "a[href], button, [role='button']";

function isBack(element: HTMLElement) {
  return /^\s*(←|back\b)/i.test(element.getAttribute("aria-label") ?? element.textContent ?? "");
}

function isExternal(anchor: HTMLAnchorElement) {
  return anchor.target === "_blank" || anchor.origin !== location.origin;
}

// Sound is a response to a deliberate act, so only clicks and key activations make any. Hovering,
// moving the pointer and scrolling stay silent. Links between pages get the "navigate" whoosh (falling
// for a way back), links out of the site and buttons get a light tap, and the dock's own sound switch
// (marked data-sound) handles itself. Nothing here marks up individual components.
export function SoundEffects() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>(INTERACTIVE);
      if (!target || target.closest("[data-sound]") || target.querySelector("[data-sound]") || target.matches(":disabled, [aria-disabled='true']")) return;
      const pointer = (event as PointerEvent).pointerType;
      const input = event.detail === 0 || !pointer ? "keyboard" : pointer === "touch" || pointer === "pen" ? pointer : "mouse";
      if (target instanceof HTMLAnchorElement && !isExternal(target) && !target.hash) {
        cue("navigate", { direction: isBack(target) ? "back" : "forward", emphasis: "subtle" }, "navigate", 300);
      } else if (target instanceof HTMLAnchorElement && !isExternal(target)) {
        cue("select", { emphasis: "subtle", input }, "tap", 150);
      } else if (isBack(target)) {
        cue("navigate", { direction: "back", emphasis: "subtle" }, "navigate", 300);
      } else {
        cue("tap", { emphasis: "subtle", input }, "tap", 150);
      }
    }
    addEventListener("click", onClick, { capture: true });
    return () => removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
