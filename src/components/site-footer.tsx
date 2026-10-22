"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { PixelSound } from "@/components/pixel-sound";
import { identity } from "@/content/portfolio";
import { soundEnabled, subscribeSound, toggleSound } from "@/lib/sound";
import styles from "./site-footer.module.css";

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Rendered on the client only, so the server markup never carries a stale time.
function LocalTime() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(clock.format(new Date()));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={styles.time}>
      <span className={styles.dot} aria-hidden="true" />
      <time suppressHydrationWarning>{now ?? "--:--"}</time>
      <span className={styles.timeLabel}>IST</span>
    </span>
  );
}

function SoundSwitch() {
  const on = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  return (
    <button type="button" className={styles.sound} role="switch" aria-checked={on} data-sound="switch" onClick={toggleSound}>
      <PixelSound on={on} className={on ? styles.soundOn : ""} />
      <span>Sound <span className={styles.state}>{on ? "on" : "off"}</span></span>
    </button>
  );
}

function toTop() {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

// The dock already carries every contact link, so the footer repeats none of them: it is only the
// site's quiet status line.
export function SiteFooter() {
  return (
    <footer className={styles.strip}>
      <div className={styles.status}>
        <SoundSwitch />
        <LocalTime />
      </div>
      <div className={styles.end}>
        <span>© {new Date().getFullYear()} {identity.name}</span>
        <button type="button" className={styles.top} onClick={toTop} data-cuelume-navigate="" data-cuelume-emphasis="subtle">
          Top <span aria-hidden="true">↑</span>
        </button>
      </div>
    </footer>
  );
}
