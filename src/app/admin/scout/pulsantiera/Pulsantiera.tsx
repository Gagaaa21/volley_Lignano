"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ComponentType, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, BrickWall, ExternalLink, Flame, Megaphone, Music, Play, Repeat, Ribbon, Shield, Trash2, Upload, Volume2, VolumeX, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { CUE_COOLDOWN_MS, CUE_DURATION_MS, CUE_KINDS, CUE_META, defaultSoundUrl, MAX_SOUND_BYTES, SILENCE_MAX_MS, SILENCE_TEXT_MAX, type CueKind } from "@/lib/diretta/cues";
import { playCue, stopCueSound } from "@/lib/diretta/jingles";
import { keepWarmAction, removeCueSoundAction, sendCueAction, startSilenceAction, stopSilenceAction, uploadCueSoundAction } from "./actions";

/** Ogni quanto il tablet tiene «sveglio» il server mentre la pulsantiera è aperta (Vercel lo addormenta dopo qualche minuto). */
const KEEP_WARM_MS = 4 * 60_000;

/**
 * Ogni tasto: il colore (lo stesso del riquadro della scritta nella grafica, vedi CueBurst) e l'icona. I tasti sono scuri come
 * quelli di un banco di regia: il colore sta nella striscia in alto e nell'icona, così si riconoscono a colpo d'occhio.
 */
const LOOK: Record<CueKind, { accent: string; icon: ComponentType<{ className?: string; style?: CSSProperties }> }> = {
  monsterBlock: { accent: "#22b8f0", icon: BrickWall },
  ace: { accent: "#ffd23f", icon: Zap },
  attack: { accent: "#ff4f8b", icon: Flame },
  dig: { accent: "#2ee07a", icon: Shield },
  rally: { accent: "#ff8a3d", icon: Repeat },
  cheer: { accent: "#8b5cf6", icon: Megaphone },
};

const LOCAL_SOUND_KEY = "pulsantiera-suono-qui";
const subscribeNothing = () => () => {};
const clock = () => Date.now();

