"use client";

import { useEffect, useRef } from "react";
import { KoiCanvas } from "@/lib/koi-canvas";
import { KoiGL } from "@/lib/koi-gl";
import type { Pond } from "@/lib/koi-pond";
import type { KoiRenderer } from "@/lib/koi-renderer";
import { gulp, plop } from "@/lib/pond-sound";
import styles from "./koi-pond.module.css";

const FRAME_MS = 1000 / 30;
const MIN_WIDTH = 1000;
// Keep the drawing buffer reasonable on very large or dense screens.
const MAX_PIXELS = 5_000_000;
// Device pixel ratio ceiling for each quality level, and the frame-pacing governor's window: if a
// third of the frames in one window arrive late, step down a level.
const QUALITY_DPR = [2, 1.5, 1];
const GOVERNOR_FRAMES = 60;
const GOVERNOR_LATE = 0.34;

// A fine ASCII koi pond filling the margins. It is fixed to the viewport, so the page scrolls
// over it and the opaque hatch bands read as windows onto the water. Nothing is drawn over the
// content column. It renders on the GPU (see koi-gl.ts) and falls back to a 2D canvas.
export function KoiPond() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motion.matches;
    let fontsReady = false;

    // The renderer is created on the first build that actually has room for the pond, so a phone, where
    // the canvas is hidden, never pays for compiling shaders.
    let renderer: KoiRenderer | null = null;
    let failed = false;
    function ensureRenderer() {
      if (renderer || failed) return renderer;
      try {
        if (KoiGL.supported()) {
          renderer = new KoiGL(canvas!);
          canvas!.dataset.renderer = "gl";
        } else {
          renderer = new KoiCanvas(canvas!);
          canvas!.dataset.renderer = "2d";
          canvas!.dataset.fallback = KoiGL.failure.slice(0, 600);
        }
      } catch (error) {
        failed = true;
        canvas!.dataset.error = String(error instanceof Error ? error.message : error).slice(0, 600);
      }
      return renderer;
    }

    let pond: Pond | null = null;
    let columnLeft = 0, columnRight = 0;
    let disposed = false;
    let raf = 0, resizeFrame = 0, last = 0, accumulated = 0;
    let quality = 0, drawn = 0, late = 0;
    const origin = performance.now();
    const seconds = () => (performance.now() - origin) / 1000;

    function build() {
      if (disposed || !fontsReady) return;
      cancelAnimationFrame(raf);
      raf = 0;
      const width = innerWidth, height = innerHeight;
      if (width < MIN_WIDTH) { pond = null; return; }
      if (document.hidden) { pond = null; return; }
      const active = ensureRenderer();
      if (!active) return;
      const dpr = Math.min(devicePixelRatio || 1, QUALITY_DPR[quality], Math.sqrt(MAX_PIXELS / (width * height)));

      // The content column and its dashed rails: the pond fades out before reaching them.
      const main = document.getElementById("main");
      const rect = main?.getBoundingClientRect();
      const guide = main ? parseFloat(getComputedStyle(main).getPropertyValue("--guide-gutter")) || 32 : 32;
      columnLeft = (rect?.left ?? width / 2 - 310) - guide;
      columnRight = (rect?.right ?? width / 2 + 310) + guide;

      pond = active.resize(width, height, dpr, columnLeft, columnRight, quality);
      pond.onEat = reduced ? null : gulp;
      if (reduced) {
        // A still frame: let the water settle and the fish spread out, then draw once.
        for (let i = 0; i < 240; i++) pond.step(1 / 30);
        active.draw(pond, 12);
        return;
      }
      last = 0;
      accumulated = 0;
      drawn = 0;
      late = 0;
      raf = requestAnimationFrame(tick);
    }

    function tick(time: number) {
      raf = 0;
      if (disposed || document.hidden || reduced || !pond) return;
      raf = requestAnimationFrame(tick);
      accumulated += Math.min(100, time - (last || time));
      last = time;
      if (accumulated < FRAME_MS) return;
      const steps = Math.min(2, Math.floor(accumulated / FRAME_MS));
      for (let i = 0; i < steps; i++) pond.step(1 / 30);
      // Frames that arrive well past their slot mean the device cannot keep up: drop a quality level.
      if (drawn++ >= 20 && accumulated > FRAME_MS * 1.6) late++;
      accumulated = 0;
      renderer?.draw(pond, seconds());
      if (drawn >= GOVERNOR_FRAMES && late / (drawn - 20) > GOVERNOR_LATE && quality < QUALITY_DPR.length - 1) {
        quality++;
        build();
      } else if (drawn >= GOVERNOR_FRAMES) {
        drawn = 20;
        late = 0;
      }
    }

    function inGutter(x: number) { return x < columnLeft || x > columnRight; }
    function onPointerMove(event: PointerEvent) {
      if (!pond || reduced || event.pointerType !== "mouse") return;
      pond.pointerMove(event.clientX, event.clientY, inGutter(event.clientX));
    }
    function onPointerDown(event: PointerEvent) {
      if (!pond || reduced || event.pointerType !== "mouse" || !inGutter(event.clientX)) return;
      pond.click(event.clientX, event.clientY);
      plop();
    }
    function onPointerLeave() { pond?.pointerLeave(); }
    function onResize() {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(build);
    }

    // The glyph atlas needs the page font, so wait for fonts before building.
    document.fonts.ready.then(() => {
      fontsReady = true;
      build();
    });
    function onVisibilityChange() {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      accumulated = 0;
      pond?.pointerLeave();
      if (document.hidden) return;
      if (!pond) build();
      else if (!reduced) raf = requestAnimationFrame(tick);
    }
    function onMotionChange() {
      reduced = motion.matches;
      build();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    motion.addEventListener("change", onMotionChange);
    addEventListener("resize", onResize);
    addEventListener("pointermove", onPointerMove, { passive: true });
    addEventListener("pointerdown", onPointerDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeFrame);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motion.removeEventListener("change", onMotionChange);
      removeEventListener("resize", onResize);
      removeEventListener("pointermove", onPointerMove);
      removeEventListener("pointerdown", onPointerDown);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      renderer?.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.pond} aria-hidden="true" />;
}
