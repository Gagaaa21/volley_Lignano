"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Timer, Trophy, Volleyball } from "lucide-react";
import crestU14U15 from "@/assets/lignano-crest.png";
import crestMinivolley from "@/assets/minivolley-crest.png";
import { CATEGORY_LABELS } from "@/lib/category";
import { cn } from "@/lib/cn";
import { readableTextColor, teamMonogram } from "@/lib/liveScore";
import type { PublicLiveScore, PublicLiveScoreTeam, TrainingTeam } from "@/lib/types";
import { TIMEOUTS_PER_SET } from "@/lib/volleyRules";

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

type Side = "home" | "away";

/** Lo stemma per noi, il tondo con le iniziali (nel colore scelto dal coach) per l'avversaria. */
function TeamBadge({ team, side, crest }: { team: PublicLiveScoreTeam; side: Side; crest: typeof crestU14U15 }) {
  if (side === "home") {
    return (
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white p-1.5 shadow-md ring-1 ring-white/40 sm:h-12 sm:w-12 sm:p-2">
        <Image src={crest} alt="" className="h-full w-full object-contain" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold tracking-wide shadow-md ring-2 ring-white/35 sm:h-12 sm:w-12 sm:text-base"
      style={{ background: team.color, color: readableTextColor(team.color) }}
    >
      {teamMonogram(team.name)}
    </span>
  );
}

/** Il colore di una squadra come bagliore sul tabellone (solo se è un esadecimale valido: lo sceglie il coach). */
function glow(color: string, at: "0%" | "100%"): string | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return null;
  return `radial-gradient(55% 150% at ${at} 50%, ${color}52 0%, ${color}00 72%)`;
}

/** Quanti time-out ha usato una squadra nel set: due puntini, pieni quelli già chiamati. */
function TimeoutPips({ used, who }: { used: number; who: string }) {
  const spent = Math.min(Math.max(used, 0), TIMEOUTS_PER_SET);
  return (
    <span
      className="inline-flex items-center gap-1.5"
      data-public-timeouts={spent}
      title={`Time-out ${who}: ${spent} usati su ${TIMEOUTS_PER_SET}`}
    >
      <Timer aria-hidden className="h-3 w-3 text-amber-300/90 sm:h-3.5 sm:w-3.5" />
      <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-white/50 sm:inline">Time-out</span>
      <span aria-hidden className="flex items-center gap-1">
        {Array.from({ length: TIMEOUTS_PER_SET }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 w-2 rounded-full border sm:h-2.5 sm:w-2.5",
              i < spent ? "border-amber-300 bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.75)]" : "border-white/35",
            )}
          />
        ))}
      </span>
      <span className="sr-only">
        Time-out {who}: {spent} usati su {TIMEOUTS_PER_SET}
      </span>
    </span>
  );
}

/** Il nome della squadra, con lo stemma (o le iniziali nel suo colore) e, se batte, il pallone verde. */
function TeamName({
  team,
  side,
  serving,
  winner,
  crest,
}: {
  team: PublicLiveScoreTeam;
  side: Side;
  serving: boolean;
  winner: boolean;
  crest: typeof crestU14U15;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", side === "away" && "items-end text-right")}>
      <span className={cn("flex items-center gap-2.5", side === "away" && "flex-row-reverse")}>
        <TeamBadge team={team} side={side} crest={crest} />
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-green-400/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-green-300 ring-1 ring-green-400/40",
            !serving && "invisible",
          )}
          aria-hidden={!serving}
          title="Al servizio"
        >
          <Volleyball className="h-3 w-3" />
          Batte
        </span>
      </span>
      <p className="line-clamp-3 w-full break-words font-display text-[13px] font-extrabold uppercase leading-tight tracking-wide text-white sm:line-clamp-2 sm:text-xl">
        {winner && <Trophy aria-label="Ha vinto" className={cn("mb-0.5 inline h-4 w-4 text-amber-300", side === "away" ? "ml-0 mr-1.5" : "mr-1.5")} />}
        {team.name}
      </p>
    </div>
  );
}

/** Sotto il nome: i set vinti e i time-out usati. */
function TeamMeta({
  team,
  side,
  showSets,
  timeouts,
}: {
  team: PublicLiveScoreTeam;
  side: Side;
  showSets: boolean;
  timeouts: number | null;
}) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5", side === "away" && "justify-end")}>
      {showSets && (
        <span className="inline-flex items-baseline gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/65 sm:text-xs">
          Set <b className="font-display text-sm font-extrabold text-white sm:text-base">{team.sets}</b>
        </span>
      )}
      {timeouts !== null && <TimeoutPips used={timeouts} who={team.name} />}
    </div>
  );
}

