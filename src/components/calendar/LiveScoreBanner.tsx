"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/category";
import { cn } from "@/lib/cn";
import { readableTextColor } from "@/lib/liveScore";
import type { PublicLiveScore, PublicLiveScoreTeam, TrainingTeam } from "@/lib/types";

const ENDPOINT = "/api/livescore/pubblico";
/** Durante la diretta si rilegge il punteggio ogni 5 secondi… */
const LIVE_POLL_MS = 5_000;
/** …altrimenti una volta al minuto, per accorgersi di una diretta che parte
 * mentre la pagina è già aperta. */
const IDLE_POLL_MS = 60_000;
/** Oltre questo tempo senza punti nuovi si mostra l'ora dell'ultimo
 * aggiornamento (es. il tablet a bordo campo ha perso la connessione). */
const STALE_AFTER_MS = 3 * 60_000;

interface Snapshot {
  live: PublicLiveScore;
  /** Quando il sito l'ha letto (per capire se il punteggio è fermo da un po'). */
  checkedAt: number;
}

function TeamSide({ team, side, showSets }: { team: PublicLiveScoreTeam; side: "home" | "away"; showSets: boolean }) {
  const text = readableTextColor(team.color);
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2.5 sm:px-5 sm:py-3",
        side === "away" && "items-end text-right",
      )}
      style={{ background: team.color, color: text }}
    >
      {/* Su due righe invece che tagliato: sul telefono «Volley Lignano» non ci sta in una. */}
      <span className="line-clamp-2 w-full break-words text-[11px] font-bold uppercase leading-tight tracking-wide sm:text-sm">
        {team.name}
      </span>
      {showSets && (
        <span className="text-[11px] font-semibold opacity-80 sm:text-xs">
          Set <b className="font-extrabold opacity-100">{team.sets}</b>
        </span>
      )}
    </div>
  );
}

function ServeMark() {
  return (
    <span
      aria-hidden
      title="Al servizio"
      className="inline-block h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-green-400"
    />
  );
}

/**
 * Riquadro «In diretta» del sito pubblico: compare solo quando un admin ha
 * acceso la diretta dal Live score (in Partita) e mostra squadre, punteggio,
 * set e chi serve — mai nomi delle atlete o formazioni. Si aggiorna da solo
 * mentre la pagina è aperta e si ferma quando la scheda non è visibile.
 */
export function LiveScoreBanner({ team }: { team: TrainingTeam }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let current: PublicLiveScore | null = null;

    async function poll() {
      if (timer) clearTimeout(timer);
      timer = null;
      // Scheda nascosta: niente richieste, si riprende quando torna visibile.
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const res = await fetch(ENDPOINT);
        if (res.ok) {
          const data = (await res.json()) as { live: PublicLiveScore | null };
          current = data.live && data.live.team === team ? data.live : null;
          if (!cancelled) setSnapshot(current ? { live: current, checkedAt: Date.now() } : null);
        }
      } catch {
        // Rete assente: si riprova al giro successivo, tenendo l'ultimo punteggio.
      } finally {
        inFlight = false;
      }
      if (!cancelled) timer = setTimeout(poll, current && !current.finished ? LIVE_POLL_MS : IDLE_POLL_MS);
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [team]);

  if (!snapshot) return null;
  const { live, checkedAt } = snapshot;
  const updatedAt = Date.parse(live.updatedAt);
  const stale = !live.finished && checkedAt - updatedAt > STALE_AFTER_MS;
  const updatedLabel = new Date(updatedAt).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
  // A partita finita il punteggio del set è già azzerato: al centro vanno i set vinti.
  const [left, right] = live.finished ? [live.home.sets, live.away.sets] : [live.home.score, live.away.score];
  const scoreClass =
    "animate-[livescore-score-pop_320ms_ease-out] font-[family-name:var(--font-display-minivolley)] text-3xl font-extrabold leading-none tabular-nums sm:text-5xl";

  return (
    <section aria-label="Partita in diretta" className="border-b border-border bg-surface" data-public-livescore>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
            {live.finished ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60" />
                <span className="text-muted-foreground">Partita finita</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                </span>
                <span className="text-destructive">In diretta</span>
              </>
            )}
            {live.category && <span className="text-muted-foreground">· {CATEGORY_LABELS[live.category]}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {stale ? `Ultimo aggiornamento alle ${updatedLabel} · ` : ""}Risultato non ufficiale
          </p>
        </div>

        <div className="mt-2.5 flex overflow-hidden rounded-2xl shadow-[0_12px_28px_-18px_rgba(12,30,42,0.55)] ring-1 ring-sea-950/10">
          <TeamSide team={live.home} side="home" showSets={!live.finished} />
          <div
            className="flex shrink-0 items-center justify-center gap-2 bg-sea-950 px-3 py-2 text-white sm:gap-4 sm:px-8"
            aria-live="polite"
            data-public-livescore-score
          >
            <span className="sr-only">
              {live.finished
                ? `${live.home.name} ${live.home.sets} set, ${live.away.name} ${live.away.sets} set`
                : `${live.home.name} ${live.home.score}, ${live.away.name} ${live.away.score}`}
            </span>
            <span aria-hidden className="flex w-4 justify-end">
              {!live.finished && live.serving === "home" && <ServeMark />}
            </span>
            <span aria-hidden key={`h${left}`} className={scoreClass}>
              {left}
            </span>
            <span aria-hidden className="text-xl font-bold text-white/35 sm:text-3xl">
              –
            </span>
            <span aria-hidden key={`a${right}`} className={scoreClass}>
              {right}
            </span>
            <span aria-hidden className="flex w-4">
              {!live.finished && live.serving === "away" && <ServeMark />}
            </span>
          </div>
          <TeamSide team={live.away} side="away" showSets={!live.finished} />
        </div>

        {live.sets.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {live.sets.map((set, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold tabular-nums text-foreground"
              >
                <span className="font-semibold text-muted-foreground">{i + 1}° set</span>
                {set.home}–{set.away}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
