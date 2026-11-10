"use client";

import { useEffect, useId, useRef, useState } from "react";
import { currentMode } from "@/lib/mode";
import { centerOf, exitAiMode } from "@/lib/mode-transition";
import styles from "./agent-view.module.css";

// Assistants that accept a prompt in the URL open with it filled in. Gemini has no such parameter,
// so choosing it copies the prompt first.
const AGENTS: { name: string; url: (prompt: string) => string; copies?: true }[] = [
  { name: "ChatGPT", url: (q) => `https://chatgpt.com/?q=${q}` },
  { name: "Claude", url: (q) => `https://claude.ai/new?q=${q}` },
  { name: "Perplexity", url: (q) => `https://www.perplexity.ai/search?q=${q}` },
  { name: "Grok", url: (q) => `https://grok.com/?q=${q}` },
  { name: "Gemini", url: () => "https://gemini.google.com/app", copies: true },
];

function promptFor(siteUrl: string) {
  return `Read ${new URL("/index.md", siteUrl)}, the full profile of aetos (Pushpendra), a systems engineer. Summarize their work, skills and open-source contributions, and tell me how to get in touch.`;
}

function copy(text: string) {
  return navigator.clipboard?.writeText(text).then(() => true, () => false) ?? Promise.resolve(false);
}

function OpenIn({ siteUrl }: { siteUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const prompt = promptFor(siteUrl);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("a, button")?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    }
    addEventListener("pointerdown", onPointerDown);
    return () => removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      // Closes the menu only; Esc again leaves AI mode.
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("a, button") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  }

  return (
    <div className={styles.openIn} data-cuelume-theme="mech" onKeyDown={onKeyDown}>
      <button ref={trigger} type="button" className={styles.control} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
        {...(open ? { "data-cuelume-close": "" } : { "data-cuelume-open": "" })}
        onClick={() => setOpen(!open)}>
        {copied ? "prompt copied" : "open in"} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div ref={menu} id={menuId} role="menu" className={styles.menu}>
          {AGENTS.map((agent) => (
            <a key={agent.name} role="menuitem" className={styles.option} data-cuelume-select="" target="_blank" rel="noopener noreferrer"
              href={agent.url(encodeURIComponent(prompt))}
              onClick={() => {
                if (agent.copies) void copy(prompt).then(setCopied);
                setOpen(false);
              }}>
              {agent.name}{agent.copies ? <span className={styles.note}> (copies prompt)</span> : null}
            </a>
          ))}
          <button type="button" role="menuitem" className={styles.option} data-cuelume-select=""
            onClick={() => { void copy(prompt).then(setCopied); close(); }}>
            copy prompt
          </button>
        </div>
      )}
    </div>
  );
}

export function AgentControls({ markdown, siteUrl }: { markdown: string; siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const exitButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && currentMode() === "ai" && exitButton.current) exitAiMode(centerOf(exitButton.current));
    }
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className={styles.controls}>
      <span className={styles.mode}>AI mode</span>
      <button ref={exitButton} type="button" className={styles.control} onClick={(event) => exitAiMode(centerOf(event.currentTarget))}>exit <kbd>esc</kbd></button>
      <button type="button" className={styles.control} onClick={() => void copy(markdown).then(setCopied)}>
        {copied ? "copied" : "copy markdown"}
      </button>
      <a className={styles.control} href="/index.md">raw .md</a>
      <OpenIn siteUrl={siteUrl} />
    </div>
  );
}
