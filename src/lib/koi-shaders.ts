// GLSL for the koi pond renderer (koi-gl.ts), which describes the passes. The look uniforms (L_*)
// are declared from the PondLook schema, one per field, so a field added to a look is a uniform here.
// Two rules for editing: no backticks in GLSL comments (they end the template literal), and take
// derivatives before any early return.

import { EXTRAS, MAX_FISH, MAX_PELLETS, SEGMENTS } from "./koi-pond";
import { LOOK_COLORS, LOOK_SCALARS } from "./pond-looks";

// One uniform per look field, named after it: L_snow, L_bedLow, and so on.
const LOOK_UNIFORMS = [...Object.keys(LOOK_SCALARS).map((key) => `uniform float L_${key};`), ...LOOK_COLORS.map((key) => `uniform vec3 L_${key};`)].join("\n");

export const VERTEX = `#version 300 es
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

export const FIELD = `#version 300 es
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

export const GLYPH = `#version 300 es
${GLYPH_COMMON}
out vec4 outColor;
void main() { outColor = glyphAt(gl_FragCoord.xy); }`;

export const HALO = `#version 300 es
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
export const WATER = `${PIXEL_COMMON}
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

// How much a fish, pellet or shadow covers one character cell, and whether it is a fish.
float solidCell(ivec2 c, out float fish) {
  c = clamp(c, ivec2(0), ivec2(uGrid) - 1);
  ivec2 tc = ivec2(c.x, int(uGrid.y) - 1 - c.y);
  float kind = texelFetch(uAux, tc, 0).r;
  fish = kind < 0.05 ? 1.0 : 0.0;
  return kind < 0.2 ? clamp(texelFetch(uField, tc, 0).a * 1.8, 0.0, 1.0) : 0.0;
}

