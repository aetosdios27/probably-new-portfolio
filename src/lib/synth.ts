import { soundVolume } from "./sound";

// A tiny shared synth for the site's own sounds (the pond and the hover cues). One lazily created
// AudioContext feeds a gain stage and a gentle compressor, so overlapping sounds can never clip, and
// the master gain follows the site's volume every time a sound starts.

type Voice = { ctx: AudioContext; out: AudioNode; noise: AudioBuffer };

let voice: Voice | null = null;
let master: GainNode | null = null;

export function audio(): Voice | null {
  if (voice) {
    if (voice.ctx.state === "suspended") void voice.ctx.resume();
    master!.gain.value = soundVolume();
    return voice;
  }
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  const ctx = new Context();
  master = ctx.createGain();
  master.gain.value = soundVolume();
  const softener = ctx.createDynamicsCompressor();
  master.connect(softener).connect(ctx.destination);
  const length = Math.floor(ctx.sampleRate * 0.05);
  const noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  voice = { ctx, out: master, noise };
  return voice;
}

/** A sine that glides from one pitch to another while it fades: a drop, a bubble, a knock. */
export function bloop(v: Voice, when: number, from: number, to: number, peak: number, decay: number) {
  const osc = v.ctx.createOscillator();
  const gain = v.ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, when);
  osc.frequency.exponentialRampToValueAtTime(to, when + 0.07);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  osc.connect(gain).connect(v.out);
  osc.start(when);
  osc.stop(when + decay + 0.02);
}

/** A struck glass note: a sine plus a quieter overtone that dies sooner. */
export function ping(v: Voice, when: number, freq: number, peak: number, decay: number, overtone = 2.76) {
  for (const [ratio, level, length] of [[1, 1, 1], [overtone, 0.28, 0.45]] as const) {
    const osc = v.ctx.createOscillator();
    const gain = v.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak * level, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay * length);
    osc.connect(gain).connect(v.out);
    osc.start(when);
    osc.stop(when + decay * length + 0.02);
  }
}

/** A short square-wave blip, the sound of a pixel. */
export function chip(v: Voice, when: number, freq: number, peak: number, length: number) {
  const osc = v.ctx.createOscillator();
  const filter = v.ctx.createBiquadFilter();
  const gain = v.ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  filter.type = "lowpass";
  filter.frequency.value = 3200;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  osc.connect(filter).connect(gain).connect(v.out);
  osc.start(when);
  osc.stop(when + length + 0.02);
}

/** A click of noise through a band-pass filter: the first contact of something on water. */
export function splash(v: Voice, when: number, peak: number) {
  const source = v.ctx.createBufferSource();
  const filter = v.ctx.createBiquadFilter();
  const gain = v.ctx.createGain();
  source.buffer = v.noise;
  filter.type = "bandpass";
  filter.frequency.value = 2600;
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(peak, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
  source.connect(filter).connect(gain).connect(v.out);
  source.start(when);
}
