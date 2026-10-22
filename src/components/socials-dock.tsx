"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FaGithub, FaLinkedinIn, FaXTwitter } from "react-icons/fa6";
import { LuArrowLeft, LuCalendarDays, LuDownload, LuMail } from "react-icons/lu";
import { Dock, DockIcon, DockItem, DockLabel } from "./ui/dock";
import { CONTACT } from "@/content/contact";
import { dockTick, hoverCancel, hoverIntent } from "@/lib/hover-sound";
import styles from "./socials-dock.module.css";

const ITEMS = [
  { label: "GitHub", href: CONTACT.github, Icon: FaGithub },
  { label: "X", href: CONTACT.x, Icon: FaXTwitter },
  { label: "LinkedIn", href: CONTACT.linkedin, Icon: FaLinkedinIn },
  { label: "Mail", href: `mailto:${CONTACT.email}`, Icon: LuMail },
  { label: "Download résumé", href: "/resume.pdf", Icon: LuDownload },
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
      <Dock className={styles.colors} panelHeight={44} maxHeight={44} magnification={40}>
        {showBack && <DockItem className="aspect-square" onClick={goBack} onHover={() => hoverIntent("dock-0", () => dockTick(0))} onHoverEnd={() => hoverCancel("dock-0")}>
          <DockLabel>Back</DockLabel>
          <DockIcon><LuArrowLeft role="img" aria-label="Back" className={styles.icon} /></DockIcon>
        </DockItem>}
        {ITEMS.map(({ label, href, Icon }, index) => (
          <DockItem key={label} className="aspect-square"
            onHover={() => hoverIntent(`dock-${index + 1}`, () => dockTick(index + 1))}
            onHoverEnd={() => hoverCancel(`dock-${index + 1}`)}
            onClick={() => {
            if (href === "/resume.pdf") {
              const link = document.createElement("a");
              link.href = href;
              link.download = "aetos-resume.pdf";
              document.body.append(link);
              link.click();
              link.remove();
            } else if (href.startsWith("mailto:")) location.href = href;
            else window.open(href, "_blank", "noopener,noreferrer");
          }}>
            <DockLabel>{label}</DockLabel>
            <DockIcon><Icon role="img" aria-label={label} className={styles.icon} /></DockIcon>
          </DockItem>
        ))}
      </Dock>
    </nav>
  );
}
