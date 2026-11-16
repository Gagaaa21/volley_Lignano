import type { CueKind } from "./cues";

/**
 * I jingle originali della pulsantiera della diretta, creati nel browser con la Web Audio API: nessun file da scaricare e
 * nessun problema di diritti su YouTube. Ogni jingle dura un paio di secondi e accompagna la scritta animata (vedi cues.ts).
 * Suonano nella grafica di Streamlabs / OBS (la sorgente browser manda l'audio nella diretta) e, per provarli, sul tablet.
 */

type Ctx = AudioContext;

let shared: AudioContext | null = null;

/** Un solo contesto audio per pagina; null dove l'audio non c'è (server, browser molto vecchi). */
export function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!shared) shared = new Ctor();
  // Un contesto nato senza un tocco parte sospeso: in OBS si riprende da solo, sul tablet il tocco del tasto lo sblocca.
  if (shared.state === "suspended") void shared.resume().catch(() => {});
  return shared;
}

interface Tone {
  type: OscillatorType;
  freq: number;
  /** La frequenza a cui arriva alla fine (glissando), se cambia. */
  to?: number;
  start: number;
  dur: number;
  gain: number;
  /** Filtro passa-basso (per gli ottoni sintetici), in Hz. */
  lowpass?: number;
}

function tone(ctx: Ctx, out: AudioNode, t0: number, { type, freq, to, start, dur, gain, lowpass }: Tone) {
  const osc = ctx.createOscillator();
  osc.type = type;
  const at = t0 + start;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.02, dur / 4));
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let node: AudioNode = osc;
  if (lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    osc.connect(filter);
    node = filter;
  }
  node.connect(amp).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;
function noiseOf(ctx: Ctx): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = ctx.sampleRate * 2;
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  // Rumore bianco pseudo-casuale ma sempre uguale: lo stesso suono a ogni tocco.
  let seed = 12345;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return noiseBuffer;
}

interface Noise {
  start: number;
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  /** La frequenza del filtro alla fine (lo «swoosh»). */
  to?: number;
  q?: number;
}

function noise(ctx: Ctx, out: AudioNode, t0: number, { start, dur, gain, filter, freq, to, q }: Noise) {
  const src = ctx.createBufferSource();
  src.buffer = noiseOf(ctx);
  const at = t0 + start;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, at);
  if (to) biquad.frequency.exponentialRampToValueAtTime(to, at + dur);
  if (q) biquad.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(biquad).connect(amp).connect(out);
  src.start(at);
  src.stop(at + dur + 0.05);
}

/** Un accordo di «ottoni» sintetici (onde a dente di sega addolcite). */
function stab(ctx: Ctx, out: AudioNode, t0: number, start: number, dur: number, freqs: number[], gain = 0.12, lowpass = 2200) {
  for (const freq of freqs) {
    tone(ctx, out, t0, { type: "sawtooth", freq, start, dur, gain, lowpass });
    tone(ctx, out, t0, { type: "sawtooth", freq: freq * 1.006, start, dur, gain: gain * 0.6, lowpass });
  }
}

/** Il colpo basso dei momenti grandi: una cassa profonda e un tonfo. */
function boom(ctx: Ctx, out: AudioNode, t0: number, start: number, gain = 0.9) {
  tone(ctx, out, t0, { type: "sine", freq: 95, to: 38, start, dur: 0.7, gain });
  noise(ctx, out, t0, { start, dur: 0.35, gain: gain * 0.5, filter: "lowpass", freq: 500 });
}

function clap(ctx: Ctx, out: AudioNode, t0: number, start: number, gain = 0.45) {
  noise(ctx, out, t0, { start, dur: 0.12, gain, filter: "bandpass", freq: 1500, q: 1.2 });
  noise(ctx, out, t0, { start: start + 0.012, dur: 0.1, gain: gain * 0.7, filter: "bandpass", freq: 2200, q: 1.5 });
}

const NOTE = { C3: 130.81, F3: 174.61, G3: 196, C4: 261.63, E4: 329.63, F4: 349.23, G4: 392, A4: 440, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5 };

