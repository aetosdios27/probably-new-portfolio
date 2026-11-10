// GPU renderer for the koi pond, modelled on React Bits' GradientASCII and Dither:
//
//   1. A *field* pass renders the fish scene at one texel per character cell, with 2x2 supersampling
//      inside each cell: koi as signed-distance shapes (with eyes and patterned colouring), their
//      shadows, food pellets, and ripple crests. What is seen through the surface bends with the slope
//      of the water.
//   2. A *water* pass draws the pond itself the way React Bits' Dither does, ordered-Bayer-dithered
//      into chunky pixels: the bed, caustics, a mirrored sky and skyline, and whatever the season
//      puts on the surface, bent and brightened by the ripples and darkened beneath fish so they
//      read clearly.
//   3. A *glyph* pass runs at full resolution. Each fragment looks up its cell, reads the field at the
//      cell centre, picks a character from a density-ordered atlas by tone, and samples that glyph
//      with derivative-based filtering so edges stay crisp at any DPR. Characters flicker on a
//      per-cell hashed tick.
//   4. A *halo* pass draws the glyphs at a quarter of the resolution, blurs them and adds them back
//      for a soft bloom.
//
// The CPU simulation in koi-pond.ts supplies the fish geometry (a texture) and the wave heights.
// The palette and the weight of every seasonal layer come from a PondLook (pond-looks.ts), uploaded
// as one uniform per field; the shaders never branch on season or theme.

import { EXTRAS, MAX_FISH, Pond, SEGMENTS } from "./koi-pond";
import { FADE_PX, type KoiRenderer, type Pulse } from "./koi-renderer";
import { BLUR, COMPOSITE, FIELD, GLYPH, HALO, VERTEX, WATER } from "./koi-shaders";
import { LOOK_COLORS, LOOK_SCALARS, type LookScalar, type PondLook } from "./pond-looks";

export const GL_CELL_W = 4.5;
export const GL_CELL_H = 8;
const ATLAS_W = 32;
const ATLAS_H = 58;
const ATLAS_COLUMNS = 8;
const HALO_SCALE = 4;
/** CSS pixels per dither pixel in the water. */
// Dither pixel size in css px for each quality level; coarser water is much cheaper to shade.
const WATER_PIXELS = [3, 4, 6];
const WATER_FADE_PX = 210;
const LOOK_SCALAR_KEYS = Object.keys(LOOK_SCALARS) as LookScalar[];
// Characters from empty to solid; they are re-ordered by measured ink so the ramp is truly monotonic.
const CHARSET = " .'`,:;-_~=+!ilI*vxzo0OX%#&@";

type Program = { program: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> };
type Target = { framebuffer: WebGLFramebuffer; textures: WebGLTexture[]; width: number; height: number };

function must<T>(value: T | null, what: string): T {
  if (!value) throw new Error(`koi pond: could not create ${what}`);
  return value;
}

