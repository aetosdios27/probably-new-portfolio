'use client';

import { useEffect, useRef } from 'react';
import type Matter from 'matter-js';
import { STACK_ICONS } from './stack-icons';
import dock from '@/components/socials-dock.module.css';
import styles from './falling-icons.module.css';

const STEP = 1000 / 60;
// Winners from a 300-seed search per diameter: height, center offset, then gap.
const PILE_SEEDS: Record<number, number> = { 56: 211, 44: 162 };
function seededRandom(seed: number) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function FallingIcons() {
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = container.current!;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, started = false;
    let physics: typeof Matter | undefined;
    let engine: Matter.Engine | undefined;
    let items: { body: Matter.Body; tile: HTMLDivElement }[] = [];
    let frame = 0, resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let width = 0, height = 0, size = 0, floor = 0, worldWidth = 0, worldLeft = 0;
    let random = seededRandom(1), spawnTimes: number[] = [];
    let spawned = 0, elapsed = 0, lastTime = 0, accumulator = 0, frames = 0;

    function stop() { cancelAnimationFrame(frame); frame = 0; }
    function draw(body: Matter.Body, tile: HTMLDivElement) {
      tile.style.transform = `translate3d(${body.position.x - size / 2}px, ${body.position.y - size / 2}px, 0)`;
    }
    function spawn(index: number) {
      const p = physics!;
      const body = p.Bodies.circle(worldLeft + size / 2 + random() * (worldWidth - size), -size,
        size / 2, { restitution: 0.15, friction: 0.9, frictionAir: 0.015, sleepThreshold: 45 });
      const icon = STACK_ICONS[index];
      const tile = document.createElement('div');
      tile.className = `${styles.tile} ${dock.colors}`;
      tile.style.width = tile.style.height = `${size}px`;
      tile.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('focusable', 'false');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', icon.path); svg.append(path); tile.append(svg);
      root.append(tile);
      // Crop the actual path once, outside the simulation/render loop.
      const bounds = path.getBBox();
      svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
      const wordmark = bounds.width / bounds.height > 2;
      const scale = size * (wordmark ? 0.66 : 0.52) / Math.max(bounds.width, bounds.height);
      svg.style.width = `${bounds.width * scale}px`;
      svg.style.height = `${bounds.height * scale}px`;
      items.push({ body, tile });
      p.Composite.add(engine!.world, body); draw(body, tile);
    }
    function tick() {
      elapsed += STEP;
      while (spawned < STACK_ICONS.length && elapsed >= spawnTimes[spawned]) spawn(spawned++);
      physics!.Engine.update(engine!, STEP);
    }
    function finish() {
      items.forEach(({ body, tile }) => draw(body, tile));
      root.dataset.state = 'settled';
      root.dataset.awake = '0';
      stop();
    }
    function settle() {
      // Same staggered simulation, evaluated synchronously; no animation/timers.
      for (let step = 0; step < 180; step++) tick();
      // Allow contact chains to finish sleeping if the pile needs longer.
      for (let step = 0; step < 1620 && items.some(item => !item.body.isSleeping); step++) tick();
      finish();
    }
    function animate(now: number) {
      frame = 0;
      if (disposed || !engine) return;
      frames++; root.dataset.frames = String(frames);
      accumulator += Math.min(now - lastTime, 50); lastTime = now;
      while (accumulator >= STEP) { tick(); accumulator -= STEP; }
      items.forEach(({ body, tile }) => { if (!body.isSleeping) draw(body, tile); });
      const awake = items.filter(item => !item.body.isSleeping).length;
      root.dataset.awake = String(awake);
      if (spawned === STACK_ICONS.length && awake === 0) finish();
      else frame = requestAnimationFrame(animate);
    }
    function rebuild(instant: boolean) {
      stop();
      if (!physics || disposed) return;
      if (engine) { physics.Composite.clear(engine.world, false); physics.Engine.clear(engine); }
      root.replaceChildren(); items = []; spawned = 0; elapsed = 0; accumulator = 0;
      // All layout reads happen once per build, never in the rendering loop.
      width = root.clientWidth; height = root.clientHeight;
      floor = height - parseFloat(getComputedStyle(root).getPropertyValue('--pile-floor-offset'));
      size = parseFloat(getComputedStyle(root).getPropertyValue('--pile-diameter'));
      worldWidth = size * 5.5; worldLeft = (width - worldWidth) / 2;
      random = seededRandom(PILE_SEEDS[size]);
      spawnTimes = STACK_ICONS.map((_, index) => index * 90 + random() * 30);
      engine = physics.Engine.create({ enableSleeping: true, positionIterations: 10 });
      engine.gravity.y = 1;
      const wall = size * 2;
      physics.Composite.add(engine.world, [
        physics.Bodies.rectangle(width / 2, floor + wall / 2, worldWidth + wall * 2, wall, { isStatic: true }),
        physics.Bodies.rectangle(worldLeft - wall / 2, height / 2, wall, height * 4, { isStatic: true }),
        physics.Bodies.rectangle(worldLeft + worldWidth + wall / 2, height / 2, wall, height * 4, { isStatic: true }),
      ]);
      root.dataset.state = instant ? 'settling' : 'falling';
      root.dataset.frames = String(frames);
      if (instant) settle();
      else { lastTime = performance.now(); frame = requestAnimationFrame(animate); }
    }
    const observer = new IntersectionObserver(entries => {
      if (started || !entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.35)) return;
      started = true; observer.disconnect();
      // A separate asynchronous chunk: not part of any route's initial bundle.
      import('matter-js').then(module => {
        if (disposed) return;
        physics = module.default; rebuild(motion.matches);
      });
    }, { threshold: 0.35 });
    observer.observe(root);
    const resize = new ResizeObserver(() => {
      if (!started || !physics || (root.clientWidth === width && root.clientHeight === height)) return;
      stop(); clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resizeTimer = undefined; rebuild(true); }, 150);
    });
    resize.observe(root);
    const reduce = () => { if (motion.matches && physics) rebuild(true); };
    motion.addEventListener('change', reduce);
    return () => {
      disposed = true; stop(); clearTimeout(resizeTimer);
      observer.disconnect(); resize.disconnect(); motion.removeEventListener('change', reduce);
      if (engine && physics) { physics.Composite.clear(engine.world, false); physics.Engine.clear(engine); }
      root.replaceChildren();
    };
  }, []);
  return <section ref={container} className={styles.pile} role="img"
    aria-label={`Technology stack: ${STACK_ICONS.map(icon => icon.name).join(', ')}`} />;
}
