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

import { EXTRAS, MAX_FISH, MAX_PELLETS, Pond, SEGMENTS } from "./koi-pond";
import { FADE_PX, type KoiRenderer } from "./koi-renderer";
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
// Characters from empty to solid; they are re-ordered by measured ink so the ramp is truly monotonic.
const CHARSET = " .'`,:;-_~=+!ilI*vxzo0OX%#&@";

const LOOK_SCALAR_KEYS = Object.keys(LOOK_SCALARS) as LookScalar[];
// One uniform per look field, named after it: L_snow, L_bedLow, and so on.
const LOOK_UNIFORMS = [...LOOK_SCALAR_KEYS.map((key) => `uniform float L_${key};`), ...LOOK_COLORS.map((key) => `uniform vec3 L_${key};`)].join("\n");

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
${LOOK_UNIFORMS}
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
    ink = L_glyphShadow;
    flicker = 0.1;
  } else {
    tone = ripple * L_crest;
    ink = L_glyphRipple;
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
// refraction and caustics, patches of green water, the mirrored sky, skyline, bridge and train, ripple
// highlights, and the seasonal surface (pads, petals, leaves, ice, snow, mist), and is drawn under the koi.
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
// Fractal noise remapped to roughly [0, 1]. Three octaves: the fourth was below a dither pixel.
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * pnoise(p); p *= 2.02; a *= 0.5; }
  return clamp(v * 1.4 + 0.5, 0.0, 1.0);
}
// Cheap soft billows in [0, 1] for clouds and mist.
float billow(vec2 p, float t) {
  return vnoise(p) * 0.55 + vnoise(p * 2.1 + vec2(3.0 + t, 1.7)) * 0.3 + vnoise(p * 4.3 - vec2(t * 1.6, 5.0)) * 0.15;
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
uniform float uGlyphFade;
uniform float uOpacity;
uniform sampler2D uWave;
${LOOK_UNIFORMS}
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
vec3 posterize(vec3 c, float threshold, float levels) {
  return floor(clamp(c + (threshold - 0.5) / (levels - 1.0), 0.0, 1.0) * (levels - 1.0) + 0.5) / (levels - 1.0);
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
// Distance in css px from the dashed rails, 0 over the content column.
float railDistance(vec2 css) {
  return css.x < uColumn.x ? uColumn.x - css.x : (css.x > uColumn.y ? css.x - uColumn.y : 0.0);
}
vec2 pixelOf() { return vec2(floor(gl_FragCoord.x), uSize.y - 1.0 - floor(gl_FragCoord.y)); }`;

// Every layer below is weighted by a field of the look (the L_ uniforms) and skipped when its
// weight is zero, so a look only pays for what it shows. Nothing here knows the season or theme.
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

// A clear pond floor: sand with sparse, domed pebbles lit from the upper left. One pebble per cell
// keeps this to a single lookup.
vec3 bedColor(vec2 p) {
  float n = pnoise(p * 0.011) * 0.6 + pnoise(p * 0.027) * 0.3 + 0.5;
  vec3 sand = mix(L_bedLow, L_bedHigh, clamp(n, 0.0, 1.0));
  vec2 g = p / 36.0, ig = floor(g), fg = fract(g);
  vec2 c = 0.32 + 0.36 * hash22(ig);
  float radius = 0.15 + 0.1 * hash12(ig + 9.1);
  vec2 rel = (fg - c) / radius;
  float d2 = dot(rel, rel);
  if (d2 > 1.0 || hash12(ig + 4.4) < 0.5) return sand;
  vec3 nrm = normalize(vec3(rel * 0.9, sqrt(max(0.02, 1.0 - d2))));
  float diffuse = clamp(dot(nrm, normalize(vec3(-0.5, -0.6, 0.65))), 0.0, 1.0);
  // Pebbles take on the colour of the sand around them, so one set of stones suits every season.
  vec3 st = mix(stone(hash12(ig + 2.3)), sand * 1.5, 0.35) * (0.5 + 0.7 * diffuse) + pow(diffuse, 10.0) * 0.12;
  return mix(sand, st, smoothstep(1.0, 0.82, d2) * 0.38 * L_pebbles);
}

vec2 rot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

// A lily pad (with a notch) and, on some, a lotus. Each pad lives wholly inside its own lattice
// cell, so this is one lookup per pixel, and most pixels leave before any trigonometry. Returns the
// pad coverage; the colour (flower included) comes back through the out parameter.
float padAt(vec2 p, float t, float cell, float density, float seed, out vec3 padColor) {
  padColor = vec3(0.0);
  vec2 id = floor(p / cell);
  vec2 r = hash22(id + seed);
  if (r.x > density) return 0.0;
  vec2 r2 = hash22(id + seed + 3.7), r3 = hash22(id + seed + 8.1);
  float radius = cell * (0.12 + 0.06 * r.y);
  vec2 centre = cell * (0.3 + 0.4 * r2) + vec2(sin(t * 0.08 + r3.x * 6.0), cos(t * 0.07 + r3.y * 6.0)) * cell * 0.045;
  vec2 q = p - id * cell - centre;
  float d = length(q);
  if (d > radius) return 0.0;
  q = rot(q, -(r3.x * 6.2832 + t * 0.03));
  float ang = atan(q.y, q.x);
  float inside = smoothstep(radius, radius - 1.6, d) * step(0.2, abs(ang));
  vec3 base = mix(L_padDark, L_padLight, smoothstep(radius, 0.0, d) * 0.8 + 0.2 * r2.x);
  base -= abs(sin(ang * 7.0)) * smoothstep(0.0, radius, d) * (1.0 - smoothstep(radius * 0.9, radius, d)) * 0.07;
  base += exp(-dot(q + radius * vec2(0.3, 0.35), q + radius * vec2(0.3, 0.35)) / (radius * radius * 0.12)) * 0.18;
  // A flower opens from a tight bud to a full star as the lotus weight rises.
  if (r.y > 1.0 - 0.62 * L_lotus) {
    float open = 0.3 + 0.7 * L_lotus;
    float reach = radius * 0.5 * open * (0.55 + 0.45 * abs(cos(5.0 * ang)) * open);
    vec3 flower = mix(vec3(1.0, 0.92, 0.95), L_lotusColor, clamp(d / (radius * 0.5 * open), 0.0, 1.0));
    flower = mix(flower, vec3(1.0, 0.82, 0.3), smoothstep(radius * 0.13, radius * 0.1, d) * L_lotus);
    base = mix(base, flower, smoothstep(reach, reach - 1.5, d));
  }
  padColor = base;
  return inside;
}

// Small things afloat, one per lattice cell: a petal when leafy is 0, a leaf when it is 1. The
// whole lattice slides with the current and bends along a slow meander, each one spins and bobs at
// its own rate, and a slow crowding field gathers them into drifts.
float drifter(vec2 p, float t, float cell, float density, float seed, float leafy, vec3 a, vec3 b, vec3 c, out vec3 col) {
  col = vec3(0.0);
  vec2 flow = vec2(cos(seed * 2.4), 0.6 * sin(seed * 2.4)) * (2.5 + 12.0 * L_wind);
  vec2 q = p - flow * t + 18.0 * vec2(sin(p.y * 0.006 + t * 0.05 + seed), cos(p.x * 0.005 - t * 0.04 + seed * 1.7));
  vec2 id = floor(q / cell);
  vec2 r = hash22(id + seed * 17.0);
  float crowd = vnoise(id * 0.3 + seed * 5.0);
  if (r.x > density * (0.1 + 1.9 * crowd * crowd)) return 0.0;
  vec2 r2 = hash22(id + seed * 17.0 + 5.3);
  float size = cell * (0.14 + 0.15 * r.y);
  vec2 centre = cell * (0.32 + 0.36 * r2) + cell * 0.03 * vec2(sin(t * 0.3 + r.y * 40.0), cos(t * 0.23 + r2.x * 40.0));
  vec2 v = q - id * cell - centre;
  if (dot(v, v) > size * size) return 0.0;
  v = rot(v, r2.x * 6.2832 + t * (r2.y - 0.5) * 0.5) / size;
  float along = 1.0 - v.x * v.x;
  float halfWidth = mix(0.62 * sqrt(max(along, 0.0)), 0.5 * along, leafy);
  if (abs(v.y) > halfWidth) return 0.0;
  float k = fract(r2.y * 7.31 + r.y);
  col = k < 0.4 ? a : (k < 0.75 ? b : c);
  // One half catches the light, and a leaf has a midrib.
  col *= 0.86 + 0.26 * step(0.0, v.y) + 0.1 * v.x;
  col *= 1.0 - 0.3 * leafy * step(abs(v.y), 0.09);
  return 1.0;
}

// Things falling onto the water, seen from above: each shrinks as it drops away from the eye,
// slides with the wind, and is gone when it lands. A new one starts somewhere else in the cell
// every cycle, so the lattice never shows.
float faller(vec2 p, float t, float cell, float density, float seed) {
  vec2 id = floor(p / cell);
  float phase = t * (0.16 + 0.1 * hash12(id + seed)) + hash12(id + seed + 2.9);
  float cycle = floor(phase), life = phase - cycle;
  vec2 r = hash22(id + seed + cycle * 7.13);
  if (r.x > density) return 0.0;
  vec2 r2 = hash22(id + seed + cycle * 3.71 + 1.3);
  vec2 start = cell * (0.25 + 0.3 * r2);
  vec2 slide = cell * (0.1 + 0.3 * L_wind) * vec2(0.9, 0.5) * life + cell * 0.04 * vec2(sin(life * 9.0 + r.y * 30.0), 0.0);
  float radius = cell * (0.035 + 0.05 * r.y) * (1.25 - life);
  float d = length(p - id * cell - start - slide);
  return smoothstep(radius, radius - 1.2, d) * smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.9, life);
}

// The shadow of a bare tree standing just outside each margin. In polar coordinates around its
// trunk a limb is a line of constant angle; each limb forks twice, the forks leaving their parent at
// a radius of their own, and everything tapers toward the tips and sways a little, tips most.
float branchShadow(vec2 p, float t) {
  bool left = p.x < uView.x * 0.5;
  vec2 trunk = left ? vec2(-90.0, uView.y * 0.66) : vec2(uView.x + 90.0, uView.y * 0.3);
  vec2 v = p - trunk;
  float r = length(v);
  const float REACH = 640.0;
  if (r > REACH) return 0.0;
  float angle = atan(v.y, left ? v.x : -v.x);
  angle += 0.22 * pnoise(vec2(r * 0.006, angle * 2.5 + (left ? 0.0 : 9.0))) + 0.012 * sin(t * 0.45 + r * 0.012) * r / REACH;
  const float SPREAD = 0.46;
  float limb = floor(angle / SPREAD + 0.5);
  float a = abs(angle - limb * SPREAD);
  vec2 h = hash22(vec2(limb, left ? 3.0 : 7.0));
  float fork1 = 110.0 + 150.0 * h.x, fork2 = fork1 + 90.0 + 110.0 * h.y;
  float c1 = SPREAD * 0.3 * smoothstep(fork1, fork1 + 260.0, r);
  float c2 = SPREAD * 0.13 * smoothstep(fork2, fork2 + 200.0, r);
  float taper = 1.0 - r / REACH;
  float d0 = a * r, d1 = abs(a - c1) * r, d2 = abs(abs(a - c1) - c2) * r;
  float shadow = smoothstep(1.5, 0.0, d0 - 5.5 * taper);
  shadow = max(shadow, smoothstep(1.5, 0.0, d1 - 3.6 * taper) * step(fork1, r));
  shadow = max(shadow, smoothstep(1.5, 0.0, d2 - 2.2 * taper) * step(fork2, r) * 0.85);
  return shadow * smoothstep(0.0, 0.12, taper);
}

// Every lit window is a warm yellow; only the brightness varies.
vec3 windowColor(float k) {
  return mix(vec3(1.0, 0.78, 0.2), vec3(1.0, 0.93, 0.5), k);
}

// What the water mirrors: the sky with its stars or clouds, a moon or sun with a broken glitter
// path, a skyline of towers hanging from the top edge, and a bridge with the occasional train
// crossing it. Lit windows, lamps and carriage glass come back through the light output so they can
// stay bright instead of being washed into the water like the silhouettes. flash is the sheet
// lightning of the moment: it lights the sky and the cloud but not the buildings, so they stand out.
vec3 reflection(vec2 p, float t, float flash, out vec3 lightCol, out float light) {
  light = 0.0;
  lightCol = vec3(1.0, 0.8, 0.32);
  float far = smoothstep(0.0, uView.y * 0.85, p.y);
  vec3 col = mix(L_skyNear, L_skyFar, far);

  float cloud = 0.0;
  if (L_clouds > 0.0) {
    float drift = t * (1.5 + 13.0 * L_wind);
    float n = billow((p + vec2(drift, drift * 0.15)) * vec2(0.0035, 0.0062), t * 0.02);
    float edge = 0.92 - 0.72 * L_clouds;
    cloud = smoothstep(edge - 0.1, edge + 0.1, n);
    // Thick cloud is darker underneath; lightning glows from inside it.
    col = mix(col, L_cloudColor * (1.12 - 0.5 * smoothstep(edge, edge + 0.35, n)), cloud * 0.92);
  }
  col += flash * vec3(0.62, 0.66, 0.86) * (0.3 + 0.7 * cloud) * (1.0 - 0.5 * far);

  if (L_stars > 0.0) {
    vec2 sc = p / 11.0, si = floor(sc), sf = fract(sc) - 0.5;
    float sh = hash12(si + 31.7);
    if (sh > 1.0 - 0.09 * L_stars) {
      vec2 off = sf - (hash22(si) - 0.5) * 0.5;
      float twinkle = 0.55 + 0.45 * sin(t * (0.5 + sh * 17.0) + sh * 90.0);
      col += vec3(0.82, 0.88, 1.0) * step(max(abs(off.x), abs(off.y)), 0.2) * twinkle * (1.0 - cloud) * (0.5 + 0.9 * fract(sh * 57.0));
    }
  }

  // The moon or sun hangs in the middle of the left margin, behind the skyline.
  vec2 orb = vec2(uColumn.x * 0.52, uView.y * 0.2);
  float od = length(p - orb);
  float veil = 1.0 - 0.75 * cloud;
  col += L_orb * (smoothstep(L_orbSize, L_orbSize - 5.0, od) * 1.2 + L_orbGlow * 0.55 * exp(-od * od / (L_orbSize * L_orbSize * 5.0))) * veil;
  float glitter = exp(-pow((p.x - orb.x) / (L_orbSize * 0.57 + p.y * 0.03), 2.0)) * step(0.4, hash12(vec2(floor(p.y / 7.0), floor(t * 0.5) + floor(p.x / 12.0)))) * smoothstep(orb.y, orb.y + uView.y * 0.15, p.y) * (1.0 - smoothstep(0.4, 1.0, p.y / uView.y));
  col += L_orb * glitter * L_glitter * veil;

  float w = 104.0;
  float ci = floor(p.x / w);
  float fx = p.x / w - ci;
  // Towers beside the moon or sun stay low, so it always clears the roofline.
  float tower = (0.2 + 0.62 * hash12(vec2(ci, 1.7))) * uView.y * mix(0.42, 1.0, smoothstep(w * 0.8, w * 2.4, abs((ci + 0.5) * w - orb.x)));
  if (fx > 0.14 && fx < 0.86 && p.y < tower * 0.65) {
    vec2 wc = vec2(fx * w, p.y) / vec2(15.0, 22.0);
    vec2 wid = floor(wc), wf = fract(wc);
    float pane = step(0.15, wf.x) * step(wf.x, 0.85) * step(0.2, wf.y) * step(wf.y, 0.8);
    // Unlit panes are a shade darker than the wall, which only shows on a daytime silhouette.
    col = L_skyline * (1.0 - 0.14 * pane);
    light = pane * step(1.0 - L_windows, hash12(wid + ci * 13.0)) * (1.0 - 0.35 * p.y / tower) * L_lights;
    lightCol = windowColor(hash12(vec2(wid.y, ci) * 3.1));
  }

  // The bridge: piers from the shore, shallow arches and a deck with lamps. Its reflection hangs
  // below the deck line, so the train rides underneath it.
  float deck = uView.y * 0.3;
  const float SPAN = 168.0;
  float u = (fract(p.x / SPAN) - 0.5) * SPAN;
  float arch = deck - 34.0 * (1.0 - (u * u) / (SPAN * SPAN * 0.25));
  vec3 iron = L_skyline * 0.5;
  if (p.y < deck && (abs(p.y - arch) < 2.5 || (abs(mod(p.x, 24.0) - 12.0) < 1.0 && p.y > arch) || abs(u) > SPAN * 0.5 - 5.0)) { col = iron; light = 0.0; }
  if (p.y > deck - 5.0 && p.y < deck) { col = iron; light = 0.0; }
  float lamp = step(abs(mod(p.x, 42.0) - 21.0), 1.5) * step(deck, p.y) * step(p.y, deck + 4.0);
  if (lamp > 0.0) { light = L_lights; lightCol = vec3(1.0, 0.84, 0.4); }

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
        float glass = step(deck + 5.0, p.y) * step(p.y, deck + 14.0) * step(abs(mod(within, 11.0) - 5.5), 3.0);
        col = p.y < deck + 2.0 ? mix(L_train, vec3(0.8, 0.86, 1.0), 0.3) : L_train * (1.0 - 0.45 * glass);
        light = glass * L_lights;
        lightCol = vec3(1.0, 0.86, 0.45);
      }
    }
  }
  return col;
}

void main() {
  vec2 pix = pixelOf();
  vec2 css = (pix + 0.5) * uPixel;
  float rail = railDistance(css);
  float fade = smoothstep(0.0, uFade, rail);
  if (fade <= 0.0) { outColor = vec4(0.0); return; }
  float t = uTime;
  float threshold = bayer8(pix);

  float h = waveAt(css);
  vec2 slope = slopeAt(css);
  vec2 wobble = vec2(pnoise(css * 0.02 + vec2(t * 0.15, 0.0)), pnoise(css * 0.02 + vec2(5.0, t * 0.12)));

  // How deep the water is here: shallows show the bed, depths go dark and mirror the sky.
  float depth = clamp(fbm(css * 0.0032 + vec2(3.1, t * 0.004)) * 1.5 - 0.1, 0.0, 1.0);
  float deep = smoothstep(0.35, 0.75, depth);

  // Ice grows out from the shallows. It is rigid, so nothing under or on it ripples.
  float ice = 0.0, rim = 0.0;
  if (L_ice > 0.0) {
    float sheet = 1.0 - depth + 0.1 * pnoise(css * 0.021 + 7.0) + 0.035 * pnoise(css * 0.07);
    float shore = 1.02 - 0.62 * L_ice;
    ice = smoothstep(shore, shore + 0.02, sheet);
    rim = ice * (1.0 - smoothstep(shore + 0.02, shore + 0.07, sheet));
  }
  float loose = 1.0 - ice;
  vec2 refract = (slope * 70.0 + wobble * 5.0) * loose;

  vec3 bed = bedColor(css + refract * (1.0 - 0.6 * deep));
  float caustic = 0.0;
  if (L_caustic > 0.0) {
    caustic = pow(clamp(1.0 - abs(pnoise((css + refract) * 0.045 + t * 0.12) - pnoise((css + refract) * 0.055 - t * 0.1)) * 2.4, 0.0, 1.0), 6.0) * (1.0 - deep) * (1.0 - 0.7 * ice);
    bed += caustic * L_caustic * L_causticColor;
  }

  vec3 tint = mix(L_shallow, L_deep, deep);
  // Slow patches of green water and algae keep the pond from reading as a flat swimming pool.
  if (L_algaeAmount > 0.0) {
    float green = smoothstep(0.44, 0.74, fbm(css * 0.0055 + 9.0)) * L_algaeAmount;
    tint = mix(tint, L_algae, green * 0.75);
    bed = mix(bed, L_algae * 1.06 + 0.04, green * 0.55 * (1.0 - deep));
  }
  vec3 body = mix(bed, tint, clamp((0.3 + 0.4 * deep) * L_murk, 0.0, 1.0));

  // Sheet lightning: one soft swell somewhere in each 31 second window, never in the first 14 s.
  float flash = 0.0;
  if (L_lightning > 0.0) {
    float window = floor(t / 31.0);
    float since = t - window * 31.0 - 14.0 - 10.0 * hash12(vec2(window, 5.7));
    flash = L_lightning * smoothstep(0.0, 0.28, since) * exp(-max(since - 0.28, 0.0) * 1.6) * step(0.0, since);
  }

  vec3 lightCol;
  float light;
  vec3 mirrored = reflection(css + refract * 1.3 + vec2(sin(css.y * 0.045 + t * 0.7) * 6.0 + wobble.x * 5.0, 0.0) * loose, t, flash, lightCol, light);
  float mirror = (0.22 + 0.34 * deep) * (0.65 + 0.35 * vnoise(css * 0.012 + t * 0.05)) * L_mirror;
  vec3 color = mix(body, mirrored, clamp(mirror, 0.0, 1.0)) * L_gain;
  color += flash * 0.05;
  color = mix(color, lightCol, light * (0.85 + 0.15 * deep) * (1.0 - 0.45 * ice));
  // Sunlight or moonlight sparking along the brightest caustic lines.
  color += L_orb * smoothstep(0.55, 0.95, caustic) * L_glitter * 0.3;
  color += L_rippleColor * smoothstep(0.05, 0.25, abs(h)) * L_ripple * loose;

  if (ice > 0.0) {
    // Frosted, a little snow lying on it, a bright rim where it meets open water, and fine
    // cracks that are densest near that rim.
    vec3 frost = mix(color, L_iceColor, 0.55 + 0.2 * vnoise(css * 0.03));
    float lying = smoothstep(0.5, 0.75, vnoise(css * 0.016 + 4.0) + 0.2 * vnoise(css * 0.09)) * L_snow;
    frost = mix(frost, L_snowColor, lying * 0.8);
    float vein = abs(pnoise(css * 0.016 + 21.0) + 0.35 * pnoise(css * 0.05 + 2.0));
    float crack = (1.0 - smoothstep(0.0, 0.022, vein)) * (1.0 - lying);
    frost = mix(frost, L_iceColor * 1.25 + 0.1, crack * 0.7);
    frost = mix(frost, L_iceColor * 1.2 + 0.12, rim * 0.8);
    color = mix(color, frost, ice);
  }

  if (L_pads > 0.0) {
    // Pads ride the ripples, so rain makes them bob.
    vec2 afloat = css + slope * 46.0;
    vec3 padColor;
    float pad = padAt(afloat, t, 230.0, L_pads, 0.0, padColor) * loose;
    color = mix(color, padColor, pad);
    pad = padAt(afloat + 61.0, t, 128.0, L_pads * 0.55, 23.0, padColor) * loose;
    color = mix(color, padColor, pad);
  }
  if (L_leaves > 0.0) {
    vec2 afloat = css + slope * 46.0;
    vec3 drift;
    float on = drifter(afloat, t, 118.0, L_leaves, 1.0, 1.0, L_leafA, L_leafB, L_leafC, drift);
    color = mix(color, drift, on);
    on = drifter(afloat, t, 52.0, L_leaves * 0.8, 2.0, 1.0, L_leafB, L_leafC, L_leafA, drift);
    color = mix(color, drift, on);
  }
  if (L_petals > 0.0) {
    vec2 afloat = css + slope * 46.0;
    vec3 drift;
    float on = drifter(afloat, t, 64.0, L_petals, 3.0, 0.0, L_petalA, L_petalB, mix(L_petalA, L_petalB, 0.5), drift);
    color = mix(color, drift, on);
    on = drifter(afloat, t, 30.0, L_petals * 0.7, 4.0, 0.0, L_petalB, L_petalA, L_petalB, drift);
    color = mix(color, drift, on);
    color = mix(color, L_petalB, faller(css, t, 150.0, L_petals * 0.5, 9.0));
  }

  if (L_branches > 0.0) color *= 1.0 - 0.45 * L_branches * branchShadow(css, t);

  if (L_fireflies > 0.0) {
    // One wandering, slowly pulsing point per cell, and its smeared reflection in the water.
    const float FLY = 170.0;
    vec2 id = floor(css / FLY);
    vec2 r = hash22(id + 12.3);
    if (r.x < L_fireflies * 0.75) {
      vec2 at = FLY * (0.5 + 0.2 * vec2(sin(t * 0.21 + r.y * 6.3) + 0.5 * sin(t * 0.53 + r.x * 9.0), cos(t * 0.17 + r.x * 6.3) + 0.5 * cos(t * 0.47 + r.y * 5.0)));
      vec2 v = css - id * FLY - at;
      float pulse = smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(t * (0.5 + r.y * 0.7) + r.x * 20.0));
      float d2 = dot(v, v);
      vec2 mv = (v + refract * 2.0 - vec2(0.0, 15.0)) * vec2(1.0, 0.4);
      float glow = smoothstep(16.0, 4.0, d2) + 0.4 * exp(-d2 / 70.0) + 0.45 * exp(-dot(mv, mv) / 14.0);
      color = mix(color, vec3(0.86, 1.0, 0.42), clamp(glow * pulse, 0.0, 1.0));
    }
  }

  if (L_snow > 0.0) {
    // Flakes take the colour of a lit window where they fall through its light.
    vec3 flake = mix(L_snowColor, lightCol, light * 0.7);
    vec2 blown = css - vec2(t * 16.0 * L_wind, 0.0);
    float falling = faller(blown, t, 46.0, L_snow * 0.85, 5.0) + faller(blown + 19.0, t, 96.0, L_snow * 0.7, 6.0);
    color = mix(color, flake, clamp(falling, 0.0, 1.0));
  }

  if (L_mist > 0.0) {
    float m = billow(css * vec2(0.0021, 0.0046) + vec2(t * (0.006 + 0.03 * L_wind), t * 0.002), t * 0.015);
    color = mix(color, L_mistColor, smoothstep(0.34, 0.74, m) * L_mist * 0.78);
  }

  color = posterize(color, threshold, 7.0);

  // Fish, food and shadows sit on the water: darken it beneath them so the glyphs read clearly.
  // The alpha is kept, so on paper a koi is bright glyphs over its own dark shape instead of
  // cream on cream; over a black page this is the same picture as cutting a hole.
  ivec2 fc = ivec2(clamp(css / uCell, vec2(0.0), uGrid - 1.0));
  ivec2 tc = ivec2(fc.x, int(uGrid.y) - 1 - fc.y);
  float kind = texelFetch(uAux, tc, 0).r;
  float solid = kind < 0.2 ? clamp(texelFetch(uField, tc, 0).a * 1.8, 0.0, 1.0) : 0.0;
  color = mix(color, L_koiBed, 0.88 * solid);
  float alpha = fade * uOpacity;
  alpha = mix(alpha, step(threshold, fade * 1.08) * uOpacity, L_edgeDither);
  // A koi keeps its dark shape for as long as its glyphs last, which is closer to the rails than
  // the water reaches.
  if (kind < 0.05) alpha = max(alpha, solid * clamp(rail / uGlyphFade, 0.0, 1.0));
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

  draw(pond: Pond, seconds: number, look: PondLook) {
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
    gl.uniform1f(this.uniform(composite, "uGlow"), look.halo);
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
