// A koi pond on a character grid. Pure simulation and rasterising: no DOM, so it can be
// tested and driven by a canvas component. All geometry is in CSS pixels; the grid is
// `cols x rows` cells of `cellW x cellH` pixels.

export const RAMP = " .:-=+*#%@";
export const LEVELS = RAMP.length;

/** Colour ids shared with the glyph atlas. */
export const COLORS = {
  cream: 0,
  orange: 1,
  red: 2,
  ink: 3,
  gold: 4,
  water: 5,
  shadow: 6,
} as const;
export const COLOR_HEX = ["#FFF1D6", "#FF9A3C", "#FF5B3A", "#8a8a8a", "#FFC83D", "#5CD5FF", "#4c7280"] as const;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lattice(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1]. */
export function noise2(x: number, y: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const top = lattice(x0, y0) * (1 - sx) + lattice(x0 + 1, y0) * sx;
  const bottom = lattice(x0, y0 + 1) * (1 - sx) + lattice(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

// Half-width of a koi along its body, head (0) to tail (1), as a fraction of its maximum.
const PROFILE: [number, number][] = [[0, 0.45], [0.08, 0.8], [0.25, 1], [0.5, 0.85], [0.75, 0.42], [0.92, 0.18], [1, 0.1]];
export function bodyProfile(t: number) {
  for (let i = 1; i < PROFILE.length; i++) {
    const [t1, w1] = PROFILE[i];
    if (t <= t1) {
      const [t0, w0] = PROFILE[i - 1];
      return w0 + ((t - t0) / (t1 - t0)) * (w1 - w0);
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

export type Kind = "kohaku" | "sanke" | "ogon" | "aka";
export const SEGMENTS = 22;
/** Fins and tail discs per fish. */
export const EXTRAS = 32;
export const MAX_FISH = 6;
export const MAX_PELLETS = 16;
const KIND_ID: Record<Kind, number> = { kohaku: 0, sanke: 1, ogon: 2, aka: 3 };

/** What a fish is doing. Each state changes how it steers and how fast it swims. */
export type FishState = "cruise" | "curious" | "flee" | "feed" | "surface";

type Pellet = { x: number; y: number; life: number };
type Pointer = {
  x: number;
  y: number;
  /** True while the cursor is in the pond margins and has moved recently. */
  active: boolean;
  /** Smoothed cursor speed in px/s. */
  speed: number;
  lastMove: number;
  clickX: number;
  clickY: number;
  clickAge: number;
};

type World = {
  width: number;
  height: number;
  pointer: Pointer;
  pellets: Pellet[];
  fish: Koi[];
  ripple: (x: number, y: number, strength: number) => void;
  eat: (pellet: Pellet) => void;
  random: () => number;
};

const PELLET_LIFE = 9;

class Koi {
  readonly spine: { x: number; y: number }[] = [];
  heading: number;
  speed = 0;
  /** Tail-beat phase. */
  phase = 0;
  /** Pectoral-fin phase: works harder when turning or slow. */
  finPhase = 0;
  /** Smoothed turn rate (rad/s); drives fin effort. */
  turnRate = 0;
  /** Kick-and-glide: jumps to 1 on each tail thrust and decays. */
  thrust = 0;
  /** Burst speed after a fright, decaying to 0. */
  burst = 0;
  state: FishState = "cruise";
  private stateTime = 0;
  private fleeHeading = 0;
  private nextKick = 0;
  private nextNibble = 0;
  private nextSurface: number;
  private chew = 0;
  private clock = 0;
  /** 0..1: how readily this fish investigates a slow cursor / how easily it is startled. */
  readonly curiosity: number;
  readonly skittish: number;

  constructor(
    readonly seed: number,
    readonly kind: Kind,
    readonly length: number,
    x: number,
    y: number,
    heading: number,
  ) {
    this.heading = heading;
    const spacing = length / (SEGMENTS - 1);
    for (let i = 0; i < SEGMENTS; i++) this.spine.push({ x: x - Math.cos(heading) * spacing * i, y: y - Math.sin(heading) * spacing * i });
    this.curiosity = 0.35 + 0.65 * noise2(seed * 1.7, 3.1);
    this.skittish = 0.3 + 0.7 * noise2(seed * 2.3, 8.7);
    this.nextKick = noise2(seed, 1) * 1.5;
    this.nextSurface = 14 + noise2(seed, 6) * 30;
  }

  get half() { return this.length * 0.125; }
  get head() { return this.spine[0]; }

  /** Dart away from a point: a burst of speed with a sharp turn. */
  startle(fromX: number, fromY: number, force: number, jitter: number) {
    if (this.state === "flee" && this.stateTime < 0.3) return;
    this.state = "flee";
    this.stateTime = 0;
    this.fleeHeading = Math.atan2(this.head.y - fromY, this.head.x - fromX) + (jitter - 0.5) * 0.5;
    this.burst = Math.max(this.burst, Math.min(1.4, force) * (0.7 + this.skittish * 0.5));
  }

  update(dt: number, world: World) {
    this.clock += dt;
    this.stateTime += dt;
    const { x, y } = this.head;
    const pointer = world.pointer;
    const pointerDistance = pointer.active ? Math.hypot(x - pointer.x, y - pointer.y) : Infinity;

    // Stimuli that interrupt whatever the fish is doing.
    if (pointer.active && pointer.speed > 520 && pointerDistance < 150 + 220 * this.skittish) this.startle(pointer.x, pointer.y, 0.7 + pointer.speed / 2400, world.random());
    if (pointer.clickAge < 0.2 && Math.hypot(x - pointer.clickX, y - pointer.clickY) < 130) this.startle(pointer.clickX, pointer.clickY, 1.1, world.random());

    // Choose a state.
    const pellet = this.state === "flee" ? null : nearestPellet(world.pellets, x, y, 950);
    if (this.state === "flee") {
      if (this.stateTime > 1.1 && this.burst < 0.15) this.setState("cruise");
    } else if (pellet) {
      if (this.state !== "feed") this.setState("feed");
    } else if (this.state === "feed") {
      this.setState("cruise");
    } else if (this.state === "surface") {
      if (this.stateTime > 2.2) this.setState("cruise");
    } else if (pointer.active && pointer.speed < 170 && pointerDistance < 360 && this.curiosity > 0.45) {
      if (this.state !== "curious") this.setState("curious");
    } else if (this.state === "curious") {
      this.setState("cruise");
    } else if (this.clock > this.nextSurface) {
      this.nextSurface = this.clock + 18 + world.random() * 30;
      this.setState("surface");
    }

    // Steering.
    let turn = (noise2(this.clock * 0.35, this.seed) - 0.5) * 2.2;
    let maxTurn = 1.6;
    let pace = 1;

    // Keep in the pond.
    const margin = 120;
    const edge = Math.max(0, margin - x, x - (world.width - margin), margin - y, y - (world.height - margin)) / margin;
    const center = Math.atan2(world.height / 2 - y, world.width / 2 - x);
    if (edge > 0) turn += angleDiff(center, this.heading) * Math.min(1, edge * 2.5) * 2.4;

    if (this.state === "flee") {
      turn = angleDiff(this.fleeHeading, this.heading) * 5;
      maxTurn = 4.5;
    } else if (this.state === "feed" && pellet) {
      const toPellet = Math.atan2(pellet.y - y, pellet.x - x);
      turn = angleDiff(toPellet, this.heading) * 4.2;
      maxTurn = 3.2;
      pace = 1.35;
      if (Math.hypot(pellet.x - x, pellet.y - y) < this.half * 0.7 + 8) {
        world.eat(pellet);
        world.ripple(x, y, 0.9);
        this.chew = 0.9;
      }
    } else if (this.state === "curious") {
      // Approach slowly, then circle the cursor at a respectful distance.
      const toPointer = Math.atan2(pointer.y - y, pointer.x - x);
      const circling = pointerDistance < 120;
      const target = circling ? toPointer + (this.seed % 2 === 0 ? 1 : -1) * Math.PI * 0.5 : toPointer;
      turn += angleDiff(target, this.heading) * 2.4;
      pace = circling ? 0.5 : 0.7;
      if (pointerDistance < 170 && this.clock > this.nextNibble) {
        this.nextNibble = this.clock + 1.1 + world.random() * 1.4;
        world.ripple(x, y, 0.3);
      }
    } else if (this.state === "surface") {
      pace = 0.12;
      if (Math.floor(this.stateTime / 0.55) > Math.floor((this.stateTime - dt) / 0.55)) world.ripple(x, y, 0.8);
    } else {
      // Loosely follow and avoid the other fish.
      let cohesionX = 0, cohesionY = 0, alignX = 0, alignY = 0, near = 0;
      for (const other of world.fish) {
        if (other === this) continue;
        const dx = other.head.x - x, dy = other.head.y - y;
        const distance = Math.hypot(dx, dy);
        if (distance < 130) turn -= angleDiff(Math.atan2(dy, dx), this.heading) * (1 - distance / 130) * 2.2;
        else if (distance < 420) {
          cohesionX += dx; cohesionY += dy;
          alignX += Math.cos(other.heading); alignY += Math.sin(other.heading);
          near += 1;
        }
      }
      if (near > 0) {
        turn += angleDiff(Math.atan2(cohesionY, cohesionX), this.heading) * 0.22;
        turn += angleDiff(Math.atan2(alignY, alignX), this.heading) * 0.3;
      }
    }

    // Swimming effort: kick and glide, burst after a fright, slower while chewing.
    this.nextKick -= dt;
    if (this.nextKick <= 0) {
      this.nextKick = 1.1 + 0.9 * noise2(this.clock * 0.3, this.seed * 5);
      this.thrust = 1;
    }
    this.thrust *= Math.exp(-dt * 2.4);
    this.burst = Math.max(0, this.burst - dt * 1.9);
    this.chew = Math.max(0, this.chew - dt);
    const base = 26 + (this.length / 230) * 14;
    this.speed = base * (0.7 + 0.4 * noise2(this.clock * 0.2, this.seed * 3)) * (0.55 + 0.9 * this.thrust) * (1 + this.burst * 2.6) * pace * (this.chew > 0 ? 0.4 : 1);

    this.turnRate += (Math.max(-maxTurn, Math.min(maxTurn, turn)) - this.turnRate) * Math.min(1, dt * 7);
    this.heading += this.turnRate * dt;
    this.spine[0] = { x: x + Math.cos(this.heading) * this.speed * dt, y: y + Math.sin(this.heading) * this.speed * dt };
    const spacing = this.length / (SEGMENTS - 1);
    for (let i = 1; i < SEGMENTS; i++) {
      const previous = this.spine[i - 1], point = this.spine[i];
      const dx = point.x - previous.x, dy = point.y - previous.y;
      const distance = Math.hypot(dx, dy) || 1;
      point.x = previous.x + (dx / distance) * spacing;
      point.y = previous.y + (dy / distance) * spacing;
    }
    this.phase += dt * (2 + this.speed * 0.055 + this.thrust * 2.6 + this.burst * 3);
    this.finPhase += dt * (2.2 + Math.abs(this.turnRate) * 3.5 + Math.max(0, 1.2 - this.speed / 30) * 2.2);
  }

  private setState(state: FishState) {
    this.state = state;
    this.stateTime = 0;
  }

  /** The spine with a travelling sway, stronger towards the tail and with effort. */
  swimming() {
    const amplitude = this.length * 0.045 * (0.65 + 0.55 * this.thrust + 0.5 * Math.min(1, this.burst));
    return this.spine.map((point, i) => {
      const next = this.spine[Math.min(SEGMENTS - 1, i + 1)], previous = this.spine[Math.max(0, i - 1)];
      const tx = next.x - previous.x, ty = next.y - previous.y;
      const norm = Math.hypot(tx, ty) || 1;
      const sway = amplitude * (0.25 + 0.75 * (i / (SEGMENTS - 1))) * Math.sin(this.phase - i * 0.5);
      return { x: point.x - (ty / norm) * sway, y: point.y + (tx / norm) * sway, nx: -ty / norm, ny: tx / norm };
    });
  }

  colorAt(t: number, u: number): number {
    if (this.kind === "ogon") return COLORS.gold;
    const s = this.seed;
    const patch = noise2(t * 4.2 + s, u * 1.4 + s * 2);
    if (this.kind === "aka") return patch > 0.7 ? COLORS.red : COLORS.orange;
    if (this.kind === "sanke" && noise2(t * 9 + s * 3, u * 2 + s) > 0.8) return COLORS.ink;
    if (patch > 0.6) return COLORS.red;
    return patch > 0.52 ? COLORS.orange : COLORS.cream;
  }
}

function nearestPellet(pellets: Pellet[], x: number, y: number, within: number) {
  let best: Pellet | null = null, bestDistance = within;
  for (const pellet of pellets) {
    const distance = Math.hypot(pellet.x - x, pellet.y - y);
    if (distance < bestDistance) { best = pellet; bestDistance = distance; }
  }
  return best;
}

type Body = { x: number; y: number; nx: number; ny: number };
/** A disc that is part of a fish but not its spine: a fin lobe or a tail lobe. */
type Shape = { x: number; y: number; r: number; s: number; nx: number; ny: number; t: number };

/** Pectoral fins and the forked tail, as discs. Shared by the CPU rasteriser and the GPU renderer. */
function appendages(fish: Koi, body: Body[]): Shape[] {
  const half = fish.half, last = SEGMENTS - 1, shapes: Shape[] = [];

  // Pectoral fins, flapping harder when the fish turns or slows.
  const finIndex = 3, anchor = body[finIndex];
  const flap = Math.sin(fish.finPhase) * (0.25 + Math.min(0.35, Math.abs(fish.turnRate) * 0.12));
  for (const side of [-1, 1]) {
    const reach = half * (1.25 + side * flap * 0.4);
    shapes.push({ x: anchor.x + anchor.nx * side * reach, y: anchor.y + anchor.ny * side * reach, r: half * 0.42, s: 0.55, nx: anchor.nx, ny: anchor.ny, t: 0.16 });
    shapes.push({
      x: anchor.x + anchor.nx * side * reach * 1.25 - (body[finIndex + 1].x - anchor.x) * 0.5,
      y: anchor.y + anchor.ny * side * reach * 1.25 - (body[finIndex + 1].y - anchor.y) * 0.5,
      r: half * 0.28, s: 0.4, nx: anchor.nx, ny: anchor.ny, t: 0.2,
    });
  }

  // A forked tail fanning out from the last body segment, swaying with the spine.
  const tip = body[last], prev = body[last - 1];
  const dx = tip.x - prev.x, dy = tip.y - prev.y, norm = Math.hypot(dx, dy) || 1;
  const dirX = dx / norm, dirY = dy / norm;
  const tailLength = fish.length * (0.28 + 0.06 * fish.thrust), sway = Math.sin(fish.phase - last * 0.5 + 0.8) * (0.35 + 0.2 * fish.thrust);
  for (let s = 0.1; s <= 1 && shapes.length < EXTRAS - 1; s += 0.07) {
    const spread = s * fish.length * 0.13 * (0.8 + 0.4 * Math.sin(fish.phase * 0.9) + 0.25 * fish.thrust);
    for (const side of [-1, 1]) {
      const lateral = spread * side + sway * s * tailLength * 0.5;
      shapes.push({
        x: tip.x + dirX * s * tailLength - dirY * lateral,
        y: tip.y + dirY * s * tailLength + dirX * lateral,
        r: half * (0.34 - s * 0.14), s: 0.6 - s * 0.25, nx: -dirY, ny: dirX, t: 0.98,
      });
    }
  }
  return shapes;
}

function angleDiff(target: number, current: number) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export type PondFrame = {
  cols: number;
  rows: number;
  /** Per cell: glyph level 0..LEVELS-1 for the fish, its colour id, shadow and water levels. */
  fishLevel: Uint8Array;
  fishColor: Uint8Array;
  shadowLevel: Uint8Array;
  waterLevel: Uint8Array;
};

export type GpuData = {
  count: number;
  pelletCount: number;
  cols: number;
  rows: number;
  /** (SEGMENTS + EXTRAS) x (MAX_FISH + 1) RGBA floats: one row per fish, then a row of food pellets. */
  fishTexture: Float32Array;
  /** Per fish: length, half-width, seed, kind id. */
  params: Float32Array;
  /** Per fish: bounding circle centre x, y, radius, and swim phase. */
  bounds: Float32Array;
  /** Wave heights, one per grid cell, row 0 at the top. */
  wave: Float32Array;
};

export class Pond {
  readonly cols: number;
  readonly rows: number;
  private readonly random: () => number;
  private height0: Float32Array;
  private height1: Float32Array;
  private readonly fish: Koi[] = [];
  private readonly pellets: Pellet[] = [];
  private readonly fishCover: Float32Array;
  private readonly shadowCover: Float32Array;
  private readonly frame: PondFrame;
  private readonly gpu: GpuData;
  /** Called when a koi eats a pellet; the host uses it for sound. */
  onEat: (() => void) | null = null;
  private rain = 1.5;
  private time = 0;
  private readonly pointer: Pointer = { x: 0, y: 0, active: false, speed: 0, lastMove: -1e9, clickX: 0, clickY: 0, clickAge: 99 };

  constructor(readonly width: number, readonly height: number, readonly cellW = 5, readonly cellH = 9, seed = 7) {
    this.cols = Math.ceil(width / cellW);
    this.rows = Math.ceil(height / cellH);
    const count = this.cols * this.rows;
    this.height0 = new Float32Array(count);
    this.height1 = new Float32Array(count);
    this.fishCover = new Float32Array(count);
    this.shadowCover = new Float32Array(count);
    this.frame = { cols: this.cols, rows: this.rows, fishLevel: new Uint8Array(count), fishColor: new Uint8Array(count), shadowLevel: new Uint8Array(count), waterLevel: new Uint8Array(count) };
    this.random = mulberry32(seed);
    this.gpu = {
      count: 0, pelletCount: 0, cols: this.cols, rows: this.rows,
      fishTexture: new Float32Array((SEGMENTS + EXTRAS) * (MAX_FISH + 1) * 4),
      params: new Float32Array(MAX_FISH * 4),
      bounds: new Float32Array(MAX_FISH * 4),
      wave: this.height0,
    };

    const scale = Math.max(0.8, Math.min(1.25, height / 900));
    const kinds: [Kind, number][] = [["kohaku", 230], ["sanke", 195], ["ogon", 170], ["kohaku", 150], ["aka", 205], ["sanke", 160]];
    const total = width >= 1300 ? kinds.length : kinds.length - 1;
    for (let i = 0; i < total; i++) {
      const [kind, length] = kinds[i];
      this.fish.push(new Koi(i * 11 + 3, kind, length * scale, width * (0.1 + 0.8 * this.random()), height * (0.15 + 0.7 * this.random()), this.random() * Math.PI * 2));
    }
  }

  /** Disturb the water. `strength` is in wave height; the grid is clamped to its edges. */
  drop(x: number, y: number, strength: number) {
    const cx = Math.floor(x / this.cellW), cy = Math.floor(y / this.cellH);
    if (cx < 1 || cy < 1 || cx >= this.cols - 1 || cy >= this.rows - 1) return;
    this.height0[cy * this.cols + cx] += strength;
  }

  /**
   * The cursor moved. It steers the fish (curiosity, fright) but never disturbs the water: only a
   * click does. `inPond` is false over the page content, where the fish ignore it.
   */
  pointerMove(x: number, y: number, inPond: boolean) {
    const pointer = this.pointer;
    if (inPond) {
      const elapsed = Math.max(0.016, this.time - pointer.lastMove);
      const instant = pointer.active ? Math.hypot(x - pointer.x, y - pointer.y) / elapsed : 0;
      pointer.speed += (Math.min(instant, 4000) - pointer.speed) * 0.5;
      pointer.lastMove = this.time;
    }
    pointer.x = x;
    pointer.y = y;
    pointer.active = inPond;
  }

  pointerLeave() {
    this.pointer.active = false;
  }

  /** A click makes a ring, startles nearby fish and scatters food that the fish race for. */
  click(x: number, y: number) {
    const pointer = this.pointer;
    pointer.clickX = x;
    pointer.clickY = y;
    pointer.clickAge = 0;
    this.drop(x, y, 2.2);
    for (let i = 0; i < 6 && this.pellets.length < MAX_PELLETS; i++) {
      const angle = this.random() * Math.PI * 2, spread = 10 + this.random() * 40;
      this.pellets.push({ x: x + Math.cos(angle) * spread, y: y + Math.sin(angle) * spread, life: PELLET_LIFE });
    }
  }

  step(dt: number) {
    this.time += dt;
    const pointer = this.pointer;
    pointer.clickAge += dt;
    pointer.speed *= Math.exp(-dt * 3);
    if (pointer.active && this.time - pointer.lastMove > 1.4) pointer.active = false;

    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const pellet = this.pellets[i];
      pellet.life -= dt;
      pellet.x += Math.sin(this.time * 1.3 + i) * 2 * dt;
      pellet.y += Math.cos(this.time * 1.1 + i * 2) * 2 * dt;
      if (pellet.life <= 0) this.pellets.splice(i, 1);
    }

    const world: World = {
      width: this.width,
      height: this.height,
      pointer,
      pellets: this.pellets,
      fish: this.fish,
      random: this.random,
      ripple: (x, y, strength) => this.drop(x, y, strength),
      eat: (pellet) => {
        const index = this.pellets.indexOf(pellet);
        if (index >= 0) {
          this.pellets.splice(index, 1);
          this.onEat?.();
        }
      },
    };
    for (const fish of this.fish) {
      fish.update(dt, world);
      this.drop(fish.head.x, fish.head.y, 0.09 * Math.min(1, fish.speed / 30));
      const tail = fish.spine[SEGMENTS - 1];
      this.drop(tail.x, tail.y, 0.04 + 0.1 * fish.thrust);
      // A fish in a hurry churns the water along its whole body.
      if (fish.burst > 0.3) for (let i = 2; i < SEGMENTS; i += 5) this.drop(fish.spine[i].x, fish.spine[i].y, 0.14 * fish.burst);
    }
    this.rain -= dt;
    if (this.rain <= 0) {
      this.rain = 1.5 + this.random() * 2.5;
      this.drop(this.random() * this.width, this.random() * this.height, 2.4);
    }
    this.advanceWater();
  }

  // Damped wave equation. The y coupling is scaled by the cell aspect so ripples are round.
  private advanceWater() {
    const { cols, rows } = this;
    const kx = 0.3, ky = kx * (this.cellW / this.cellH) ** 2;
    const current = this.height0, previous = this.height1;
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const i = y * cols + x;
        const h = current[i];
        const laplacian = (current[i - 1] + current[i + 1] - 2 * h) * kx + (current[i - cols] + current[i + cols] - 2 * h) * ky;
        previous[i] = (2 * h - previous[i] + laplacian) * 0.986;
      }
    }
    this.height0 = previous;
    this.height1 = current;
  }

  /**
   * Everything the GPU renderer needs for the current frame. `fishTexture` is a
   * (SEGMENTS + EXTRAS) x (MAX_FISH + 1) RGBA float image: per fish, the swaying spine as (x, y, nx, ny)
   * followed by fin and tail discs as (x, y, radius, strength); the last row holds food pellets as
   * (x, y, radius, 0). Arrays are reused between calls.
   */
  gpuData(): GpuData {
    const data = this.gpu;
    data.count = this.fish.length;
    data.fishTexture.fill(0);
    const width = SEGMENTS + EXTRAS;
    this.fish.forEach((fish, f) => {
      const body = fish.swimming();
      body.forEach((point, i) => data.fishTexture.set([point.x, point.y, point.nx, point.ny], (f * width + i) * 4));
      appendages(fish, body).forEach((shape, e) => data.fishTexture.set([shape.x, shape.y, shape.r, shape.s], (f * width + SEGMENTS + e) * 4));
      const head = body[0], tail = body[SEGMENTS - 1];
      data.params.set([fish.length, fish.half, fish.seed, KIND_ID[fish.kind]], f * 4);
      data.bounds.set([(head.x + tail.x) / 2, (head.y + tail.y) / 2, fish.length * 0.9, fish.phase], f * 4);
    });
    data.pelletCount = Math.min(this.pellets.length, MAX_PELLETS);
    for (let i = 0; i < data.pelletCount; i++) {
      const pellet = this.pellets[i];
      data.fishTexture.set([pellet.x, pellet.y, 3.4 * Math.min(1, pellet.life / 0.8), 0], (MAX_FISH * width + i) * 4);
    }
    data.wave = this.height0;
    return data;
  }

  /** The fish's heads, for tests and debugging. */
  heads() { return this.fish.map((fish) => ({ x: fish.head.x, y: fish.head.y })); }
  states() { return this.fish.map((fish) => fish.state); }
  pelletCount() { return this.pellets.length; }
  maxWave() {
    let max = 0;
    for (const value of this.height0) max = Math.max(max, Math.abs(value));
    return max;
  }

  rasterize(): PondFrame {
    const { cols, rows } = this;
    this.fishCover.fill(0);
    this.shadowCover.fill(0);
    for (const fish of this.fish) this.drawFish(fish);

    const frame = this.frame;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const dither = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16 - 0.5;
        const fishCover = this.fishCover[i];
        frame.fishLevel[i] = fishCover > 0.1 ? Math.floor(Math.max(0, Math.min(1, fishCover + dither * 0.14)) * (LEVELS - 1)) : 0;
        const shadowCover = this.shadowCover[i];
        frame.shadowLevel[i] = shadowCover > 0.1 ? Math.floor(Math.max(0, Math.min(1, shadowCover + dither * 0.14)) * 3) : 0;
        // Ripple crests, plus a faint drifting shimmer so the surface always reads as water.
        const ripple = Math.floor(Math.min(1, Math.abs(this.height0[i]) * 7) * 3.99);
        const shimmer = noise2(x * 0.16 + this.time * 0.25, y * 0.24 - this.time * 0.18) > 0.8 ? 1 : 0;
        frame.waterLevel[i] = Math.max(ripple, shimmer);
      }
    }
    return frame;
  }

  private drawFish(fish: Koi) {
    const body = fish.swimming();
    const half = fish.half;
    const last = SEGMENTS - 1;

    for (let i = 0; i < last; i++) {
      const a = body[i], b = body[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let step = 0; step < steps; step++) {
        const f = step / steps;
        const t = (i + f) / last;
        const radius = half * bodyProfile(t);
        this.stamp(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, radius, 1, a.nx, a.ny, t, fish, true);
      }
    }
    for (const shape of appendages(fish, body)) this.stamp(shape.x, shape.y, shape.r, shape.s, shape.nx, shape.ny, shape.t, fish, true);
  }

  private stamp(cx: number, cy: number, radius: number, strength: number, nx: number, ny: number, t: number, fish: Koi, shadow: boolean) {
    if (radius <= 0.5) return;
    this.paint(cx, cy, radius, strength, nx, ny, t, fish, this.fishCover, true);
    if (shadow) this.paint(cx + 12, cy + 17, radius, strength * 0.5, nx, ny, t, fish, this.shadowCover, false);
  }

  private paint(cx: number, cy: number, radius: number, strength: number, nx: number, ny: number, t: number, fish: Koi, target: Float32Array, colored: boolean) {
    const { cols, rows, cellW, cellH } = this;
    const x0 = Math.max(0, Math.floor((cx - radius) / cellW)), x1 = Math.min(cols - 1, Math.floor((cx + radius) / cellW));
    const y0 = Math.max(0, Math.floor((cy - radius) / cellH)), y1 = Math.min(rows - 1, Math.floor((cy + radius) / cellH));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5) * cellW - cx, dy = (y + 0.5) * cellH - cy;
        const d = Math.hypot(dx, dy) / radius;
        if (d >= 1) continue;
        const u = (dx * nx + dy * ny) / radius;
        const cover = strength * (d < 0.55 ? 1 : (1 - d) / 0.45) * (0.62 + 0.38 * (1 - Math.abs(u)));
        const i = y * cols + x;
        if (cover > target[i]) {
          target[i] = cover;
          if (colored) this.frame.fishColor[i] = fish.colorAt(t, u);
        }
      }
    }
  }
}
