"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ComponentType } from "react";
import Link from "next/link";
import { ArrowLeft, BrickWall, ExternalLink, Flame, Megaphone, Music, Play, Repeat, Shield, Trash2, Upload, Volume2, VolumeX, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { CUE_COOLDOWN_MS, CUE_DURATION_MS, CUE_KINDS, CUE_META, defaultSoundUrl, MAX_SOUND_BYTES, type CueKind } from "@/lib/diretta/cues";
import { playCue } from "@/lib/diretta/jingles";
import { removeCueSoundAction, sendCueAction, uploadCueSoundAction } from "./actions";

/** Il colore di ogni tasto (come i tasti di uno Stream Deck: si riconoscono a colpo d'occhio) e la sua icona. */
const LOOK: Record<CueKind, { background: string; icon: ComponentType<{ className?: string }> }> = {
  monsterBlock: { background: "linear-gradient(160deg,#1d4ed8 0%,#0b1b4d 100%)", icon: BrickWall },
  ace: { background: "linear-gradient(160deg,#ffd23f 0%,#ff8a3d 100%)", icon: Zap },
  attack: { background: "linear-gradient(160deg,#ff4f8b 0%,#b5179e 100%)", icon: Flame },
  dig: { background: "linear-gradient(160deg,#22b8f0 0%,#1d4ed8 100%)", icon: Shield },
  rally: { background: "linear-gradient(160deg,#2ee07a 0%,#0f8a5f 100%)", icon: Repeat },
  cheer: { background: "linear-gradient(160deg,#8b5cf6 0%,#4c1d95 100%)", icon: Megaphone },
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

/**
 * La pulsantiera: sei tasti grandi, un tocco manda in onda la scritta (nella grafica di Streamlabs / OBS circa un secondo dopo).
 * Il tasto toccato si illumina finché la scritta è in onda; un secondo tocco subito dopo aspetta (CUE_COOLDOWN_MS). Il suono
 * esce dalla diretta, non dal tablet: «Suono anche qui» serve per provarlo. Sotto, i suoni: ascolta, carica il tuo, torna
 * all'originale.
 */
export function Pulsantiera({ sounds, testMode }: { sounds: Record<string, number>; testMode: boolean }) {
  const [onAir, setOnAir] = useState<{ kind: CueKind; until: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // «Suono anche qui»: ricordato dal browser (letto dopo il primo disegno), poi quello che si sceglie.
  const storedLocalSound = useSyncExternalStore(subscribeNothing, readLocalSound, () => false);
  const [chosenLocalSound, setLocalSound] = useState<boolean | null>(null);
  const localSound = chosenLocalSound ?? storedLocalSound;
  const [pending, startTransition] = useTransition();
  const lastTap = useRef(0);

  useEffect(() => {
    if (!onAir) return;
    const timer = setTimeout(() => setOnAir(null), Math.max(0, onAir.until - clock()));
    return () => clearTimeout(timer);
  }, [onAir]);

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
    if (now - lastTap.current < CUE_COOLDOWN_MS) return;
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" role="group" aria-label="Scritte da mandare in diretta">
        {CUE_KINDS.map((kind) => {
          const meta = CUE_META[kind];
          const Icon = LOOK[kind].icon;
          const live = onAir?.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => send(kind)}
              disabled={pending && !live}
              data-cue-button={kind}
              data-cue-live={live ? "" : undefined}
              aria-label={`Manda in diretta: ${meta.button}`}
              className={cn(
                "relative flex min-h-[9.5rem] flex-col items-start justify-between overflow-hidden rounded-2xl p-4 text-left text-white shadow-[0_10px_30px_-12px_rgba(9,26,38,0.6)] transition-transform active:scale-[0.97] sm:min-h-[12rem] sm:p-5",
                live && "ring-4 ring-white ring-offset-2 ring-offset-background",
              )}
              style={{ background: LOOK[kind].background }}
            >
              <Icon className="h-9 w-9 drop-shadow sm:h-11 sm:w-11" />
              <span>
                <span className="block font-display text-[1.35rem] font-extrabold uppercase leading-tight tracking-wide drop-shadow sm:text-[1.7rem]">{meta.button}</span>
                <span className="mt-1 hidden text-[13px] leading-snug text-white/85 sm:block">{meta.hint}</span>
              </span>
              {live && (
                <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0b1b4d]">In onda</span>
              )}
              {live && (
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 origin-left bg-white/80" style={{ animation: `pulsantiera-bar ${CUE_DURATION_MS}ms linear both` }} />
              )}
            </button>
          );
        })}
      </div>

      <p
        className={cn("min-h-[1.5rem] text-sm font-medium", message?.tone === "error" ? "text-destructive" : "text-muted-foreground")}
        role={message?.tone === "error" ? "alert" : "status"}
        data-pulsantiera-message
      >
        {message?.text ?? "La scritta compare nella grafica circa un secondo dopo il tocco. Solo la scritta: nessuna giocatrice."}
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
