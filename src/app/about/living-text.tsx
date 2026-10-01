"use client";

import Scritto from "@scritto/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fractionalAge } from "./age";
import styles from "./page.module.css";

const NAME_TRANSITION = {
  duration: 240,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
};
const AGE_TRANSITION = { ...NAME_TRANSITION, duration: 160 };
const AGE_TAIL_INTERVAL = 1_200;

function IdentityName() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [toggled, setToggled] = useState(false);
  const pointerType = useRef("");
  const revealed = hovered || focused || toggled;

  return (
    <button
      type="button"
      className={styles.identity}
      aria-label="aetos is Pushpendra. Reveal my name"
      aria-pressed={revealed}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        setHovered(false);
        if (!event.currentTarget.matches(":focus-visible")) setFocused(false);
      }}
      onPointerDown={(event) => {
        pointerType.current = event.pointerType;
      }}
      onFocus={(event) => {
        // Touch focus must not override the word's tap-to-toggle behavior.
        setFocused(
          pointerType.current !== "touch" ||
            event.currentTarget.matches(":focus-visible"),
        );
      }}
      onBlur={() => {
        setFocused(false);
        setToggled(false);
        pointerType.current = "";
      }}
      onClick={(event) => {
        if (event.detail === 0) setFocused(true);
        else if (pointerType.current !== "mouse") setToggled((value) => !value);
      }}
    >
      <Scritto
        value={revealed ? "Pushpendra" : "aetos"}
        transition={NAME_TRANSITION}
        bounce={false}
        aria-hidden="true"
      />
    </button>
  );
}

export function IdentitySentence() {
  const prose = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const container = prose.current;
    if (!container) return;
    // Connect after hydration: Flow wraps ordinary text into word spans,
    // which must not mutate the server HTML before React hydrates it.
    const flow = document.createElement("scritto-flow");
    flow.append(...container.childNodes);
    container.append(flow);
    return () => {
      flow.remove();
      flow.querySelector("[data-wrap-clip]")?.remove();
      for (const word of flow.querySelectorAll("[data-word]")) {
        word.replaceWith(...word.childNodes);
      }
      container.append(...flow.childNodes);
    };
  }, []);

  // Keep this prose static: Scritto Flow owns its word spans, while only the
  // nested name updates. React never replaces Flow's surrounding text nodes.
  return (
    <span ref={prose}>
      I’m <IdentityName />, a systems engineer driven mostly by curiosity and an
      unreasonable attention to detail.
    </span>
  );
}

export function LiveAge({ initialAge }: { initialAge: string }) {
  const [age, setAge] = useState(initialAge);
  const initialAgeRef = useRef(initialAge);

  useEffect(() => {
    let sampledAge = initialAgeRef.current;
    let sampledAt = 0;
    const update = () => {
      if (document.hidden) return;
      const now = Date.now();
      const currentAge = fractionalAge(now);
      const prefix = currentAge.slice(0, -3);
      // Hold the final three places as one sample. Refresh on a carry too,
      // so a live prefix never gets paired with a stale decimal rollover.
      if (now - sampledAt >= AGE_TAIL_INTERVAL || prefix !== sampledAge.slice(0, -3)) {
        sampledAge = currentAge;
        sampledAt = now;
      }
      setAge(prefix + sampledAge.slice(-3));
    };
    const firstFrame = requestAnimationFrame(update);
    const timer = window.setInterval(update, 300);
    document.addEventListener("visibilitychange", update);
    return () => {
      cancelAnimationFrame(firstFrame);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <Scritto
      className={styles.age}
      value={age}
      trend={1}
      transition={AGE_TRANSITION}
      bounce={false}
      aria-live="off"
    />
  );
}
