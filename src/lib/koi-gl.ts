// GPU renderer for the koi pond, modelled on React Bits' GradientASCII and Dither:
//
//   1. A *field* pass renders the fish scene at one texel per character cell, with 2x2 supersampling
//      inside each cell: koi as signed-distance shapes (with eyes and patterned colouring), their
//      shadows, food pellets, and ripple crests. What is seen through the surface bends with the slope
//      of the water.
//   2. A *water* pass draws the pond itself the way React Bits' Dither does: a warped Perlin wave field,
//      ordered-Bayer-dithered to four levels into chunky pixels, bent and brightened by the ripples,
//      and knocked back beneath fish so they read clearly.
//   3. A *glyph* pass runs at full resolution. Each fragment looks up its cell, reads the field at the
//      cell centre, picks a character from a density-ordered atlas by tone, and samples that glyph
//      with derivative-based filtering so edges stay crisp at any DPR. Characters flicker on a
//      per-cell hashed tick.
//   4. A *halo* pass draws the glyphs at a quarter of the resolution, blurs them and adds them back
//      for a soft bloom.
//
// The CPU simulation in koi-pond.ts supplies the fish geometry (a texture) and the wave heights.

import { EXTRAS, MAX_FISH, MAX_PELLETS, Pond, SEGMENTS } from "./koi-pond";
import { FADE_PX, type KoiRenderer } from "./koi-renderer";

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
// Characters from empty to solid; they are re-ordered by measured ink so the ramp is truly monotonic.
const CHARSET = " .'`,:;-_~=+!ilI*vxzo0OX%#&@";

const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const HASH = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

const FIELD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec2 uGrid;
uniform vec2 uCell;
uniform float uTime;
uniform int uCount;
uniform int uPelletCount;
uniform vec4 uParams[${MAX_FISH}];
uniform vec4 uBounds[${MAX_FISH}];
uniform sampler2D uFish;
uniform sampler2D uWave;
layout(location = 0) out vec4 outField;
layout(location = 1) out vec4 outAux;
${HASH}
const int SEG = ${SEGMENTS};
const int EXTRA = ${EXTRAS};
const vec3 CREAM = vec3(1.0, 0.945, 0.84);
const vec3 ORANGE = vec3(1.0, 0.6, 0.24);
const vec3 RED = vec3(1.0, 0.36, 0.23);
const vec3 INK = vec3(0.54);
const vec3 GOLD = vec3(1.0, 0.78, 0.24);
const vec3 WATER = vec3(0.36, 0.84, 1.0);