export class KoiGL implements KoiRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly programs: Record<"field" | "water" | "glyph" | "halo" | "blur" | "composite", Program>;
  private readonly vao: WebGLVertexArrayObject;
  private readonly fishTexture: WebGLTexture;
  private waveTexture: WebGLTexture | null = null;
  private atlas: { texture: WebGLTexture; count: number; columns: number; rows: number } | null = null;
  private field: Target | null = null;
  private halo: [Target, Target] | null = null;
  private water: Target | null = null;
  private view: [number, number] = [0, 0];
  private columnCss: [number, number] = [0, 0];
  private pond: Pond | null = null;
  private dpr = 1;
  private waterPixel = WATER_PIXELS[0];
  private column: [number, number] = [0, 0];

  /**
   * Whether the GPU renderer works here, tested on a throwaway canvas. A canvas that has handed out a
   * WebGL context can never give a 2D one, so the real canvas must not be used for the test.
   */
  static failure = "";

  static supported() {
    try {
      const scratch = document.createElement("canvas");
      const renderer = new KoiGL(scratch);
      renderer.dispose();
      scratch.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch (error) {
      KoiGL.failure = String(error instanceof Error ? error.message : error);
      console.warn("Koi pond: GPU renderer unavailable.", error);
      return false;
    }
  }

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error("koi pond: WebGL2 is not available");
    this.gl = gl;
    this.programs = {
      field: this.link(VERTEX, FIELD),
      water: this.link(VERTEX, WATER),
      glyph: this.link(VERTEX, GLYPH),
      halo: this.link(VERTEX, HALO),
      blur: this.link(VERTEX, BLUR),
      composite: this.link(VERTEX, COMPOSITE),
    };
    this.vao = must(gl.createVertexArray(), "vertex array");
    this.fishTexture = this.createDataTexture(SEGMENTS + EXTRAS, MAX_FISH + 1, gl.RGBA32F);
    this.buildAtlas();
  }

  private compile(type: number, source: string) {
    const gl = this.gl;
    const shader = must(gl.createShader(type), "shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? "";
      gl.deleteShader(shader);
      throw new Error(`koi pond shader: ${log}`);
    }
    return shader;
  }

  private link(vertex: string, fragment: string): Program {
    const gl = this.gl;
    const program = must(gl.createProgram(), "program");
    const shaders: WebGLShader[] = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = this.compile(type, source);
        shaders.push(shader);
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`koi pond program: ${gl.getProgramInfoLog(program)}`);
      for (const shader of shaders) gl.detachShader(program, shader);
      return { program, uniforms: new Map() };
    } catch (error) {
      for (const shader of shaders) gl.detachShader(program, shader);
      gl.deleteProgram(program);
      throw error;
    } finally {
      for (const shader of shaders) {
        gl.deleteShader(shader);
      }
    }
  }

  private uniform(program: Program, name: string) {
    let location = program.uniforms.get(name);
    if (location === undefined) {
      location = this.gl.getUniformLocation(program.program, name);
      program.uniforms.set(name, location);
    }
    return location;
  }

  private createDataTexture(width: number, height: number, internalFormat: number) {
    const gl = this.gl;
    const texture = must(gl.createTexture(), "texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internalFormat, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private createTarget(width: number, height: number, attachments: number, filter: number): Target {
    const gl = this.gl;
    const framebuffer = must(gl.createFramebuffer(), "framebuffer");
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    const textures: WebGLTexture[] = [];
    for (let i = 0; i < attachments; i++) {
      const texture = must(gl.createTexture(), "target texture");
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0);
      textures.push(texture);
    }
    gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("koi pond: incomplete framebuffer");
    return { framebuffer, textures, width, height };
  }

  private freeTarget(target: Target | null) {
    if (!target) return;
    this.gl.deleteFramebuffer(target.framebuffer);
    target.textures.forEach((texture) => this.gl.deleteTexture(texture));
  }

  /** Characters as white glyphs on a transparent grid, ordered by how much ink each one carries. */
  private buildAtlas() {
    const gl = this.gl;
    if (this.atlas) gl.deleteTexture(this.atlas.texture);
    const family = getComputedStyle(this.canvas).fontFamily;
    const font = `${Math.round(ATLAS_H * 0.9)}px ${family}`;
    const probe = document.createElement("canvas");
    probe.width = ATLAS_W;
    probe.height = ATLAS_H;
    const probeContext = probe.getContext("2d", { willReadFrequently: true });
    if (!probeContext) throw new Error("koi pond: no 2D context for the atlas");
    probeContext.font = font;
    probeContext.textAlign = "center";
    probeContext.textBaseline = "middle";
    probeContext.fillStyle = "#fff";
    const ink = (char: string) => {
      probeContext.clearRect(0, 0, ATLAS_W, ATLAS_H);
      probeContext.fillText(char, ATLAS_W / 2, ATLAS_H / 2 + ATLAS_H * 0.04);
      const pixels = probeContext.getImageData(0, 0, ATLAS_W, ATLAS_H).data;
      let total = 0;
      for (let i = 3; i < pixels.length; i += 4) total += pixels[i];
      return total;
    };
    const ordered = [...new Set(CHARSET)].map((char) => ({ char, ink: char === " " ? 0 : ink(char) })).sort((a, b) => a.ink - b.ink).map(({ char }) => char);

    const columns = Math.min(ATLAS_COLUMNS, ordered.length);
    const rows = Math.ceil(ordered.length / columns);
    const sheet = document.createElement("canvas");
    sheet.width = ATLAS_W * columns;
    sheet.height = ATLAS_H * rows;
    const context = sheet.getContext("2d");
    if (!context) throw new Error("koi pond: no 2D context for the atlas");
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    ordered.forEach((char, index) => {
      context.fillText(char, (index % columns) * ATLAS_W + ATLAS_W / 2, Math.floor(index / columns) * ATLAS_H + ATLAS_H / 2 + ATLAS_H * 0.04);
    });

    const texture = must(gl.createTexture(), "atlas texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.atlas = { texture, count: ordered.length, columns, rows };
  }

  resize(width: number, height: number, dpr: number, columnLeft: number, columnRight: number, quality = 0): Pond {
    const gl = this.gl;
    this.dpr = dpr;
    this.waterPixel = WATER_PIXELS[Math.min(quality, WATER_PIXELS.length - 1)];
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.column = [columnLeft * dpr, columnRight * dpr];
    this.columnCss = [columnLeft, columnRight];
    this.view = [width, height];
    this.pond = new Pond(width, height, GL_CELL_W, GL_CELL_H);

    this.freeTarget(this.field);
    this.field = this.createTarget(this.pond.cols, this.pond.rows, 2, gl.NEAREST);
    if (this.halo) this.halo.forEach((target) => this.freeTarget(target));
    const haloWidth = Math.ceil(this.canvas.width / HALO_SCALE), haloHeight = Math.ceil(this.canvas.height / HALO_SCALE);
    this.halo = [this.createTarget(haloWidth, haloHeight, 1, gl.LINEAR), this.createTarget(haloWidth, haloHeight, 1, gl.LINEAR)];

    this.freeTarget(this.water);
    this.water = this.createTarget(Math.ceil(width / this.waterPixel), Math.ceil(height / this.waterPixel), 1, gl.NEAREST);

    if (this.waveTexture) gl.deleteTexture(this.waveTexture);
    this.waveTexture = this.createDataTexture(this.pond.cols, this.pond.rows, gl.R32F);
    return this.pond;
  }

  private bindLook(program: Program, look: PondLook) {
    const gl = this.gl;
    for (const key of LOOK_SCALAR_KEYS) gl.uniform1f(this.uniform(program, `L_${key}`), look[key]);
    for (const key of LOOK_COLORS) gl.uniform3f(this.uniform(program, `L_${key}`), look[key][0], look[key][1], look[key][2]);
  }

  private bindTexture(unit: number, texture: WebGLTexture | null, program: Program, name: string) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(this.uniform(program, name), unit);
  }

  private bindGlyphUniforms(program: Program, seconds: number, field: Target, look: PondLook) {
    this.gl.uniform3f(this.uniform(program, "uWhite"), look.whitePoint[0], look.whitePoint[1], look.whitePoint[2]);
    const gl = this.gl, atlas = this.atlas!, pond = this.pond!;
    this.bindTexture(0, field.textures[0], program, "uField");
    this.bindTexture(1, field.textures[1], program, "uAux");
    this.bindTexture(2, atlas.texture, program, "uAtlas");
    gl.uniform2f(this.uniform(program, "uResolution"), this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uniform(program, "uCellDev"), GL_CELL_W * this.dpr, GL_CELL_H * this.dpr);
    gl.uniform2f(this.uniform(program, "uGrid"), pond.cols, pond.rows);
    gl.uniform2f(this.uniform(program, "uAtlasGrid"), atlas.columns, atlas.rows);
    gl.uniform1f(this.uniform(program, "uCount"), atlas.count);
    gl.uniform1f(this.uniform(program, "uTime"), seconds);
    gl.uniform2f(this.uniform(program, "uColumn"), this.column[0], this.column[1]);
    gl.uniform1f(this.uniform(program, "uFadeDev"), FADE_PX * this.dpr);
    gl.uniform1f(this.uniform(program, "uFlicker"), 1);
    gl.uniform1f(this.uniform(program, "uOpacity"), 1);
  }

  private bindPulse(program: Program, pulse: Pulse | null | undefined) {
    const gl = this.gl;
    gl.uniform4f(this.uniform(program, "uPulse"), pulse?.x ?? 0, pulse?.y ?? 0, pulse?.radius ?? 0, Math.max(1, pulse?.reach ?? 1));
    gl.uniform1f(this.uniform(program, "uPulseDir"), pulse?.direction ?? 0);
  }

  draw(pond: Pond, seconds: number, look: PondLook, pulse?: Pulse | null) {
    const gl = this.gl;
    if (!this.field || !this.halo || !this.atlas || !this.waveTexture || !this.water) return;
    const data = pond.gpuData();
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    gl.bindTexture(gl.TEXTURE_2D, this.fishTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SEGMENTS + EXTRAS, MAX_FISH + 1, gl.RGBA, gl.FLOAT, data.fishTexture);
    gl.bindTexture(gl.TEXTURE_2D, this.waveTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, data.cols, data.rows, gl.RED, gl.FLOAT, data.wave);

    // 1. Field.
    const field = this.programs.field;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.field.framebuffer);
    gl.viewport(0, 0, this.field.width, this.field.height);
    gl.useProgram(field.program);
    this.bindTexture(0, this.fishTexture, field, "uFish");
    this.bindTexture(1, this.waveTexture, field, "uWave");
    gl.uniform2f(this.uniform(field, "uGrid"), data.cols, data.rows);
    gl.uniform2f(this.uniform(field, "uCell"), GL_CELL_W, GL_CELL_H);
    gl.uniform1f(this.uniform(field, "uTime"), seconds);
    gl.uniform1i(this.uniform(field, "uCount"), data.count);
    gl.uniform1i(this.uniform(field, "uPelletCount"), data.pelletCount);
    gl.uniform4fv(this.uniform(field, "uParams"), data.params);
    gl.uniform4fv(this.uniform(field, "uBounds"), data.bounds);
    this.bindLook(field, look);
    this.bindPulse(field, pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. Halo: glyphs at low resolution, blurred.
    const [haloA, haloB] = this.halo;
    const halo = this.programs.halo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer);
    gl.viewport(0, 0, haloA.width, haloA.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(halo.program);
    this.bindGlyphUniforms(halo, seconds, this.field, look);
    gl.uniform1f(this.uniform(halo, "uDownscale"), HALO_SCALE);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const blur = this.programs.blur;
    gl.useProgram(blur.program);
    const blurPass = (source: Target, target: Target, dx: number, dy: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, target.width, target.height);
      this.bindTexture(0, source.textures[0], blur, "uSource");
      gl.uniform2f(this.uniform(blur, "uStep"), dx / source.width, dy / source.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    blurPass(haloA, haloB, 1, 0);
    blurPass(haloB, haloA, 0, 1);

    // 3. The pond water under the koi, at one texel per dither pixel.
    const pixelUniforms = (program: Program, opacity: number) => {
      gl.uniform2f(this.uniform(program, "uSize"), this.water!.width, this.water!.height);
      gl.uniform1f(this.uniform(program, "uPixel"), this.waterPixel);
      gl.uniform2f(this.uniform(program, "uCell"), GL_CELL_W, GL_CELL_H);
      gl.uniform2f(this.uniform(program, "uGrid"), data.cols, data.rows);
      gl.uniform2f(this.uniform(program, "uView"), this.view[0], this.view[1]);
      gl.uniform1f(this.uniform(program, "uTime"), seconds);
      gl.uniform2f(this.uniform(program, "uColumn"), this.columnCss[0], this.columnCss[1]);
      gl.uniform1f(this.uniform(program, "uFade"), WATER_FADE_PX);
      gl.uniform1f(this.uniform(program, "uGlyphFade"), FADE_PX);
      gl.uniform1f(this.uniform(program, "uOpacity"), opacity);
    };
    const water = this.programs.water;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.water.framebuffer);
    gl.viewport(0, 0, this.water.width, this.water.height);
    gl.useProgram(water.program);
    this.bindTexture(0, this.waveTexture, water, "uWave");
    this.bindTexture(1, this.field.textures[0], water, "uField");
    this.bindTexture(2, this.field.textures[1], water, "uAux");
    pixelUniforms(water, 0.92);
    this.bindLook(water, look);
    this.bindPulse(water, pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 4. To the screen: water, then glyphs, then the halo added on top.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const blit = this.programs.composite;
    gl.useProgram(blit.program);
    this.bindTexture(0, this.water.textures[0], blit, "uSource");
    gl.uniform1f(this.uniform(blit, "uGlow"), 1);
    gl.uniform1f(this.uniform(blit, "uCover"), 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const glyph = this.programs.glyph;
    gl.useProgram(glyph.program);
    this.bindGlyphUniforms(glyph, seconds, this.field, look);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const composite = this.programs.composite;
    gl.useProgram(composite.program);
    this.bindTexture(0, haloA.textures[0], composite, "uSource");
    gl.uniform1f(this.uniform(composite, "uGlow"), look.halo);
    gl.uniform1f(this.uniform(composite, "uCover"), look.haloShade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    const gl = this.gl;
    // The context itself is left alive on purpose: React may remount on this same canvas.
    this.freeTarget(this.field);
    this.halo?.forEach((target) => this.freeTarget(target));
    this.freeTarget(this.water);
    if (this.waveTexture) gl.deleteTexture(this.waveTexture);
    if (this.atlas) gl.deleteTexture(this.atlas.texture);
    gl.deleteTexture(this.fishTexture);
    gl.deleteVertexArray(this.vao);
    Object.values(this.programs).forEach(({ program }) => gl.deleteProgram(program));
  }
}
