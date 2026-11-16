import { defaultSoundUrl, soundUrl, type CueKind } from "./cues";

/**
 * I suoni della pulsantiera della diretta. Di partenza solo il Monster block ha un suono, il file con la voce da stadio (vedi
 * defaultSoundUrl in cues.ts; se non parte, il jingle creato qui con la Web Audio API); gli altri tasti sono solo animazione.
 * Lo staff può caricare un file suo su qualsiasi tasto (soundUrl). Suonano nella grafica di Streamlabs / OBS (la sorgente
 * browser manda l'audio nella diretta) e, per provarli, sul tablet.
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

const NOTE = { C3: 130.81, F3: 174.61, G3: 196, C4: 261.63, E4: 329.63, F4: 349.23, A4: 440 };

/** «Dun… DUNNN»: un tonfo come un muro che si chiude, due accordi di ottoni e un piatto (il Monster block senza il suo file). */
function monsterJingle(ctx: Ctx, out: AudioNode, t0: number) {
  boom(ctx, out, t0, 0, 1);
  stab(ctx, out, t0, 0.08, 0.32, [NOTE.C3, NOTE.G3, NOTE.C4, NOTE.E4]);
  boom(ctx, out, t0, 0.5, 1);
  stab(ctx, out, t0, 0.5, 1.2, [NOTE.F3, NOTE.C4, NOTE.F4, NOTE.A4], 0.14);
  noise(ctx, out, t0, { start: 0.5, dur: 1.4, gain: 0.25, filter: "highpass", freq: 6000 });
}

/** Suona il jingle di riserva del Monster block. Non fa niente dove l'audio non c'è. */
function playMonsterJingle(volume = 0.8): void {
  const ctx = audioContext();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.value = volume;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 8;
  master.connect(limiter).connect(ctx.destination);
  monsterJingle(ctx, master, ctx.currentTime + 0.03);
}

const loaded = new Map<string, HTMLAudioElement>();
/** Il suono che sta suonando: una scritta nuova lo ferma (mai due grida una sopra l'altra). */
let playing: HTMLAudioElement | null = null;

function fileFor(url: string): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  let audio = loaded.get(url);
  if (!audio) {
    audio = new Audio(url);
    audio.preload = "auto";
    loaded.set(url, audio);
  }
  return audio;
}

/** Suona un file; se non parte (formato, rete, file mancante) chiama `fallback`. */
function playFile(url: string, fallback: () => void): void {
  const audio = fileFor(url);
  if (!audio) return fallback();
  if (playing && playing !== audio) {
    playing.pause();
  }
  playing = audio;
  audio.currentTime = 0;
  audio.play().catch(fallback);
}

/** Ferma il suono in corso: una scritta nuova (anche senza suono) non si porta dietro il grido di quella prima. */
function stopPlaying(): void {
  playing?.pause();
  playing = null;
}

/** L'indirizzo del suono di un tasto: il file caricato dallo staff se c'è (con la sua versione), se no quello di partenza. */
function cueUrl(kind: CueKind, uploaded: number | null): string | null {
  return uploaded ? soundUrl(kind, uploaded) : defaultSoundUrl(kind);
}

/** Prepara il suono di un tasto, se ne ha uno (si scarica subito, così al tocco parte senza attesa). */
export function preloadCue(kind: CueKind, uploaded: number | null): void {
  const url = cueUrl(kind, uploaded);
  if (url) fileFor(url);
}

/**
 * Suona il suono di un tasto: il file caricato dallo staff, se c'è; se no quello di partenza (solo il Monster block, con il
 * jingle creato qui con la Web Audio API se il file non parte). Gli altri tasti senza un file caricato sono solo animazione.
 */
export function playCue(kind: CueKind, uploaded: number | null): void {
  stopPlaying();
  const original = defaultSoundUrl(kind);
  // Il suono di partenza c'è solo per il Monster block: se il suo file non parte, il jingle di riserva.
  const fallback = original ? () => playFile(original, () => playMonsterJingle()) : () => {};
  if (uploaded) playFile(soundUrl(kind, uploaded), fallback);
  else fallback();
}