const JINGLES: Record<CueKind, (ctx: Ctx, out: AudioNode, t0: number) => void> = {
  // «Dun… DUNNN»: un tonfo come un muro che si chiude, due accordi di ottoni e un piatto.
  monsterBlock(ctx, out, t0) {
    boom(ctx, out, t0, 0, 1);
    stab(ctx, out, t0, 0.08, 0.32, [NOTE.C3, NOTE.G3, NOTE.C4, NOTE.E4]);
    boom(ctx, out, t0, 0.5, 1);
    stab(ctx, out, t0, 0.5, 1.2, [NOTE.F3, NOTE.C4, NOTE.F4, NOTE.A4], 0.14);
    noise(ctx, out, t0, { start: 0.5, dur: 1.4, gain: 0.25, filter: "highpass", freq: 6000 });
  },
  // Un arpeggio che sale veloce e una pioggia di scintille.
  ace(ctx, out, t0) {
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((freq, i) => tone(ctx, out, t0, { type: "triangle", freq, start: i * 0.07, dur: 0.18, gain: 0.32 }));
    tone(ctx, out, t0, { type: "triangle", freq: NOTE.C6, start: 0.3, dur: 0.7, gain: 0.28 });
    tone(ctx, out, t0, { type: "triangle", freq: NOTE.E6, start: 0.3, dur: 0.7, gain: 0.2 });
    for (let i = 0; i < 10; i++) tone(ctx, out, t0, { type: "sine", freq: 2200 + ((i * 733) % 2400), start: 0.32 + i * 0.06, dur: 0.12, gain: 0.08 });
  },
  // Uno «swoosh» che sale e il colpo: la palla che parte e arriva a terra.
  attack(ctx, out, t0) {
    noise(ctx, out, t0, { start: 0, dur: 0.38, gain: 0.5, filter: "bandpass", freq: 300, to: 4000, q: 0.8 });
    boom(ctx, out, t0, 0.36, 1);
    stab(ctx, out, t0, 0.38, 0.22, [NOTE.G3, NOTE.G4]);
    stab(ctx, out, t0, 0.62, 0.9, [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5], 0.12);
  },
  // Una nota che risale (la palla ripresa all'ultimo) e due note allegre.
  dig(ctx, out, t0) {
    tone(ctx, out, t0, { type: "sine", freq: 260, to: 1300, start: 0, dur: 0.32, gain: 0.35 });
    noise(ctx, out, t0, { start: 0.3, dur: 0.06, gain: 0.4, filter: "bandpass", freq: 1800 });
    tone(ctx, out, t0, { type: "square", freq: NOTE.E5, start: 0.4, dur: 0.16, gain: 0.12 });
    tone(ctx, out, t0, { type: "square", freq: NOTE.G5, start: 0.58, dur: 0.5, gain: 0.12 });
  },
  // Un rullo di tamburo che cresce, il piatto e l'accordo finale.
  rally(ctx, out, t0) {
    for (let i = 0; i < 18; i++) noise(ctx, out, t0, { start: i * 0.05, dur: 0.05, gain: 0.08 + i * 0.015, filter: "bandpass", freq: 1800, q: 0.9 });
    boom(ctx, out, t0, 0.92, 0.8);
    noise(ctx, out, t0, { start: 0.92, dur: 1.3, gain: 0.3, filter: "highpass", freq: 5000 });
    stab(ctx, out, t0, 0.92, 1, [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5], 0.11);
  },
  // Il coro dello stadio: battimani a ritmo e una fanfara «For-za Li-gna-no!».
  cheer(ctx, out, t0) {
    [0, 0.3, 0.6, 0.75, 0.9].forEach((start) => clap(ctx, out, t0, start));
    const melody: [number, number, number][] = [
      [NOTE.G4, 1.1, 0.22],
      [NOTE.G4, 1.34, 0.22],
      [NOTE.C5, 1.58, 0.18],
      [NOTE.C5, 1.78, 0.18],
      [NOTE.E5, 1.98, 0.55],
    ];
    for (const [freq, start, dur] of melody) stab(ctx, out, t0, start, dur, [freq, freq / 2], 0.1, 2600);
  },
};

/** Suona il jingle originale di un tasto. Non fa niente dove l'audio non c'è. */
export function playJingle(kind: CueKind, volume = 0.8): void {
  const ctx = audioContext();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.value = volume;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 8;
  master.connect(limiter).connect(ctx.destination);
  JINGLES[kind](ctx, master, ctx.currentTime + 0.03);
}

const loaded = new Map<string, HTMLAudioElement>();

/** Prepara un suono caricato (si scarica subito, così al tocco parte senza attesa). */
export function preloadSound(url: string): void {
  if (typeof window === "undefined" || loaded.has(url)) return;
  const audio = new Audio(url);
  audio.preload = "auto";
  loaded.set(url, audio);
}

/** Suona un file caricato; se non parte (formato, rete) suona il jingle originale al suo posto. */
export function playSound(url: string, fallback: CueKind): void {
  preloadSound(url);
  const audio = loaded.get(url);
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => playJingle(fallback));
}