function readLocalSound(): boolean {
  try {
    return window.localStorage.getItem(LOCAL_SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

function playPreview(kind: CueKind, sounds: Record<string, number>) {
  playCue(kind, sounds[kind] ?? null);
}

/** I minuti e i secondi passati, «0:42». */
function elapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Silence = { id: string; at: number; text: string | null };

/**
 * La pulsantiera, come un banco di regia: in alto la spia di stato (pronta, in onda, minuto di silenzio), sei tasti grandi e
 * scuri; un tocco manda in onda la scritta (nella grafica di Streamlabs / OBS in meno di un secondo, grazie al campanello in
 * tempo reale: vedi src/lib/diretta/realtime.ts). Il tasto toccato si illumina finché la scritta è in onda; un secondo tocco
 * subito dopo aspetta (CUE_COOLDOWN_MS). Sotto, il minuto di silenzio: con una dedica facoltativa, toglie dalla grafica tutto il
 * resto finché non si preme «Termina» (o da solo dopo qualche minuto); intanto i tasti sono spenti. Il suono esce dalla diretta,
 * non dal tablet: «Suono anche qui» serve per provarlo. In fondo, i suoni: ascolta, carica il tuo, torna all'originale.
 */
export function Pulsantiera({ sounds, silence: initialSilence = null, testMode }: { sounds: Record<string, number>; silence?: Silence | null; testMode: boolean }) {
  const [onAir, setOnAir] = useState<{ kind: CueKind; until: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [silence, setSilence] = useState<Silence | null>(initialSilence);
  // «Suono anche qui»: ricordato dal browser (letto dopo il primo disegno), poi quello che si sceglie.
  const storedLocalSound = useSyncExternalStore(subscribeNothing, readLocalSound, () => false);
  const [chosenLocalSound, setLocalSound] = useState<boolean | null>(null);
  const localSound = chosenLocalSound ?? storedLocalSound;
  const [pending, startTransition] = useTransition();
  const lastTap = useRef(0);

  // Il server resta sveglio finché la pulsantiera è aperta e in vista: il primo tocco non aspetta l'avvio da freddo.
  useEffect(() => {
    const warm = () => {
      if (document.visibilityState === "visible") void keepWarmAction().catch(() => {});
    };
    warm();
    const timer = setInterval(warm, KEEP_WARM_MS);
    document.addEventListener("visibilitychange", warm);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", warm);
    };
  }, []);

  useEffect(() => {
    if (!onAir) return;
    const timer = setTimeout(() => setOnAir(null), Math.max(0, onAir.until - clock()));
    return () => clearTimeout(timer);
  }, [onAir]);

  // Il minuto di silenzio si spegne da solo dopo SILENCE_MAX_MS (lo fa anche il sito): la pulsantiera lo segue.
  useEffect(() => {
    if (!silence) return;
    const timer = setTimeout(() => setSilence(null), Math.max(0, silence.at + SILENCE_MAX_MS - clock()));
    return () => clearTimeout(timer);
  }, [silence]);

  function toggleLocalSound() {
    const next = !localSound;
    setLocalSound(next);
    try {
      window.localStorage.setItem(LOCAL_SOUND_KEY, next ? "1" : "0");
    } catch {
      // Senza memoria del browser vale solo finché la pagina resta aperta.
    }
  }

  function send(kind: CueKind) {
    const now = clock();
    if (silence || now - lastTap.current < CUE_COOLDOWN_MS) return;
    lastTap.current = now;
    if (localSound) playPreview(kind, sounds);
    setOnAir({ kind, until: now + CUE_DURATION_MS });
    startTransition(async () => {
      const result = await sendCueAction(kind);
      if (result.ok) setMessage({ tone: "ok", text: result.message });
      else {
        setOnAir(null);
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  function startSilence(text: string) {
    startTransition(async () => {
      const result = await startSilenceAction(text);
      if (result.ok) {
        setOnAir(null);
        stopCueSound();
        setSilence(result.silence);
        setMessage({ tone: "ok", text: result.message });
      } else setMessage({ tone: "error", text: result.error });
    });
  }

  function stopSilence() {
    startTransition(async () => {
      const result = await stopSilenceAction();
      if (result.ok) {
        setSilence(null);
        setMessage({ tone: "ok", text: result.message });
      } else setMessage({ tone: "error", text: result.error });
    });
  }

  const status = silence
    ? { tone: "silence" as const, text: "Minuto di silenzio" }
    : onAir
      ? { tone: "live" as const, text: `In onda: ${CUE_META[onAir.kind].button}` }
      : { tone: "ready" as const, text: "Pronta" };

  return (
    <div className="space-y-5" data-pulsantiera>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/admin/scout" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Torna allo Scout">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-bold leading-tight text-foreground">Pulsantiera della diretta</h1>
            <p className="text-[13px] text-muted-foreground">Un tocco e la scritta parte nella grafica di Streamlabs (il Monster block anche con il suo grido).</p>
          </div>
        </div>
        <Button variant={localSound ? "soft" : "outline"} onClick={toggleLocalSound} aria-pressed={localSound} data-pulsantiera-local-sound>
          {localSound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {localSound ? "Suono anche qui: sì" : "Suono anche qui: no"}
        </Button>
      </div>

      {testMode && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground" role="status">
          Sei in «Modalità prova»: i tasti non vanno in diretta. Esci dalla modalità prova per usarli in partita.
        </p>
      )}

      {/* Il banco: sempre scuro, come in regia, qualunque sia il tema del sito. */}
      <section className="rounded-3xl bg-[#0a1020] p-3 text-white shadow-[0_18px_40px_-24px_rgba(5,10,30,0.8)] ring-1 ring-white/5 sm:p-4" data-pulsantiera-console>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Grafica della diretta</span>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em]",
              status.tone === "live" ? "bg-[#e11d48] text-white" : status.tone === "silence" ? "bg-white text-[#0a1020]" : "bg-white/8 text-white/80",
            )}
            data-pulsantiera-status={status.tone}
          >
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full",
                status.tone === "live" ? "animate-pulse bg-white" : status.tone === "silence" ? "bg-[#0a1020]" : "bg-[#2ee07a]",
              )}
            />
            {status.text}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3" role="group" aria-label="Scritte da mandare in diretta">
          {CUE_KINDS.map((kind) => {
            const meta = CUE_META[kind];
            const { accent, icon: Icon } = LOOK[kind];
            const live = onAir?.kind === kind;
            const off = silence !== null || (pending && !live);
            return (
              <button
                key={kind}
                type="button"
                onClick={() => send(kind)}
                disabled={off}
                data-cue-button={kind}
                data-cue-live={live ? "" : undefined}
                aria-label={`Manda in diretta: ${meta.button}`}
                className={cn(
                  "relative flex min-h-[9rem] flex-col items-start justify-between overflow-hidden rounded-2xl p-4 text-left transition-[transform,box-shadow,opacity] active:scale-[0.97] disabled:opacity-40 sm:min-h-[11rem] sm:p-5",
                  "bg-[linear-gradient(180deg,#18233d_0%,#101a30_100%)] ring-1 ring-white/8 hover:ring-white/20",
                )}
                style={live ? { boxShadow: `0 0 0 2px ${accent}, 0 0 28px ${accent}55` } : undefined}
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />
                <span className="grid h-12 w-12 place-items-center rounded-xl sm:h-14 sm:w-14" style={{ background: `${accent}1f`, color: accent }}>
                  <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                </span>
                <span>
                  <span className="block font-display text-[1.3rem] font-extrabold uppercase leading-tight tracking-wide text-white sm:text-[1.6rem]">{meta.button}</span>
                  <span className="mt-1 hidden text-[13px] leading-snug text-white/55 sm:block">{meta.hint}</span>
                </span>
                {live && (
                  <span className="absolute right-3 top-4 rounded-full bg-[#e11d48] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">In onda</span>
                )}
                {live && (
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 origin-left" style={{ background: accent, animation: `pulsantiera-bar ${CUE_DURATION_MS}ms linear both` }} />
                )}
              </button>
            );
          })}
        </div>

        <SilencePanel silence={silence} pending={pending} disabled={testMode} onStart={startSilence} onStop={stopSilence} />
      </section>

      <p
        className={cn("min-h-[1.5rem] text-sm font-medium", message?.tone === "error" ? "text-destructive" : "text-muted-foreground")}
        role={message?.tone === "error" ? "alert" : "status"}
        data-pulsantiera-message
      >
        {message?.text ?? "La scritta compare nella grafica in meno di un secondo, anche prima della partita. Solo la scritta: nessuna giocatrice."}
      </p>

      <details className="rounded-2xl border border-border-subtle bg-surface p-4" data-pulsantiera-sounds>
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
          <Music className="h-4 w-4" />
          Suoni dei tasti
        </summary>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Il Monster block ha il suo grido «MONSTER BLOCK! MONSTER BLOCK!» con tamburi e ottoni, fatto apposta (nessun problema di
          diritti su YouTube); gli altri tasti sono solo animazione, senza suono. Se vuoi, su qualsiasi tasto puoi mettere un file tuo:
          mp3, m4a, ogg o wav, al massimo {Math.round(MAX_SOUND_BYTES / 1000)} kB. Attenzione: i suoni delle partite in TV (come il
          «Monster block» della SuperLega), le canzoni e le sigle sono protetti e possono far silenziare o bloccare la diretta su
          YouTube.
        </p>
        <ul className="mt-3 divide-y divide-border-subtle">
          {CUE_KINDS.map((kind) => (
            <SoundRow key={kind} kind={kind} version={sounds[kind] ?? null} sounds={sounds} disabled={testMode} onMessage={setMessage} />
          ))}
        </ul>
        <a
          href="/diretta/grafica?prova=1"
          target="_blank"
          rel="noopener"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Guarda le scritte nella partita finta
        </a>
      </details>
    </div>
  );
}

/**
 * Il minuto di silenzio, in fondo al banco: la dedica (facoltativa) e «Inizia»; acceso, da quanto è in onda e «Termina». Sobrio
 * come la scritta che mette nella grafica.
 */
function SilencePanel({
  silence,
  pending,
  disabled,
  onStart,
  onStop,
}: {
  silence: Silence | null;
  pending: boolean;
  disabled: boolean;
  onStart: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!silence) return;
    const tick = () => setNow(clock());
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [silence]);

  return (
    <div className="mt-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/8 sm:p-5" data-pulsantiera-silence={silence ? "on" : "off"}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">
          <Ribbon className="h-6 w-6 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[1.15rem] font-extrabold uppercase tracking-wide text-white">Minuto di silenzio</p>
          <p className="text-[13px] text-white/55">
            {silence
              ? `In onda da ${now !== null ? elapsed(now - silence.at) : "0:00"}${silence.text ? ` · ${silence.text}` : ""}`
              : "Nella grafica una scritta sobria in basso; punteggio, scritte e suoni spariscono finché non premi «Termina»."}
          </p>
        </div>
        {silence && (
          <button
            type="button"
            onClick={onStop}
            disabled={pending}
            className="h-11 rounded-xl bg-white px-5 text-sm font-bold text-[#0a1020] transition-opacity hover:opacity-90 disabled:opacity-50"
            data-silence-stop
          >
            Termina
          </button>
        )}
      </div>
      {!silence && (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onStart(text);
          }}
        >
          <label htmlFor="silence-text" className="sr-only">
            Dedica (facoltativa)
          </label>
          <input
            id="silence-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={SILENCE_TEXT_MAX}
            placeholder="In ricordo di… (facoltativo)"
            className="h-11 min-w-0 flex-1 basis-56 rounded-xl border border-white/15 bg-white/5 px-3.5 text-base text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none sm:text-sm"
            data-silence-text
          />
          <button
            type="submit"
            disabled={pending || disabled}
            className="h-11 rounded-xl border border-white/30 px-5 text-sm font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            data-silence-start
          >
            Inizia il minuto di silenzio
          </button>
        </form>
      )}
    </div>
  );
}

