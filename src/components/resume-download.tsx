"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { LuCheck, LuDownload } from "react-icons/lu";
import { press, release } from "cuelume";
import { cue, soundEnabled } from "@/lib/sound";
import styles from "./resume-download.module.css";

const HOLD_MS = 900;
const TOUCH_QUERY = "(hover: none), (pointer: coarse)";
function subscribeTouch(listener: () => void) {
  const query = matchMedia(TOUCH_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const touchSnapshot = () => matchMedia(TOUCH_QUERY).matches;

type Hold = { started: number; animate: boolean; initialFill: number } & (
  | { kind: "pointer"; id: number }
  | { kind: "keyboard"; key: string }
);

export function ResumeDownload() {
  const button = useRef<HTMLButtonElement>(null);
  const water = useRef<HTMLSpanElement>(null);
  const hold = useRef<Hold | null>(null);
  const frame = useRef(0);
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revoke = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const keyboardPress = useRef<string | null>(null);
  const consumed = useRef(false);
  const pointerType = useRef("");
  const [phase, setPhase] = useState<"idle" | "holding" | "fetching" | "success" | "error">("idle");
  const holding = phase === "holding";
  const complete = phase === "success";
  const touch = useSyncExternalStore(subscribeTouch, touchSnapshot, () => false);
  const statusId = useId();

  const cancel = useCallback(() => {
    if (keyboardPress.current) {
      release("tap");
      keyboardPress.current = null;
    }
    const active = hold.current;
    if (!active) return;
    hold.current = null;
    cancelAnimationFrame(frame.current);
    button.current?.style.setProperty("--hold-progress", "0");
    setPhase("idle");
    if (active.kind === "pointer" && button.current?.hasPointerCapture(active.id)) button.current.releasePointerCapture(active.id);
  }, []);

  const download = useCallback(async () => {
    if (consumed.current) return;
    consumed.current = true;
    if (reset.current) clearTimeout(reset.current);
    button.current?.style.setProperty("--hold-progress", "1");
    setPhase("fetching");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch("/resume.pdf", { signal: controller.signal });
      if (!response.ok) throw new Error("Résumé unavailable");
      const blob = await response.blob();
      if (await blob.slice(0, 5).text() !== "%PDF-") throw new Error("Invalid résumé response");
      if (controller.signal.aborted) return;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      if (revoke.current) clearTimeout(revoke.current);
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;
      const link = document.createElement("a");
      link.href = url;
      link.download = "aetos-resume.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      revoke.current = setTimeout(() => {
        URL.revokeObjectURL(url);
        if (objectUrl.current === url) objectUrl.current = null;
      }, 1000);
      setPhase("success");
      cue("success", { theme: "press", emphasis: "subtle", volume: 0.65 }, "resume-success", 500);
    } catch {
      if (controller.signal.aborted) return;
      setPhase("error");
      cue("error", { theme: "press", emphasis: "subtle" }, "resume-error", 500);
    } finally {
      if (request.current === controller) request.current = null;
    }
    reset.current = setTimeout(() => {
      consumed.current = false;
      setPhase("idle");
      button.current?.style.setProperty("--hold-progress", "0");
    }, 700);
  }, []);

  function start(input: { kind: "pointer"; id: number } | { kind: "keyboard"; key: string }) {
    if (hold.current || consumed.current) return;
    if (reset.current) clearTimeout(reset.current);
    const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const liquid = water.current;
    const initialFill = animate && liquid
      ? Math.max(0, Math.min(1, 1 - new DOMMatrixReadOnly(getComputedStyle(liquid).transform).m42 / (liquid.offsetHeight * 1.1)))
      : 0;
    const active: Hold = { ...input, started: performance.now(), animate, initialFill };
    hold.current = active;
    button.current?.style.setProperty("--hold-progress", String(initialFill));
    setPhase("holding");
    if (input.kind === "keyboard") {
      keyboardPress.current = input.key;
      if (soundEnabled()) press("tap", { theme: "press", input: "keyboard" });
    }
    function advance(now: number) {
      if (hold.current !== active) return;
      const progress = Math.min(1, (now - active.started) / HOLD_MS);
      if (active.animate) button.current?.style.setProperty("--hold-progress", String(active.initialFill + (1 - active.initialFill) * progress));
      if (progress === 1) {
        hold.current = null;
        void download();
      } else frame.current = requestAnimationFrame(advance);
    }
    frame.current = requestAnimationFrame(advance);
  }

  useEffect(() => {
    const hide = () => { if (document.hidden) cancel(); };
    addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hide);
    return () => {
      removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hide);
      cancelAnimationFrame(frame.current);
      if (reset.current) clearTimeout(reset.current);
      if (revoke.current) clearTimeout(revoke.current);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      request.current?.abort();
      hold.current = null;
    };
  }, [cancel]);

  const label = complete ? "Download started" : phase === "fetching" ? "Preparing…" : phase === "error" ? "Couldn't download. Try again." : holding ? "Keep holding…" : touch ? "Download résumé" : "Hold to download";
  const Icon = complete ? LuCheck : LuDownload;
  return (
    <button ref={button} type="button" role="button" className={styles.download}
      aria-label={touch ? "Download résumé" : "Hold to download résumé"} aria-describedby={statusId}
      data-cuelume-tap="" data-cuelume-theme="press" data-cuelume-emphasis="normal"
      data-holding={holding} data-complete={complete} data-fetching={phase === "fetching"}
      onPointerDown={event => {
        pointerType.current = event.pointerType;
        if (event.button !== 0 || event.pointerType !== "mouse" || touch) return;
        if (event.isTrusted) event.currentTarget.setPointerCapture(event.pointerId);
        start({ kind: "pointer", id: event.pointerId });
      }}
      onPointerMove={event => {
        if (hold.current?.kind !== "pointer") return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cancel();
      }}
      onPointerUp={cancel} onPointerLeave={() => { if (hold.current?.kind === "pointer") cancel(); }}
      onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
      onContextMenu={event => { if (hold.current) event.preventDefault(); }}
      onKeyDown={event => {
        if (touch || (event.key !== " " && event.key !== "Enter")) return;
        event.preventDefault();
        if (!event.repeat) start({ kind: "keyboard", key: event.key });
      }}
      onKeyUp={event => {
        if (keyboardPress.current === event.key) {
          event.preventDefault();
          cancel();
        }
      }}
      onClick={event => {
        // Keyboard holds prevent native clicks; assistive activation still gets a normal download.
        if (touch || pointerType.current === "touch" || pointerType.current === "pen" || event.detail === 0) void download();
      }}>
      <span className={styles.vessel} aria-hidden="true">
        <span ref={water} className={styles.water}>
          <svg className={`${styles.wave} ${styles.back}`} viewBox="0 0 128 40" preserveAspectRatio="none">
            <path d="M0 6 Q8 2 16 6 T32 6 T48 6 T64 6 T80 6 T96 6 T112 6 T128 6 V40 H0Z" />
          </svg>
          <svg className={styles.wave} viewBox="0 0 128 40" preserveAspectRatio="none">
            <path d="M0 6 Q8 2 16 6 T32 6 T48 6 T64 6 T80 6 T96 6 T112 6 T128 6 V40 H0Z" />
          </svg>
        </span>
        <Icon className={styles.symbol} />
      </span>
      <span className={styles.tip} role="tooltip">{label}</span>
      <span id={statusId} className="sr-only">{touch ? "Tap to download the PDF." : "Hold the mouse button, Space, or Enter until the circle fills. Release early to cancel."}</span>
      <span className="sr-only" role="status">{complete ? "Résumé download started." : phase === "error" ? "Résumé download failed. Please try again." : ""}</span>
    </button>
  );
}
