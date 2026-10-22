import type { Pond } from "./koi-pond";

/** Draws a koi pond. `resize` builds the simulation for a viewport; `draw` renders its current state. */
export interface KoiRenderer {
  /** `quality` 0 is full detail; higher levels trade resolution for speed. */
  resize(width: number, height: number, dpr: number, columnLeft: number, columnRight: number, quality?: number): Pond;
  draw(pond: Pond, seconds: number): void;
  dispose(): void;
}

/** Pixels over which the pond dissolves into the page as it nears the dashed rails. */
export const FADE_PX = 70;