function SoundRow({
  kind,
  version,
  sounds,
  disabled,
  onMessage,
}: {
  kind: CueKind;
  version: number | null;
  sounds: Record<string, number>;
  disabled: boolean;
  onMessage: (message: { tone: "ok" | "error"; text: string }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  // Solo il Monster block ha un suono di partenza: gli altri tasti, senza un file caricato, sono solo animazione.
  const original = defaultSoundUrl(kind) !== null;

  function upload(file: File) {
    const data = new FormData();
    data.set("kind", kind);
    data.set("file", file);
    startTransition(async () => {
      const result = await uploadCueSoundAction(data);
      onMessage(result.ok ? { tone: "ok", text: result.message } : { tone: "error", text: result.error });
      if (input.current) input.current.value = "";
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeCueSoundAction(kind);
      onMessage(result.ok ? { tone: "ok", text: result.message } : { tone: "error", text: result.error });
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5" data-sound-row={kind}>
      <span className="min-w-[10rem] flex-1">
        <span className="block text-sm font-semibold text-foreground">{CUE_META[kind].button}</span>
        <span className="text-[13px] text-muted-foreground" data-sound-source>
          {version ? "Il tuo file" : original ? "Suono originale" : "Solo animazione, senza suono"}
        </span>
      </span>
      <Button size="sm" variant="outline" disabled={!version && !original} onClick={() => playPreview(kind, sounds)} data-sound-play>
        <Play className="h-4 w-4" />
        Ascolta
      </Button>
      <input
        ref={input}
        type="file"
        accept="audio/*,.mp3,.m4a,.ogg,.wav"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
        }}
        data-sound-file
      />
      <Button size="sm" variant="outline" disabled={disabled || pending} onClick={() => input.current?.click()} data-sound-upload>
        <Upload className="h-4 w-4" />
        {version ? "Cambia" : "Carica il tuo"}
      </Button>
      {version && (
        <Button size="sm" variant="quiet" disabled={disabled || pending} onClick={remove} data-sound-remove>
          <Trash2 className="h-4 w-4" />
          {original ? "Torna all’originale" : "Togli il suono"}
        </Button>
      )}
    </li>
  );
}
