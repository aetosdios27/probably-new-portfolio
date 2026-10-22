import { COLOR_HEX, COLORS, LEVELS, Pond, RAMP } from "./koi-pond";
import { FADE_PX, type KoiRenderer } from "./koi-renderer";

const CELL_W = 5;
const CELL_H = 9;

/** The fallback when WebGL2 is unavailable: a CPU raster drawn from a pre-rendered glyph atlas. */
export class KoiCanvas implements KoiRenderer {
  private readonly context: CanvasRenderingContext2D;
  private atlas: HTMLCanvasElement | null = null;
  private fade = new Float32Array(0);
  private cellWidth = CELL_W;
  private cellHeight = CELL_H;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("koi pond: no 2D context");
    this.context = context;
  }

  private buildAtlas(dpr: number) {
    this.cellWidth = Math.round(CELL_W * dpr);
    this.cellHeight = Math.round(CELL_H * dpr);
    const atlas = document.createElement("canvas");
    atlas.width = this.cellWidth * LEVELS;
    atlas.height = this.cellHeight * COLOR_HEX.length;
    const context = atlas.getContext("2d");
    if (!context) return;
    context.font = `${this.cellHeight * 0.95}px ${getComputedStyle(this.canvas).fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    COLOR_HEX.forEach((color, row) => {
      context.fillStyle = color;
      for (let level = 1; level < LEVELS; level++) {
        context.fillText(RAMP[level], level * this.cellWidth + this.cellWidth / 2, row * this.cellHeight + this.cellHeight / 2 + this.cellHeight * 0.04);
      }
    });
    this.atlas = atlas;
  }

  resize(width: number, height: number, dpr: number, columnLeft: number, columnRight: number): Pond {
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.buildAtlas(dpr);
    const pond = new Pond(width, height, CELL_W, CELL_H);
    this.fade = new Float32Array(pond.cols);
    for (let x = 0; x < pond.cols; x++) {
      const centre = (x + 0.5) * CELL_W;
      const distance = centre < columnLeft ? columnLeft - centre : centre > columnRight ? centre - columnRight : 0;
      this.fade[x] = Math.max(0, Math.min(1, distance / FADE_PX));
    }
    return pond;
  }

  draw(pond: Pond) {
    const { context, atlas, fade, cellWidth, cellHeight } = this;
    if (!atlas) return;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const frame = pond.rasterize();
    for (let y = 0; y < frame.rows; y++) {
      for (let x = 0; x < frame.cols; x++) {
        const edge = fade[x];
        if (edge <= 0) continue;
        const i = y * frame.cols + x;
        let color: number, level: number, alpha: number;
        if (frame.fishLevel[i] > 0) {
          color = frame.fishColor[i]; level = frame.fishLevel[i]; alpha = edge;
        } else if (frame.shadowLevel[i] > 0) {
          color = COLORS.shadow; level = frame.shadowLevel[i]; alpha = edge * 0.55;
        } else if (frame.waterLevel[i] > 0) {
          color = COLORS.water; level = frame.waterLevel[i]; alpha = edge * 0.4;
        } else continue;
        context.globalAlpha = alpha;
        context.drawImage(atlas, level * cellWidth, color * cellHeight, cellWidth, cellHeight, x * cellWidth, y * cellHeight, cellWidth, cellHeight);
      }
    }
    context.globalAlpha = 1;
  }

  dispose() {
    this.atlas = null;
  }
}
