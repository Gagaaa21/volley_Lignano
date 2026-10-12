/**
 * Piccoli «bip» per avvisare, per esempio, che un time-out è finito. Si usa
 * l'audio del browser (Web Audio), senza file da scaricare.
 *
 * I browser lasciano suonare solo dopo che chi usa la pagina ha toccato
 * qualcosa: per questo `prepareAudio` va chiamata da un tocco (per esempio dal
 * pulsante «Time-out»), e `playBeeps` suonerà anche più tardi, a tempo scaduto.
 * Se l'audio non c'è (o il telefono è in silenzioso) non succede niente: chi
 * ascolta ha comunque l'avviso a schermo.
 */

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;

/** Sblocca l'audio: da chiamare dentro un tocco o un clic. */
export function prepareAudio(): void {
  try {
    const Context = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Context) return;
    context ??= new Context();
    if (context.state === "suspended") void context.resume();
  } catch {
    // Niente audio: l'avviso resta visivo.
  }
}

/** Una serie di bip brevi e uguali (`count` volte). */
export function playBeeps(count = 2, { frequency = 880, seconds = 0.18, gap = 0.14 } = {}): void {
  if (!context || context.state !== "running") return;
  try {
    const start = context.currentTime + 0.02;
    for (let i = 0; i < count; i++) {
      const at = start + i * (seconds + gap);
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      // Entra e esce piano, altrimenti si sentono dei «clic» all'inizio e alla fine.
      volume.gain.setValueAtTime(0.0001, at);
      volume.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
      oscillator.connect(volume).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + seconds + 0.02);
    }
  } catch {
    // Niente audio: l'avviso resta visivo.
  }
}

/** Fa vibrare il telefono, dove si può (non su iPhone e iPad). */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Non supportato.
  }
}