/**
 * Riquadro «In diretta» del sito pubblico: compare solo quando un admin ha
 * acceso la diretta dal Live score (in Partita) o il «Punteggio live» dello
 * Scout e mostra squadre, punteggio, set, chi serve e i time-out usati —
 * mai nomi delle atlete, numeri di maglia o formazioni. Si aggiorna da solo
 * mentre la pagina è aperta e si ferma quando la scheda non è visibile.
 *
 * È un tabellone scuro, uguale con ogni tema: i colori delle due squadre
 * fanno solo da bagliore e da segno accanto al nome.
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
  const winner: Side | null = live.finished && live.home.sets !== live.away.sets ? (live.home.sets > live.away.sets ? "home" : "away") : null;
  // I time-out sono quelli del set in corso: a partita finita non si mostrano. Un sito aggiornato prima di questa funzione non li manda.
  const timeouts = live.finished || !live.timeouts ? null : live.timeouts;
  const currentSet = live.sets.length + 1;
  const crest = team === "minivolley" ? crestMinivolley : crestU14U15;
  const backgrounds = [
    "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0) 42%)",
    glow(live.home.color, "0%"),
    glow(live.away.color, "100%"),
  ].filter((layer): layer is string => layer !== null);
  const digit =
    "motion-safe:animate-[livescore-score-pop_320ms_ease-out] font-display text-[3.5rem] font-extrabold leading-none tabular-nums sm:text-7xl lg:text-[5.5rem]";

  return (
    <section aria-label="Partita in diretta" className="border-b border-border bg-surface" data-public-livescore>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-3xl text-white shadow-[0_26px_60px_-30px_rgba(6,20,30,0.9)] ring-1 ring-white/10"
          style={{ backgroundColor: "#0a1e2c", backgroundImage: backgrounds.join(", ") }}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 pt-4 sm:px-8 sm:pt-5">
            <p className="flex flex-wrap items-center gap-2">
              {live.finished ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/75">
                  <span className="h-2 w-2 rounded-full bg-white/50" />
                  Partita finita
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_0_18px_rgba(239,68,68,0.55)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-70 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  In diretta
                </span>
              )}
              {live.category && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white/75">{CATEGORY_LABELS[live.category]}</span>
              )}
              {!live.finished && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white/75" data-public-livescore-set>
                  {currentSet}° set
                </span>
              )}
            </p>
            <p className="text-[11px] text-white/55">
              {stale && <span className="mr-2 font-semibold text-amber-300">Fermo alle {updatedLabel}</span>}
              Risultato non ufficiale
            </p>
          </div>

          <div className="grid grid-cols-2 items-center gap-x-4 gap-y-3 px-4 pb-4 pt-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-x-8 sm:gap-y-2 sm:px-8 sm:pb-6 sm:pt-5">
            {/* Sul telefono nome e dettagli stanno uno sopra e uno sotto il punteggio; dal tablet in su sono un blocco solo accanto al punteggio. */}
            <div className="contents sm:col-start-1 sm:row-span-2 sm:row-start-1 sm:flex sm:flex-col sm:justify-center sm:gap-4">
              <div className="col-start-1 row-start-1">
                <TeamName team={live.home} side="home" serving={!live.finished && live.serving === "home"} winner={winner === "home"} crest={crest} />
              </div>
              <div className="col-start-1 row-start-3">
                <TeamMeta team={live.home} side="home" showSets={!live.finished} timeouts={timeouts ? timeouts.home : null} />
              </div>
            </div>

            <div
              className="col-span-2 row-start-2 flex flex-col items-center gap-1 justify-self-center sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1"
              aria-live="polite"
              data-public-livescore-score
            >
              <span className="sr-only">
                {live.finished
                  ? `${live.home.name} ${live.home.sets} set, ${live.away.name} ${live.away.sets} set`
                  : `${live.home.name} ${live.home.score}, ${live.away.name} ${live.away.score}`}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45" aria-hidden>
                {live.finished ? "Set vinti" : "Punti del set"}
              </span>
              <div className="flex items-center gap-3 rounded-2xl bg-black/30 px-5 py-2.5 ring-1 ring-white/10 sm:gap-5 sm:px-8 sm:py-4" aria-hidden>
                <span key={`h${left}`} className={cn(digit, "min-w-[1.1ch] text-right")}>
                  {left}
                </span>
                <span className="text-3xl font-bold text-white/30 sm:text-5xl">–</span>
                <span key={`a${right}`} className={cn(digit, "min-w-[1.1ch] text-left")}>
                  {right}
                </span>
              </div>
            </div>

            <div className="contents sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:flex sm:flex-col sm:justify-center sm:gap-4">
              <div className="col-start-2 row-start-1">
                <TeamName team={live.away} side="away" serving={!live.finished && live.serving === "away"} winner={winner === "away"} crest={crest} />
              </div>
              <div className="col-start-2 row-start-3">
                <TeamMeta team={live.away} side="away" showSets={!live.finished} timeouts={timeouts ? timeouts.away : null} />
              </div>
            </div>
          </div>

          {live.sets.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-white/10 bg-black/20 px-4 py-3 sm:px-8">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Parziali</span>
              {live.sets.map((set, i) => {
                const homeWon = set.home > set.away;
                const tied = set.home === set.away;
                const wonColor = tied ? null : homeWon ? live.home.color : live.away.color;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-white/10"
                    data-public-livescore-played={i + 1}
                  >
                    <span className="font-semibold text-white/50">{i + 1}°</span>
                    <span className={homeWon ? "text-white" : "text-white/55"}>{set.home}</span>
                    <span className="text-white/30">–</span>
                    <span className={!homeWon && !tied ? "text-white" : "text-white/55"}>{set.away}</span>
                    {wonColor && <span aria-hidden className="h-1.5 w-1.5 rounded-full ring-1 ring-white/40" style={{ background: wonColor }} />}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
