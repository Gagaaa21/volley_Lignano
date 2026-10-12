"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { playBeeps, vibrate } from "@/lib/beep";
import { cn } from "@/lib/cn";
import {
  fractionLeft,
  formatClock,
  isTimeoutForgotten,
  nowMs,
  secondsLeft,
  timeoutPhase,
  type TimeoutRun,
} from "@/lib/timeoutClock";
import { TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import type { TeamAccent } from "./accent";

/** Ogni quanto si aggiorna il conto: un quinto di secondo basta a non perdere mai uno scatto. */
const TICK_MS = 200;

/** L'ora, aggiornata a ogni scatto finché la scheda è in pagina. */
function useNow(): number {
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMs()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * Il time-out in corso: la squadra che l'ha chiesto, un conto alla rovescia grande (30 secondi, vedi
 * timeoutClock.ts) con la sua barra, il suono per spegnerlo e «Fine time-out» per chiuderlo prima. Negli ultimi 10
 * secondi diventa arancione; a zero suona due volte (se il suono è acceso), vibra dove si può, resta rosso qualche
 * secondo e poi si chiude da solo.
 */
export function TimeoutCard({
  run,
  teamLabel,
  accent,
  soundOn,
  onToggleSound,
  onClose,
}: {
  run: TimeoutRun;
  teamLabel: string;
  accent: TeamAccent;
  soundOn: boolean;
  onToggleSound: () => void;
  onClose: () => void;
}) {
  // Mai prima del via: se un nuovo time-out prende il posto del vecchio, l'ultima lettura dell'ora può essere di un attimo prima.
  const tick = useNow();
  const now = Math.max(tick, run.startedAt);
  const left = secondsLeft(run, now);
  const phase = timeoutPhase(run, now);
  const over = phase === "over";

  // A zero: bip e vibrazione, una volta sola per ogni time-out.
  const announced = useRef<number | null>(null);
  useEffect(() => {
    if (!over || announced.current === run.startedAt) return;
    announced.current = run.startedAt;
    if (soundOn) playBeeps(2);
    vibrate([200, 120, 200]);
  }, [over, run.startedAt, soundOn]);

  // Finito da un po': si chiude da solo.
  const forgotten = isTimeoutForgotten(run, now);
  useEffect(() => {
    if (forgotten) onClose();
  }, [forgotten, onClose]);

  const barColor = over ? "var(--destructive)" : phase === "warning" ? "#f59e0b" : accent.background;
  return (
    <div
      role="group"
      aria-label={`Time-out di ${teamLabel}`}
      data-livescore-timeout
      data-phase={phase}
      className={cn(
        "shrink-0 rounded-2xl border-2 px-3.5 py-2.5 transition-colors sm:px-4",
        phase === "running" && "bg-surface",
        phase === "warning" && "border-amber-500 bg-amber-50 text-amber-950",
        phase === "over" && "border-destructive bg-destructive/10 text-foreground motion-safe:animate-pulse",
      )}
      style={phase === "running" ? { borderColor: accent.background } : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: accent.background, color: accent.text }}>
          <Timer className="h-6 w-6" />
        </span>
        <div className="min-w-[7rem] flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {over ? "Time-out finito" : `Time-out · ${run.nth}° di ${TIMEOUTS_PER_SET}`}
          </p>
          <p className="truncate font-display text-lg font-bold leading-tight sm:text-xl">{teamLabel}</p>
        </div>
        <p
          role="timer"
          aria-label={over ? "Time-out finito" : `Mancano ${left} secondi`}
          data-livescore-timeout-clock
          className={cn(
            "shrink-0 font-[family-name:var(--font-display-minivolley)] text-5xl font-extrabold leading-none tabular-nums sm:text-6xl",
            phase === "warning" && "text-amber-700",
            over && "text-destructive",
          )}
        >
          {formatClock(left)}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="border-2"
            onClick={onToggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Spegni il suono del time-out" : "Accendi il suono del time-out"}
            title={soundOn ? "Il suono avvisa quando il time-out finisce: tocca per spegnerlo" : "Suono spento: tocca per riaccenderlo"}
            data-livescore-timeout-sound
          >
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          <Button variant={over ? "primary" : "outline"} className={over ? undefined : "border-2"} onClick={onClose} data-livescore-timeout-close>
            {over ? "Chiudi" : "Fine time-out"}
          </Button>
        </div>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/10" aria-hidden>
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{ width: `${Math.round(fractionLeft(run, now) * 100)}%`, background: barColor }}
        />
      </div>
      {/* Per chi legge lo schermo a voce: solo i due momenti che contano, non ogni secondo. */}
      <span className="sr-only" role="status">
        {over ? "Time-out finito" : phase === "warning" ? "Ultimi 10 secondi" : ""}
      </span>
    </div>
  );
}
