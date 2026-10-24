"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Timer, Trophy, Volleyball } from "lucide-react";
import crestU14U15 from "@/assets/lignano-crest.png";
import crestMinivolley from "@/assets/minivolley-crest.png";
import { cn } from "@/lib/cn";
import { CategoryTag } from "@/components/ui/CategoryTag";
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

// Lo stemma sta sempre su bianco, anche con il tema scuro (come nell'intestazione del sito).
const BADGE_TILE = "grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-border sm:h-14 sm:w-14 sm:p-2";

/**
 * Lo stemma per noi; per l'avversaria il logo del girone, se la risposta ne porta uno e l'immagine si carica, altrimenti il
 * tondo con le iniziali (nel colore scelto dal coach).
 */
function TeamBadge({ team, side, crest }: { team: PublicLiveScoreTeam; side: Side; crest: typeof crestU14U15 }) {
  // Il logo che non si è caricato: se la risposta ne porta un altro si riprova.
  const [failed, setFailed] = useState<string | null>(null);
  if (side === "home") {
    return (
      <span className={BADGE_TILE}>
        <Image src={crest} alt="" className="h-full w-full object-contain" />
      </span>
    );
  }
  const logo = team.logo ?? null;
  if (logo && failed !== logo) {
    return (
      <span className={BADGE_TILE} data-public-team-logo>
        {/* Immagine già ridotta e tenuta in cache dal nostro server: next/image non serve. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setFailed(logo)}
          // Se l'errore è arrivato prima che la pagina fosse pronta, l'evento si perde: si ricontrolla qui.
          ref={(img) => {
            if (img && img.complete && img.naturalWidth === 0) setFailed(logo);
          }}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      data-public-team-monogram
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold tracking-wide shadow-sm ring-2 ring-card sm:h-14 sm:w-14 sm:text-lg"
      style={{ background: team.color, color: readableTextColor(team.color) }}
    >
      {teamMonogram(team.name)}
    </span>
  );
}

/** Il colore di una squadra, solo se è un esadecimale valido (lo sceglie il coach); altrimenti il colore del sito. */
function teamColor(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "var(--primary)";
}

/** Il colore di una squadra come bagliore dalla sua parte: leggero sul tema chiaro, più acceso sullo scuro (--live-glow). */
function glow(color: string, at: "0%" | "100%"): string {
  return `radial-gradient(60% 170% at ${at} 45%, color-mix(in oklab, ${teamColor(color)} var(--live-glow), transparent) 0%, transparent 70%)`;
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
      <Timer aria-hidden className="h-3 w-3 text-[var(--color-sand-500)] sm:h-3.5 sm:w-3.5" />
      <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">Time-out</span>
      <span aria-hidden className="flex items-center gap-1">
        {Array.from({ length: TIMEOUTS_PER_SET }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 w-2 rounded-full border sm:h-2.5 sm:w-2.5",
              // L'oro dello stemma (nel tema del sito), come le altre evidenze.
              i < spent ? "border-[var(--color-sand-500)] bg-[var(--color-sand-400)]" : "border-muted-foreground/45",
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
            "inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-success ring-1 ring-success/25",
            !serving && "invisible",
          )}
          aria-hidden={!serving}
          title="Al servizio"
        >
          <Volleyball className="h-3 w-3" />
          Batte
        </span>
      </span>
      <p className="line-clamp-3 w-full break-words font-display text-[13px] font-extrabold uppercase leading-tight tracking-wide text-foreground sm:line-clamp-2 sm:text-xl">
        {winner && <Trophy aria-label="Ha vinto" className="mb-0.5 mr-1.5 inline h-4 w-4 text-[var(--color-sand-500)]" />}
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
        <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
          Set <b className="font-display text-sm font-extrabold text-foreground sm:text-base">{team.sets}</b>
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
 * Segue il tema scelto (chiaro o scuro, e i colori del sito): è una scheda
 * come le altre, con i colori delle due squadre come filo in alto, bagliore
 * dalla loro parte e segno sotto il punteggio.
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
  const backgrounds = [glow(live.home.color, "0%"), glow(live.away.color, "100%")];
  // Il filo in alto: dal colore nostro a quello dell'avversaria.
  const strip = `linear-gradient(90deg, ${teamColor(live.home.color)} 0%, ${teamColor(live.home.color)} 40%, ${teamColor(live.away.color)} 60%, ${teamColor(live.away.color)} 100%)`;
  const digit =
    "motion-safe:animate-[livescore-score-pop_320ms_ease-out] font-display text-[3.5rem] font-extrabold leading-none tabular-nums text-foreground sm:text-7xl lg:text-[5.5rem]";

  return (
    <section aria-label="Partita in diretta" className="border-b border-border bg-background" data-public-livescore>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-raised"
          style={{ backgroundImage: backgrounds.join(", ") }}
        >
          <div aria-hidden className="h-1.5 w-full" style={{ backgroundImage: strip }} />

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 pt-3.5 sm:px-8 sm:pt-5">
            <p className="flex flex-wrap items-center gap-2">
              {live.finished ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                  Partita finita
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_6px_16px_-6px_rgba(220,38,38,0.75)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-70 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  In diretta
                </span>
              )}
              {live.category && <CategoryTag category={live.category} size="md" long className="rounded-full px-3" />}
              {!live.finished && (
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary ring-1 ring-primary/15" data-public-livescore-set>
                  {currentSet}° set
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {stale && <span className="mr-2 font-semibold text-warning">Fermo alle {updatedLabel}</span>}
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
              className="col-span-2 row-start-2 flex flex-col items-center gap-1.5 justify-self-center sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1"
              aria-live="polite"
              data-public-livescore-score
            >
              <span className="sr-only">
                {live.finished
                  ? `${live.home.name} ${live.home.sets} set, ${live.away.name} ${live.away.sets} set`
                  : `${live.home.name} ${live.home.score}, ${live.away.name} ${live.away.score}`}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground" aria-hidden>
                {live.finished ? "Set vinti" : "Punti del set"}
              </span>
              <div
                className="flex items-start gap-3 rounded-2xl bg-surface-muted px-5 pb-3 pt-3 shadow-[inset_0_1px_3px_rgba(15,30,50,0.08)] ring-1 ring-border sm:gap-5 sm:px-8 sm:pb-4 sm:pt-4"
                aria-hidden
              >
                <span className="flex flex-col items-center gap-2">
                  <span key={`h${left}`} className={cn(digit, "min-w-[1.1ch] text-center")}>
                    {left}
                  </span>
                  <span className="h-1 w-9 rounded-full sm:h-1.5 sm:w-12" style={{ background: teamColor(live.home.color) }} />
                </span>
                <span className="self-center pb-3 text-3xl font-bold text-muted-foreground/50 sm:pb-4 sm:text-5xl">–</span>
                <span className="flex flex-col items-center gap-2">
                  <span key={`a${right}`} className={cn(digit, "min-w-[1.1ch] text-center")}>
                    {right}
                  </span>
                  <span className="h-1 w-9 rounded-full sm:h-1.5 sm:w-12" style={{ background: teamColor(live.away.color) }} />
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border bg-surface-muted/70 px-4 py-3 sm:px-8">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Parziali</span>
              {live.sets.map((set, i) => {
                const homeWon = set.home > set.away;
                const tied = set.home === set.away;
                const wonColor = tied ? null : teamColor(homeWon ? live.home.color : live.away.color);
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-bold tabular-nums shadow-xs ring-1 ring-border"
                    data-public-livescore-played={i + 1}
                  >
                    <span className="font-semibold text-muted-foreground">{i + 1}°</span>
                    <span className={homeWon ? "font-extrabold text-foreground" : "font-semibold text-muted-foreground"}>{set.home}</span>
                    <span className="text-muted-foreground/50">–</span>
                    <span className={!homeWon && !tied ? "font-extrabold text-foreground" : "font-semibold text-muted-foreground"}>{set.away}</span>
                    {wonColor && <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: wonColor }} />}
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