// Distance to the nearest edge of a jittered cell lattice, in cell units.
float cellEdge(vec2 x) {
  vec2 n = floor(x), f = fract(x), mr = vec2(0.0), mg = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = g + 0.15 + 0.7 * hash22(n + g) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 r = g + 0.15 + 0.7 * hash22(n + g) - f;
    if (dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
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
// Returns the mirrored sky and silhouettes, which ambient light shows. What emits (moon or sun, its
// glitter path, stars, lightning, lit windows and lamps) comes back through glow and lightCol/light
// so the caller can let it reflect at full strength, the way a light does on real water.
vec3 reflection(vec2 p, float t, float flash, out vec3 glow, out vec3 lightCol, out float light) {
  glow = vec3(0.0);
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
  glow += flash * vec3(0.62, 0.66, 0.86) * (0.3 + 0.7 * cloud) * (1.0 - 0.5 * far);

  if (L_stars > 0.0) {
    vec2 sc = p / 11.0, si = floor(sc), sf = fract(sc) - 0.5;
    float sh = hash12(si + 31.7);
    if (sh > 1.0 - 0.09 * L_stars) {
      vec2 off = sf - (hash22(si) - 0.5) * 0.5;
      float twinkle = 0.55 + 0.45 * sin(t * (0.5 + sh * 17.0) + sh * 90.0);
      // Stars are faint sources: only the brightest few reflect as clean dots, the rest as a glint.
      glow += vec3(0.82, 0.88, 1.0) * step(max(abs(off.x), abs(off.y)), 0.22) * twinkle * (1.0 - cloud) * (0.25 + 0.9 * pow(fract(sh * 57.0), 3.0));
    }
  }

  // The moon or sun rests in the middle of the left margin, behind the skyline. On a change of sky it
  // travels west to east (orbX), dipping a little toward the horizon as it nears either edge.
  float rest = uColumn.x * 0.52;
  vec2 orb = vec2(rest + L_orbX * (rest + L_orbSize * 2.0 + 40.0), uView.y * (0.2 + 0.06 * L_orbX * L_orbX));
  float od = length(p - orb);
  float veil = 1.0 - 0.75 * cloud;
  float disc = smoothstep(L_orbSize, L_orbSize - 5.0, od);
  // A crescent: the disc less a slightly smaller one set toward the upper right. The dark part keeps a
  // trace of earthshine, and a thinner moon throws a softer halo and a fainter path.
  vec2 umbra = orb + normalize(vec2(0.78, -0.62)) * L_orbSize * mix(1.0, 0.36, L_crescent);
  float shade = smoothstep(L_orbSize * 0.97, L_orbSize * 0.97 - 4.0, length(p - umbra)) * step(0.01, L_crescent);
  float lit = disc * (1.0 - shade) + disc * shade * 0.05;
  float strength = 1.0 - 0.45 * L_crescent;
  glow += L_orb * (lit * 1.2 + L_orbGlow * 0.55 * strength * exp(-od * od / (L_orbSize * L_orbSize * 5.0))) * veil;
  float glitter = exp(-pow((p.x - orb.x) / (L_orbSize * 0.57 + p.y * 0.03), 2.0)) * step(0.4, hash12(vec2(floor(p.y / 7.0), floor(t * 0.5) + floor(p.x / 12.0)))) * smoothstep(orb.y, orb.y + uView.y * 0.15, p.y) * (1.0 - smoothstep(0.4, 1.0, p.y / uView.y));
  glow += L_orb * glitter * L_glitter * strength * veil;

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
    // On moving water a lit window does not mirror as a crisp pane: its light smears down the
    // surface into a column of short horizontal dashes that break and re-form with the ripples.
    float column = smoothstep(0.18, 0.3, wf.x) * smoothstep(0.82, 0.7, wf.x);
    float dash = smoothstep(0.42, 0.62, vnoise(vec2(p.x * 0.09 + ci * 7.0, p.y * 0.42 - t * 1.6)));
    light = column * dash * step(1.0 - L_windows, hash12(wid + ci * 13.0)) * (1.0 - 0.35 * p.y / tower) * L_lights;
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
    // Folding the noise with abs gives the sheets creases and corners instead of round blobs.
    float sheet = 1.0 - depth + 0.16 * abs(pnoise(css * 0.009 + 7.0)) + 0.05 * abs(pnoise(css * 0.03)) - 0.05;
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

  vec3 lightCol, glow;
  float light;
  vec3 mirrored = reflection(css + refract * 1.3 + vec2(sin(css.y * 0.045 + t * 0.7) * 6.0 + wobble.x * 5.0, 0.0) * loose, t, flash, glow, lightCol, light);
  float mirror = (0.22 + 0.34 * deep) * (0.65 + 0.35 * vnoise(css * 0.012 + t * 0.05)) * L_mirror;
  vec3 color = mix(body, mirrored, clamp(mirror, 0.0, 1.0)) * L_gain;
  color += flash * 0.05;
  color += L_rippleColor * smoothstep(0.05, 0.25, abs(h)) * L_ripple * loose;
  // Emitted light, kept apart so the scene's ambient light never dims it. A mirror loses little of
  // a bright source, so a reflected light is nearly as bright as the light itself.
  vec3 emit = glow * (0.75 + 0.25 * deep) + lightCol * light * (0.85 + 0.15 * deep) * (1.0 - 0.45 * ice);
  // Sunlight or moonlight sparking along the brightest caustic lines.
  emit += L_orb * smoothstep(0.55, 0.95, caustic) * L_glitter * 0.3;
  // How much of the open water shows; whatever floats on it hides the reflected light beneath.
  float open = 1.0 - ice;

  if (ice > 0.0) {
    // Frosted, a little snow lying on it, a bright rim where it meets open water, and fine
    // cracks that are densest near that rim.
    vec3 frost = mix(color, L_iceColor, 0.55 + 0.2 * vnoise(css * 0.03));
    float lying = smoothstep(0.5, 0.75, vnoise(css * 0.016 + 4.0) + 0.2 * vnoise(css * 0.09)) * L_snow;
    frost = mix(frost, L_snowColor, lying * 0.8);
    // Ice breaks into angular plates: cracks follow the edges of a jittered cell lattice, gently
    // warped so they are not ruled straight. Plates show open water through a dark seam; the fine
    // hairlines inside them catch the light.
    vec2 warp = vec2(pnoise(css * 0.02 + 3.0), pnoise(css * 0.02 + 11.0)) * 9.0;
    float plate = cellEdge((css + warp) / 74.0) * 74.0;
    float hair = cellEdge((css + warp * 0.6) / 23.0 + 5.0) * 23.0;
    frost = mix(frost, color * 0.58, (1.0 - smoothstep(0.8, 2.2, plate)) * 0.9);
    frost = mix(frost, L_iceColor * 1.25 + 0.15, (1.0 - smoothstep(0.4, 1.4, hair)) * 0.45 * smoothstep(2.2, 6.0, plate));
    frost = mix(frost, L_iceColor * 1.2 + 0.12, rim * 0.8);
    color = mix(color, frost, ice);
  }

  if (L_pads > 0.0) {
    // Pads ride the ripples, so rain makes them bob.
    vec2 afloat = css + slope * 46.0;
    vec3 padColor;
    float pad = padAt(afloat, t, 230.0, L_pads, 0.0, padColor) * loose;
    color = mix(color, padColor, pad);
    open *= 1.0 - pad;
    pad = padAt(afloat + 61.0, t, 128.0, L_pads * 0.55, 23.0, padColor) * loose;
    color = mix(color, padColor, pad);
    open *= 1.0 - pad;
  }
  if (L_leaves > 0.0) {
    vec2 afloat = css + slope * 46.0;
    vec3 drift;
    float on = drifter(afloat, t, 118.0, L_leaves, 1.0, 1.0, L_leafA, L_leafB, L_leafC, drift);
    color = mix(color, drift, on);
    open *= 1.0 - on;
    on = drifter(afloat, t, 52.0, L_leaves * 0.8, 2.0, 1.0, L_leafB, L_leafC, L_leafA, drift);
    color = mix(color, drift, on);
    open *= 1.0 - on;
  }
  if (L_petals > 0.0) {
    vec2 afloat = css + slope * 46.0;
    vec3 drift;
    float on = drifter(afloat, t, 64.0, L_petals, 3.0, 0.0, L_petalA, L_petalB, mix(L_petalA, L_petalB, 0.5), drift);
    color = mix(color, drift, on);
    open *= 1.0 - on;
    on = drifter(afloat, t, 30.0, L_petals * 0.7, 4.0, 0.0, L_petalB, L_petalA, L_petalB, drift);
    color = mix(color, drift, on);
    open *= 1.0 - on;
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
      float glow = smoothstep(30.0, 8.0, d2) + 0.5 * exp(-d2 / 110.0) + 0.5 * exp(-dot(mv, mv) / 18.0);
      emit += vec3(0.86, 1.0, 0.42) * clamp(glow * pulse, 0.0, 1.0) * 1.2;
    }
  }

  if (L_snow > 0.0) {
    // Flakes take the colour of a lit window where they fall through its light.
    vec3 flake = mix(L_snowColor, lightCol, light * 0.7);
    vec2 blown = css - vec2(t * 16.0 * L_wind, 0.0);
    float falling = faller(blown, t, 46.0, L_snow * 0.85, 5.0) + faller(blown + 19.0, t, 96.0, L_snow * 0.7, 6.0);
    color = mix(color, flake, clamp(falling, 0.0, 1.0));
  }

  // Everything so far is lit by the scene; the night sky lights it only a little. Then the lights.
  color = color * L_ambient + emit * open;

  if (L_mist > 0.0) {
    float m = billow(css * vec2(0.0021, 0.0046) + vec2(t * (0.006 + 0.03 * L_wind), t * 0.002), t * 0.015);
    color = mix(color, L_mistColor * L_ambient, smoothstep(0.42, 0.78, m) * L_mist * 0.85);
  }

  color = posterize(color, threshold, 7.0);

  // Fish, food and shadows sit on the water: darken it beneath them so the glyphs read clearly.
  // The alpha is kept, so on paper a koi is bright glyphs over its own dark shape instead of
  // cream on cream; over a black page this is the same picture as cutting a hole. The field is one
  // texel per character cell, so it is read bilinearly to keep that shape from stair-stepping.
  vec2 g = css / uCell - 0.5;
  ivec2 b = ivec2(floor(g));
  vec2 f = fract(g);
  float fish00, fish10, fish01, fish11;
  float solid = mix(mix(solidCell(b, fish00), solidCell(b + ivec2(1, 0), fish10), f.x),
                    mix(solidCell(b + ivec2(0, 1), fish01), solidCell(b + ivec2(1, 1), fish11), f.x), f.y);
  float fish = mix(mix(fish00, fish10, f.x), mix(fish01, fish11, f.x), f.y);
  color = mix(color, L_koiBed, 0.88 * solid);
  float alpha = fade * uOpacity;
  // At night a koi keeps its dark shape for as long as its glyphs last, which is closer to the
  // rails than the water reaches. On paper that shape would outlive the water as a silhouette.
  float hold = smoothstep(0.3, 0.8, solid) * fish * clamp(rail / uGlyphFade, 0.0, 1.0) * L_koiHold;
  alpha = max(alpha, hold);
  outColor = vec4(color * alpha, alpha);
}`;

export const BLUR = `#version 300 es
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

export const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform float uGlow;
uniform float uCover;
in vec2 vUv;
out vec4 outColor;
// uCover scales only the alpha: at 0 the layer is purely added to what is behind it.
void main() {
  vec4 c = texture(uSource, vUv) * uGlow;
  outColor = vec4(c.rgb, c.a * uCover);
}`;
