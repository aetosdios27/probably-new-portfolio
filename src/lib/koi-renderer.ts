import type { Pond } from "./koi-pond";
import type { PondLook } from "./pond-looks";

/**
 * Draws a koi pond. `resize` builds the simulation for a viewport; `draw` renders its current state
 * in the given look, which may change from one frame to the next.
 */
export interface KoiRenderer {
  /** `quality` 0 is full detail; higher levels trade resolution for speed. */
  resize(width: number, height: number, dpr: number, columnLeft: number, columnRight: number, quality?: number): Pond;
  draw(pond: Pond, seconds: number, look: PondLook, pulse?: Pulse | null): void;
  dispose(): void;
}

/** Pixels over which the pond dissolves into the page as it nears the dashed rails. */
export const FADE_PX = 70;

/**
 * A pulse sweeping across the screen from a point (css px), as AI mode comes or goes. Behind its
 * front the pond is taken away (`direction` 1) or brought back (-1); `reach` is where it ends.
 * `trail` is the second front, where the page swaps to or from its markdown.
 */
export type Pulse = { x: number; y: number; radius: number; reach: number; direction: 1 | -1; trail: number };