float profile(float t) {
  if (t < 0.08) return mix(0.45, 0.8, t / 0.08);
  if (t < 0.25) return mix(0.8, 1.0, (t - 0.08) / 0.17);
  if (t < 0.5) return mix(1.0, 0.85, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(0.85, 0.42, (t - 0.5) / 0.25);
  if (t < 0.92) return mix(0.42, 0.18, (t - 0.75) / 0.17);
  return mix(0.18, 0.1, (t - 0.92) / 0.08);
}

vec3 koiColor(int kind, float seed, float t, float u) {
  if (kind == 2) return GOLD;
  float blotch = vnoise(vec2(t * 4.2 + seed, u * 1.4 + seed * 2.0));
  if (kind == 3) return mix(ORANGE, RED, smoothstep(0.66, 0.72, blotch));
  vec3 color = mix(CREAM, ORANGE, smoothstep(0.5, 0.55, blotch));
  color = mix(color, RED, smoothstep(0.58, 0.63, blotch));
  if (kind == 1) color = mix(color, INK, smoothstep(0.78, 0.82, vnoise(vec2(t * 9.0 + seed * 3.0, u * 2.0 + seed))));
  return color;
}

struct Hit { float d; float t; float u; float s; int id; float eye; };

// The nearest part of one fish to p: its body first, then its fins and tail only where the body misses.
Hit fishHit(int f, vec2 p) {
  Hit best = Hit(1e9, 0.0, 0.0, 1.0, f, 0.0);
  float half_ = uParams[f].y;
  // Every second spine point is plenty for a smooth capsule chain and halves the work.
  vec4 prev = texelFetch(uFish, ivec2(0, f), 0);
  int prevIndex = 0;
  for (int i = 2; i <= SEG + 1; i += 2) {
    int index = min(i, SEG - 1);
    vec4 cur = texelFetch(uFish, ivec2(index, f), 0);
    vec2 ab = cur.xy - prev.xy;
    float h = clamp(dot(p - prev.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    vec2 q = prev.xy + ab * h;
    float t = (float(prevIndex) + h * float(index - prevIndex)) / float(SEG - 1);
    float r = half_ * profile(t);
    float d = length(p - q) - r;
    if (d < best.d) {
      vec2 nrm = normalize(mix(prev.zw, cur.zw, h));
      best = Hit(d, t, dot(p - q, nrm) / max(r, 0.5), 1.0, f, 0.0);
    }
    prev = cur;
    prevIndex = index;
  }
  if (best.d < 0.0) {
    // Two eyes just behind the snout.
    vec4 head = texelFetch(uFish, ivec2(1, f), 0);
    for (int side = -1; side <= 1; side += 2) {
      vec2 c = head.xy + head.zw * float(side) * half_ * 0.5;
      if (length(p - c) < half_ * 0.17) best.eye = 1.0;
    }
    return best;
  }
  // Fins and tail only matter near where they are, so skip their discs everywhere else.
  float length_ = uParams[f].x;
  bool nearFins = length(p - texelFetch(uFish, ivec2(3, f), 0).xy) < half_ * 3.4;
  bool nearTail = length(p - texelFetch(uFish, ivec2(SEG - 1, f), 0).xy) < length_ * 0.46;
  if (!nearFins && !nearTail) return best;
  for (int e = 0; e < EXTRA; e++) {
    if (e < 4 ? !nearFins : !nearTail) continue;
    vec4 s = texelFetch(uFish, ivec2(SEG + e, f), 0);
    if (s.z <= 0.5) continue;
    float d = length(p - s.xy) - s.z;
    if (d < best.d) best = Hit(d, 0.97, 0.0, s.w, f, 0.0);
  }
  return best;
}

Hit query(vec2 p) {
  Hit best = Hit(1e9, 0.0, 0.0, 1.0, 0, 0.0);
  for (int f = 0; f < ${MAX_FISH}; f++) {
    if (f >= uCount) break;
    vec4 b = uBounds[f];
    if (distance(p, b.xy) > b.z) continue;
    Hit h = fishHit(f, p);
    if (h.d < best.d) best = h;
  }
  return best;
}

float waveAt(ivec2 c) {
  return texelFetch(uWave, clamp(c, ivec2(1), ivec2(uGrid) - 2), 0).r;
}

void main() {
  vec2 cell = vec2(floor(gl_FragCoord.x), uGrid.y - 1.0 - floor(gl_FragCoord.y));
  ivec2 ic = ivec2(cell);
  float h = waveAt(ic);
  vec2 grad = vec2(waveAt(ic + ivec2(1, 0)) - waveAt(ic - ivec2(1, 0)), waveAt(ic + ivec2(0, 1)) - waveAt(ic - ivec2(0, 1)));
  // What is seen through the surface is shifted by the slope of the water.
  vec2 bend = grad * 26.0;

  float fishCover = 0.0, shadowCover = 0.0, pelletCover = 0.0, shade = 0.0, eyeSum = 0.0;
  vec3 color = vec3(0.0);
  for (int sy = 0; sy < 2; sy++) {
    for (int sx = 0; sx < 2; sx++) {
      vec2 p = (cell + (vec2(float(sx), float(sy)) + 0.5) / 2.0) * uCell + bend;
      Hit hit = query(p);
      if (hit.d < 0.0) {
        float w = hit.s;
        fishCover += w;
        eyeSum += hit.eye * w;
        shade += w * (0.34 + 0.66 * pow(1.0 - abs(clamp(hit.u, -1.0, 1.0)), 0.8));
        vec4 prm = uParams[hit.id];
        color += w * koiColor(int(prm.w + 0.5), prm.z, hit.t, hit.u);
      } else {
        bool pellet = false;
        for (int i = 0; i < ${MAX_PELLETS}; i++) {
          if (i >= uPelletCount) break;
          vec4 pe = texelFetch(uFish, ivec2(i, ${MAX_FISH}), 0);
          if (length(p - pe.xy) < pe.z) { pellet = true; break; }
        }
        if (pellet) {
          pelletCover += 1.0;
        } else {
          Hit shadow = query(p - vec2(12.0, 17.0));
          if (shadow.d < 0.0) shadowCover += shadow.s * 0.5;
        }
      }
    }
  }
  float norm = max(fishCover, 1e-3);
  float eyeAmount = eyeSum / norm;
  fishCover /= 4.0;
  shadowCover /= 4.0;
  pelletCover /= 4.0;
  shade /= norm;
  color /= norm;

  // Only ripple crests are drawn as characters; the water itself is the dithered layer beneath.
  float ripple = clamp(abs(h) * 7.0, 0.0, 1.0);

  float tone, flicker;
  vec3 ink;
  if (fishCover > 0.12) {
    tone = clamp(fishCover * shade * 1.15, 0.0, 1.0) * (1.0 - 0.92 * eyeAmount);
    ink = color;
    flicker = 0.03;
  } else if (pelletCover > 0.2) {
    tone = 0.9;
    ink = vec3(1.0, 0.82, 0.5);
    flicker = 0.08;
  } else if (shadowCover > 0.06) {
    tone = 0.28 * clamp(shadowCover * 2.0, 0.0, 1.0);
    ink = vec3(0.3, 0.45, 0.5);
    flicker = 0.1;
  } else {
    tone = ripple * 0.45;
    ink = WATER;
    flicker = 0.5;
  }
  outField = vec4(ink, tone);
  outAux = vec4(flicker, ripple, 0.0, 1.0);
}`;

const GLYPH_COMMON = `
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uField;
uniform sampler2D uAux;
uniform sampler2D uAtlas;
uniform vec2 uResolution;
uniform vec2 uCellDev;
uniform vec2 uGrid;
uniform vec2 uAtlasGrid;
uniform float uCount;
uniform float uTime;
uniform vec2 uColumn;
uniform float uFadeDev;
uniform float uFlicker;
uniform float uOpacity;
${HASH}
vec4 glyphAt(vec2 frag) {
  vec2 px = vec2(frag.x, uResolution.y - frag.y);
  vec2 coord = px / uCellDev;
  // Derivatives are taken before any early return so they stay well defined.
  vec2 gx = dFdx(coord) / uAtlasGrid;
  vec2 gy = dFdy(coord) / uAtlasGrid;
  vec2 cell = floor(coord);
  vec2 local = coord - cell;
  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= uGrid.x || cell.y >= uGrid.y) return vec4(0.0);
  float cx = (cell.x + 0.5) * uCellDev.x;
  float dist = cx < uColumn.x ? uColumn.x - cx : (cx > uColumn.y ? cx - uColumn.y : 0.0);
  float fade = clamp(dist / uFadeDev, 0.0, 1.0);
  ivec2 tc = ivec2(int(cell.x), int(uGrid.y - 1.0 - cell.y));
  vec4 field = texelFetch(uField, tc, 0);
  vec4 aux = texelFetch(uAux, tc, 0);
  float tone = field.a;
  float level = hash12(cell * 1.73 + 4.1);
  float tick = floor(uTime * 9.0 + level * 9.0);
  float wobble = ((hash12(cell * 2.31 + tick * 17.7) - 0.5) * uFlicker + (level - 0.5) * 0.06) * aux.r;
  float shaped = clamp(pow(tone, 0.8) + wobble, 0.0, 1.0);
  float index = floor(shaped * (uCount - 1.0) + 0.5);
  float column = mod(index, uAtlasGrid.x);
  float row = floor(index / uAtlasGrid.x);
  vec2 uv = vec2((column + local.x) / uAtlasGrid.x, (row + local.y) / uAtlasGrid.y);
  float coverage = textureGrad(uAtlas, uv, gx, gy).a;
  float alpha = uOpacity * fade * smoothstep(0.02, 0.09, tone) * coverage;
  vec3 ink = clamp(field.rgb * (0.6 + 0.6 * tone), 0.0, 1.0);
  return vec4(ink * alpha, alpha);
}`;

const GLYPH = `#version 300 es
${GLYPH_COMMON}
out vec4 outColor;
void main() { outColor = glyphAt(gl_FragCoord.xy); }`;

const HALO = `#version 300 es
${GLYPH_COMMON}
uniform float uDownscale;
out vec4 outColor;
void main() { outColor = glyphAt(gl_FragCoord.xy * uDownscale); }`;


// ---------------------------------------------------------------------------------------------
// The pond: one pass at one texel per dither pixel, posterised with ordered dithering so the scene
// keeps the React Bits Dither look while carrying a rich palette. It holds the bed (sand and pebbles),
// refraction and caustics, patches of green water, a few lily pads, a mirrored dusk sky, skyline, bridge and
// train, and ripple highlights, and is drawn under the koi.
const NOISE = `${HASH}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec2 grad2(vec2 i) {
  float a = hash12(i) * 6.2831853;
  return vec2(cos(a), sin(a));
}
float pnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(dot(grad2(i), f), dot(grad2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(grad2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(grad2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}
// Fractal noise remapped to roughly [0, 1].
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * pnoise(p); p *= 2.02; a *= 0.5; }
  return clamp(v * 1.3 + 0.5, 0.0, 1.0);
}`;

const PIXEL_COMMON = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec2 uSize;
uniform float uPixel;
uniform vec2 uCell;
uniform vec2 uGrid;
uniform vec2 uView;
uniform float uTime;
uniform vec2 uColumn;
uniform float uFade;
uniform float uOpacity;
uniform sampler2D uWave;
out vec4 outColor;
${NOISE}
// 8x8 Bayer threshold in (0, 1).
float bayer8(vec2 p) {
  ivec2 q = ivec2(mod(p, 8.0));
  int a = q.x ^ q.y, b = q.y;
  int v = ((a & 1) << 5) | ((b & 1) << 4) | (((a >> 1) & 1) << 3) | (((b >> 1) & 1) << 2) | (((a >> 2) & 1) << 1) | ((b >> 2) & 1);
  return (float(v) + 0.5) / 64.0;
}
// Ordered dithering on every channel: a smooth colour becomes a limited palette of chunky dots.
vec3 posterize(vec3 c, vec2 pix, float levels) {
  float t = bayer8(pix) - 0.5;
  return floor(clamp(c + t / (levels - 1.0), 0.0, 1.0) * (levels - 1.0) + 0.5) / (levels - 1.0);
}
float wave(ivec2 c) {
  return texelFetch(uWave, clamp(c, ivec2(0), ivec2(uGrid) - 1), 0).r;
}
// Heights are stored per pond cell; interpolate so ripples are smooth at pixel scale.
float waveAt(vec2 css) {
  vec2 g = css / uCell - 0.5;
  vec2 i = floor(g), f = g - i;
  ivec2 b = ivec2(i);
  return mix(mix(wave(b), wave(b + ivec2(1, 0)), f.x), mix(wave(b + ivec2(0, 1)), wave(b + ivec2(1, 1)), f.x), f.y);
}
vec2 slopeAt(vec2 css) {
  return vec2(waveAt(css + vec2(uCell.x, 0.0)) - waveAt(css - vec2(uCell.x, 0.0)), waveAt(css + vec2(0.0, uCell.y)) - waveAt(css - vec2(0.0, uCell.y)));
}
// 0 at the dashed rails, 1 well into the margin.
float railFade(vec2 css) {
  float dist = css.x < uColumn.x ? uColumn.x - css.x : (css.x > uColumn.y ? css.x - uColumn.y : 0.0);
  return smoothstep(0.0, uFade, dist);
}
vec2 pixelOf() { return vec2(floor(gl_FragCoord.x), uSize.y - 1.0 - floor(gl_FragCoord.y)); }`;

const WATER = `${PIXEL_COMMON}
uniform sampler2D uField;
uniform sampler2D uAux;

vec3 stone(float id) {
  float k = fract(id * 7.31);
  if (k < 0.3) return vec3(0.66, 0.74, 0.78);
  if (k < 0.6) return vec3(0.36, 0.47, 0.56);
  if (k < 0.85) return vec3(0.52, 0.6, 0.64);
  return vec3(0.72, 0.66, 0.54);
}

// A clear pond floor: pale slate sand with sparse, domed pebbles lit from the upper left. One pebble
// per cell keeps this to a single lookup.
vec3 bedColor(vec2 p) {
  float n = pnoise(p * 0.011) * 0.6 + pnoise(p * 0.027) * 0.3 + 0.5;
  vec3 sand = mix(vec3(0.16, 0.32, 0.44), vec3(0.26, 0.45, 0.56), clamp(n, 0.0, 1.0));
  vec2 g = p / 36.0, ig = floor(g), fg = fract(g);
  vec2 c = 0.32 + 0.36 * hash22(ig);
  float radius = 0.15 + 0.1 * hash12(ig + 9.1);
  vec2 rel = (fg - c) / radius;
  float d2 = dot(rel, rel);
  float mask = step(0.5, hash12(ig + 4.4)) * smoothstep(1.0, 0.82, d2);
  vec3 nrm = normalize(vec3(rel * 0.9, sqrt(max(0.02, 1.0 - d2))));
  float diffuse = clamp(dot(nrm, normalize(vec3(-0.5, -0.6, 0.65))), 0.0, 1.0);
  vec3 st = stone(hash12(ig + 2.3)) * (0.5 + 0.7 * diffuse) + pow(diffuse, 10.0) * 0.12;
  return mix(sand, st, mask * 0.38);
}

vec2 rot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

// A lily pad (with a notch) and, on a few, a lotus flower. Each pad lives wholly inside its own cell,
// so this is one lookup per pixel. Returns the pad coverage; colour and flower come back through the
// out parameters.
const float PAD_CELL = 230.0;
float padAt(vec2 p, float t, out vec3 padColor, out vec3 flowerColor, out float flower) {
  padColor = vec3(0.0);
  flowerColor = vec3(0.0);
  flower = 0.0;
  vec2 id = floor(p / PAD_CELL);
  vec2 r = hash22(id);
  if (r.x > 0.32) return 0.0;
  vec2 r2 = hash22(id + 3.7), r3 = hash22(id + 8.1);
  float radius = PAD_CELL * (0.12 + 0.06 * r.y);
  vec2 centre = PAD_CELL * (0.3 + 0.4 * r2) + vec2(sin(t * 0.08 + r3.x * 6.0), cos(t * 0.07 + r3.y * 6.0)) * 10.0;
  vec2 q = rot(p - id * PAD_CELL - centre, -(r3.x * 6.2832 + t * 0.03));
  float d = length(q);
  float ang = atan(q.y, q.x);
  float inside = smoothstep(radius, radius - 1.6, d) * step(0.2, abs(ang));
  vec3 base = mix(vec3(0.07, 0.3, 0.14), vec3(0.3, 0.62, 0.26), smoothstep(radius, 0.0, d) * 0.8 + 0.2 * r2.x);
  base -= abs(sin(ang * 7.0)) * smoothstep(0.0, radius, d) * (1.0 - smoothstep(radius * 0.9, radius, d)) * 0.07;
  base += exp(-dot(q + radius * vec2(0.3, 0.35), q + radius * vec2(0.3, 0.35)) / (radius * radius * 0.12)) * 0.18;
  padColor = base;
  if (r.y > 0.6 && inside > 0.0) {
    float fr = length(q), fa = atan(q.y, q.x);
    float reach = radius * 0.5 * (0.55 + 0.45 * abs(cos(5.0 * fa)));
    flower = smoothstep(reach, reach - 1.5, fr);
    flowerColor = mix(vec3(1.0, 0.9, 0.95), vec3(1.0, 0.5, 0.72), clamp(fr / (radius * 0.5), 0.0, 1.0));
    flowerColor = mix(flowerColor, vec3(1.0, 0.82, 0.3), smoothstep(radius * 0.13, radius * 0.1, fr));
  }
  return inside;
}

// Every lit window is a warm yellow; only the brightness varies.
vec3 windowColor(float k) {
  return mix(vec3(1.0, 0.78, 0.2), vec3(1.0, 0.93, 0.5), k);
}

// What the water mirrors: a cool dusk sky, a skyline of towers hanging from the top edge with yellow
// windows, a moon with a broken glitter path, and a bridge with the occasional train crossing it.
// The reflection fades with distance from the shore.
// Lit windows, lamps and carriage glass come back through the light output so they can stay bright and yellow
// instead of being washed into the water like the silhouettes.
vec3 reflection(vec2 p, float t, out vec3 lightCol, out float light) {
  light = 0.0;
  lightCol = vec3(1.0, 0.8, 0.32);
  float far = smoothstep(0.0, uView.y * 0.85, p.y);
  vec3 col = mix(vec3(0.3, 0.5, 0.76), vec3(0.05, 0.08, 0.26), far) * 0.62;
  float w = 104.0;
  float ci = floor(p.x / w);
  float fx = p.x / w - ci;
  float tower = (0.2 + 0.62 * hash12(vec2(ci, 1.7))) * uView.y;
  if (fx > 0.14 && fx < 0.86 && p.y < tower * 0.65) {
    vec2 wc = vec2(fx * w, p.y) / vec2(15.0, 22.0);
    vec2 wid = floor(wc), wf = fract(wc);
    float lit = step(0.74, hash12(wid + ci * 13.0)) * step(0.15, wf.x) * step(wf.x, 0.85) * step(0.2, wf.y) * step(wf.y, 0.8);
    col = vec3(0.04, 0.05, 0.12);
    light = lit * (1.0 - 0.35 * p.y / tower);
    lightCol = windowColor(hash12(vec2(wid.y, ci) * 3.1));
  }

  // The bridge: piers from the shore, shallow arches and a deck with lamps. Its reflection hangs
  // below the deck line, so the train rides underneath it.
  float deck = uView.y * 0.3;
  const float SPAN = 168.0;
  float u = (fract(p.x / SPAN) - 0.5) * SPAN;
  float arch = deck - 34.0 * (1.0 - (u * u) / (SPAN * SPAN * 0.25));
  vec3 iron = vec3(0.02, 0.03, 0.08);
  if (p.y < deck && (abs(p.y - arch) < 2.5 || (abs(mod(p.x, 24.0) - 12.0) < 1.0 && p.y > arch) || abs(u) > SPAN * 0.5 - 5.0)) { col = iron; light = 0.0; }
  if (p.y > deck - 5.0 && p.y < deck) { col = iron; light = 0.0; }
  float lamp = step(abs(mod(p.x, 42.0) - 21.0), 1.5) * step(deck, p.y) * step(p.y, deck + 4.0);
  if (lamp > 0.0) { light = 1.0; lightCol = vec3(1.0, 0.84, 0.4); }

  // A train every 40 seconds, crossing in 15 and alternating direction.
  float trainLen = 5.0 * 74.0;
  float cycle = floor(t / 40.0);
  float run = (t - cycle * 40.0) / 15.0;
  if (run < 1.0 && p.y > deck && p.y < deck + 20.0) {
    float head = run * (uView.x + trainLen);
    float behind = mod(cycle, 2.0) < 1.0 ? head - p.x : p.x - (uView.x + trainLen - head);
    if (behind > 0.0 && behind < trainLen) {
      float within = mod(behind, 74.0);
      if (within < 68.0) {
        col = p.y < deck + 2.0 ? vec3(0.34, 0.44, 0.66) : vec3(0.12, 0.16, 0.32);
        float glass = step(deck + 5.0, p.y) * step(p.y, deck + 14.0) * step(abs(mod(within, 11.0) - 5.5), 3.0);
        light = glass;
        lightCol = vec3(1.0, 0.86, 0.45);
      }
    }
  }

  vec2 moon = vec2(uView.x * 0.16, uView.y * 0.2);
  float md = length(p - moon);
  col += vec3(0.95, 0.97, 1.0) * smoothstep(30.0, 25.0, md) * 1.2;
  float glitter = exp(-pow((p.x - moon.x) / (16.0 + p.y * 0.03), 2.0)) * step(0.4, hash12(vec2(floor(p.y / 7.0), floor(t * 0.5) + floor(p.x / 12.0)))) * smoothstep(moon.y, moon.y + uView.y * 0.15, p.y) * (1.0 - smoothstep(0.4, 1.0, p.y / uView.y));
  col += vec3(0.85, 0.93, 1.0) * glitter * 0.9;
  return col * (1.0 - 0.55 * far);
}

void main() {
  vec2 pix = pixelOf();
  vec2 css = (pix + 0.5) * uPixel;
  float fade = railFade(css);
  if (fade <= 0.0) { outColor = vec4(0.0); return; }
  float t = uTime;

  float h = waveAt(css);
  vec2 slope = slopeAt(css);
  vec2 wobble = vec2(pnoise(css * 0.02 + vec2(t * 0.15, 0.0)), pnoise(css * 0.02 + vec2(5.0, t * 0.12)));
  vec2 refract = slope * 70.0 + wobble * 5.0;

  // How deep the water is here: shallows show the bed, depths go dark and mirror the sky.
  float depth = clamp(fbm(css * 0.0032 + vec2(3.1, t * 0.004)) * 1.5 - 0.1, 0.0, 1.0);
  float deep = smoothstep(0.35, 0.75, depth);

  vec3 bed = bedColor(css + refract * (1.0 - 0.6 * deep));
  float caustic = pow(clamp(1.0 - abs(pnoise((css + refract) * 0.045 + t * 0.12) - pnoise((css + refract) * 0.055 - t * 0.1)) * 2.4, 0.0, 1.0), 6.0);
  bed += caustic * 0.22 * (1.0 - deep) * vec3(0.8, 0.95, 1.0);

  vec3 tint = mix(vec3(0.04, 0.3, 0.5), vec3(0.02, 0.13, 0.34), deep);
  // Slow patches of green water and algae keep the blue from reading as a flat swimming pool.
  float green = smoothstep(0.44, 0.74, fbm(css * 0.0055 + 9.0));
  tint = mix(tint, vec3(0.05, 0.32, 0.22), green * 0.75);
  bed = mix(bed, vec3(0.12, 0.34, 0.2), green * 0.55 * (1.0 - deep));
  vec3 body = mix(bed, tint, 0.3 + 0.4 * deep);

  vec3 lightCol;
  float light;
  vec3 mirrored = reflection(css + refract * 1.3 + vec2(sin(css.y * 0.045 + t * 0.7) * 6.0 + pnoise(css * 0.015 + t * 0.1) * 5.0, 0.0), t, lightCol, light);
  float mirror = (0.22 + 0.34 * deep) * (0.65 + 0.35 * vnoise(css * 0.012 + t * 0.05));
  vec3 color = mix(body, mirrored, mirror) * 0.82;
  color = mix(color, lightCol, light * (0.85 + 0.15 * deep));
  color += vec3(0.4, 0.65, 0.8) * smoothstep(0.05, 0.25, abs(h)) * 0.45;
  vec3 padColor, flowerColor;
  float flower;
  float pad = padAt(css, t, padColor, flowerColor, flower);
  color = mix(color, padColor, pad);
  color = mix(color, flowerColor, flower * step(0.01, pad));
  color = posterize(color, pix, 7.0);

  // Fish, food and shadows sit on the water: knock it back beneath them so the glyphs read clearly.
  ivec2 fc = ivec2(clamp(css / uCell, vec2(0.0), uGrid - 1.0));
  ivec2 tc = ivec2(fc.x, int(uGrid.y) - 1 - fc.y);
  float solid = texelFetch(uAux, tc, 0).r < 0.2 ? clamp(texelFetch(uField, tc, 0).a * 1.8, 0.0, 1.0) : 0.0;
  float alpha = fade * uOpacity * (1.0 - 0.88 * solid);
  outColor = vec4(color * alpha, alpha);
}`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uStep;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 sum = texture(uSource, vUv) * 0.2270270270;
  sum += (texture(uSource, vUv + uStep * 1.3846153846) + texture(uSource, vUv - uStep * 1.3846153846)) * 0.3162162162;
  sum += (texture(uSource, vUv + uStep * 3.2307692308) + texture(uSource, vUv - uStep * 3.2307692308)) * 0.0702702703;
  outColor = sum;
}`;

const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform float uGlow;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = texture(uSource, vUv) * uGlow; }`;

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

  private bindTexture(unit: number, texture: WebGLTexture | null, program: Program, name: string) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(this.uniform(program, name), unit);
  }

  private bindGlyphUniforms(program: Program, seconds: number, field: Target) {
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

  draw(pond: Pond, seconds: number) {
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. Halo: glyphs at low resolution, blurred.
    const [haloA, haloB] = this.halo;
    const halo = this.programs.halo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer);
    gl.viewport(0, 0, haloA.width, haloA.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(halo.program);
    this.bindGlyphUniforms(halo, seconds, this.field);
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const glyph = this.programs.glyph;
    gl.useProgram(glyph.program);
    this.bindGlyphUniforms(glyph, seconds, this.field);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const composite = this.programs.composite;
    gl.useProgram(composite.program);
    this.bindTexture(0, haloA.textures[0], composite, "uSource");
    gl.uniform1f(this.uniform(composite, "uGlow"), 0.6);
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
