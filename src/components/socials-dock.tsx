"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FaGithub, FaLinkedinIn, FaXTwitter } from "react-icons/fa6";
import { LuArrowLeft, LuCalendarDays, LuMail } from "react-icons/lu";
import { Dock, DockIcon, DockItem, DockLabel } from "./ui/dock";
import styles from "./socials-dock.module.css";

// Contact destinations: edit only here. All placeholders have been resolved
// from the previous portfolio and the already-verified local profile data.
const CONTACT = {
  github: "https://github.com/aetosdios27",
  x: "https://x.com/aetosdios27",
  linkedin: "https://linkedin.com/in/pushpendra-singh-2ba7b9312",
  email: "aetosdios27@gmail.com",
  call: "https://cal.com/aetosdios/15min",
};

const ITEMS = [
  { label: "GitHub", href: CONTACT.github, Icon: FaGithub },
  { label: "X", href: CONTACT.x, Icon: FaXTwitter },
  { label: "LinkedIn", href: CONTACT.linkedin, Icon: FaLinkedinIn },
  { label: "Mail", href: `mailto:${CONTACT.email}`, Icon: LuMail },
  { label: "Book a call", href: CONTACT.call, Icon: LuCalendarDays },
];
const HISTORY_KEY = "__portfolioDock";
export function SocialsDock() {
  const pathname = usePathname();
  const router = useRouter();
  const showBack = pathname !== "/";
  const documentId = useRef<string | null>(null);

  useEffect(() => {
    // A fresh document starts with zero trusted history, even after a reload.
    // Next's state is preserved; our marker identifies only same-document
    // pushes. Referrers and history.length cannot establish a safe predecessor.
    // Keep the identity stable through React's development effect replay.
    const id = documentId.current ??= crypto.randomUUID();
    let index = 0;
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const initial = { ...history.state, [HISTORY_KEY]: { id, index } };
    originalReplace.call(history, initial, "");
    const push: History["pushState"] = function (this: History, data, unused, url) {
      const current = history.state?.[HISTORY_KEY];
      index = current?.id === id ? current.index : 0;
      const internal = url != null && new URL(url, location.href).origin === location.origin;
      const entry = internal ? { id, index: ++index } : { id, index: 0 };
      originalPush.call(this, { ...data, [HISTORY_KEY]: entry }, unused, url);
    };
    const replace: History["replaceState"] = function (this: History, data, unused, url) {
      // Next may replace state while handling popstate, before our listener.
      // Read the popped entry itself instead of stamping the departing index.
      const current = history.state?.[HISTORY_KEY];
      index = current?.id === id ? current.index : 0;
      originalReplace.call(this, { ...data, [HISTORY_KEY]: { id, index } }, unused, url);
    };
    const pop = () => {
      const entry = history.state?.[HISTORY_KEY];
      index = entry?.id === id ? entry.index : 0;
    };
    history.pushState = push;
    history.replaceState = replace;
    addEventListener("popstate", pop);
    return () => {
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace) history.replaceState = originalReplace;
      removeEventListener("popstate", pop);
    };
  }, []);

  function goBack() {
    const entry = history.state?.[HISTORY_KEY];
    if (entry?.id === documentId.current && entry.index > 0) router.back();
    else router.replace("/");
  }

  return (
    <nav className={styles.position} aria-label="socials"
      onKeyDown={event => {
        // Native DockItem supplies a focusable role=button. Activate its
        // existing click action for Enter/Space without changing the primitive.
        if ((event.key === "Enter" || event.key === " ") && (event.target as HTMLElement).getAttribute("role") === "button") {
          event.preventDefault();
          (event.target as HTMLElement).click();
        }
      }}>
      <Dock className={styles.colors}>
        {showBack && <DockItem className="aspect-square" onClick={goBack}>
          <DockLabel>Back</DockLabel>
          <DockIcon><LuArrowLeft role="img" aria-label="Back" className="h-full w-full" /></DockIcon>
        </DockItem>}
        {ITEMS.map(({ label, href, Icon }) => (
          <DockItem key={label} className="aspect-square" onClick={() => {
            if (href.startsWith("mailto:")) location.href = href;
            else window.open(href, "_blank", "noopener,noreferrer");
          }}>
            <DockLabel>{label}</DockLabel>
            <DockIcon><Icon role="img" aria-label={label} className="h-full w-full" /></DockIcon>
          </DockItem>
        ))}
      </Dock>
    </nav>
  );
}
