"use client";

import { useEffect } from "react";
import { bind } from "cuelume";
import { cue, soundEnabled } from "@/lib/sound";

const INTERACTIVE = "a[href], button, [role='button']";

function isBack(element: HTMLElement) {
  return /^\s*(←|back\b)/i.test(element.getAttribute("aria-label") ?? element.textContent ?? "");
}

const MARKED = "[data-cuelume-tap], [data-cuelume-select], [data-cuelume-toggle], [data-cuelume-open], [data-cuelume-close], [data-cuelume-navigate]";

// Marked controls own their material through Cuelume's delegated bindings.
// Unmarked links move through quiet air; ordinary buttons have a dry mechanical press.
export function SoundEffects() {
  useEffect(() => {
    soundEnabled();
    const unbind = bind();
    function onClick(event: MouseEvent) {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>(INTERACTIVE);
      if (!target || target.closest(MARKED) || target.closest("[data-sound]") || target.querySelector("[data-sound]") || target.matches(":disabled, [aria-disabled='true']")) return;
      const pointer = event instanceof PointerEvent ? event.pointerType : "";
      const input = event.detail === 0 || !pointer ? "keyboard" : pointer === "touch" || pointer === "pen" ? pointer : "mouse";
      if (target instanceof HTMLAnchorElement || isBack(target)) {
        cue("navigate", { direction: isBack(target) ? "back" : "forward", emphasis: "subtle", volume: 0.65 }, "navigate", 300);
      } else {
        cue("tap", { theme: "mech", emphasis: "subtle", input, volume: 0.65 }, "button", 150);
      }
    }
    addEventListener("click", onClick, { capture: true });
    return () => {
      unbind();
      removeEventListener("click", onClick, { capture: true });
    };
  }, []);
  return null;
}
