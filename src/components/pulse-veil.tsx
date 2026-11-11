"use client";

import { useEffect, useRef } from "react";
import { currentPulse } from "@/lib/mode-transition";

// The ripple that carries a switch into or out of AI mode, made of the site's own material: square
// pixels in ordered dither. Each of the two fronts (mode-transition.ts) is a solid crest of page-coloured
// blocks with a sparse echo ahead and rings decaying behind. Everything under a crest breaks into
// pixels, and the swap at that front (a hard-edged mask) happens out of sight beneath it. Drawn only
// while a switch is running.

const BLOCK_PX = 6;

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uSize;
uniform float uDpr;
uniform vec2 uOrigin;
uniform vec2 uFronts;
uniform float uReach;
uniform float uBlock;
uniform vec3 uPage;
uniform vec3 uInk;
out vec4 outColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float bayer8(vec2 p) {
  ivec2 q = ivec2(mod(p, 8.0));
  int a = q.x ^ q.y, b = q.y;
  int v = ((a & 1) << 5) | ((b & 1) << 4) | (((a >> 1) & 1) << 3) | (((b >> 1) & 1) << 2) | (((a >> 2) & 1) << 1) | ((b >> 2) & 1);
  return (float(v) + 0.5) / 64.0;
}

// One front at distance d. A thin solid crest, just wide enough (9 px, more than the 4 px jitter plus
// half a block's diagonal) that the hard mask edge beneath is always covered, then sharp rings of
// blocks behind it that lose energy as they spread, the way a ripple does.
void front(float r, float d, float jitter, inout float solid, inout float ring) {
  if (r <= 0.0) return;
  float x = r - d + jitter;
  solid = max(solid, 1.0 - smoothstep(9.0, 20.0, abs(x)));
  float energy = 1.0 - 0.55 * clamp(r / uReach, 0.0, 1.0);
  float rings = x > 0.0 ? exp(-x / 220.0) * pow(max(0.0, cos(6.2831853 * (x - 26.0) / 56.0)), 6.0) : 0.0;
  ring = max(ring, rings * energy);
}

void main() {
  vec2 css = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) / uDpr;
  vec2 block = floor(css / uBlock);
  float d = length((block + 0.5) * uBlock - uOrigin);
  float jitter = (hash12(block) - 0.5) * 8.0;
  float solid = 0.0, ring = 0.0;
  front(uFronts.x, d, jitter, solid, ring);
  front(uFronts.y, d, jitter, solid, ring);
  float threshold = bayer8(block);
  if (step(threshold, solid) > 0.0) { outColor = vec4(uPage, 1.0); return; }
  float on = step(threshold, ring);
  // Ring blocks are a breath of ink on the page, so the ripple reads even where there is nothing to break.
  outColor = vec4(mix(uPage, uInk, 0.14) * on, on);
}`;

function rgb(color: string): [number, number, number] {
  const match = color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [match[0] / 255, match[1] / 255, match[2] / 255];
}

export function PulseVeil() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!canvas || !gl) return;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`pulse veil: ${gl.getShaderInfoLog(shader)}`);
      return shader;
    };
    const program = gl.createProgram()!;
    try {
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`pulse veil: ${gl.getProgramInfoLog(program)}`);
    } catch (error) {
      canvas.dataset.error = String(error);
      return;
    }
    const vao = gl.createVertexArray();
    const at = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = { size: at("uSize"), dpr: at("uDpr"), origin: at("uOrigin"), fronts: at("uFronts"), reach: at("uReach"), block: at("uBlock"), page: at("uPage"), ink: at("uInk") };

    let raf = 0;
    function frame() {
      raf = 0;
      const pulse = currentPulse();
      if (!pulse) {
        gl!.clear(gl!.COLOR_BUFFER_BIT);
        return;
      }
      raf = requestAnimationFrame(frame);
      gl!.uniform2f(uniforms.origin, pulse.x, pulse.y);
      gl!.uniform2f(uniforms.fronts, pulse.radius, pulse.trail);
      gl!.uniform1f(uniforms.reach, pulse.reach);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }
    function start() {
      if (raf || !("transition" in document.documentElement.dataset)) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas!.width = Math.round(innerWidth * dpr);
      canvas!.height = Math.round(innerHeight * dpr);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.useProgram(program);
      gl!.bindVertexArray(vao);
      gl!.clearColor(0, 0, 0, 0);
      const style = getComputedStyle(document.body);
      gl!.uniform2f(uniforms.size, canvas!.width, canvas!.height);
      gl!.uniform1f(uniforms.dpr, dpr);
      gl!.uniform1f(uniforms.block, BLOCK_PX);
      gl!.uniform3f(uniforms.page, ...rgb(style.backgroundColor));
      gl!.uniform3f(uniforms.ink, ...rgb(style.color));
      raf = requestAnimationFrame(frame);
    }
    const observer = new MutationObserver(start);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-transition"] });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="pulse-veil" aria-hidden="true" />;
}
