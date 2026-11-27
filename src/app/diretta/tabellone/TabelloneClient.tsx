"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, Maximize, Minimize, Volleyball, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { DEMO_STEP_MS, demoScript } from "@/lib/diretta/demo";
import {
  BOARD_RETRY_MS,
  BOARD_STALE_MS,
  BOARD_TIMEOUT_LINGER_MS,
  boardPollDelay,
  boardSetLabel,
  nextBoardTimeout,
  type BoardSide,
  type BoardTimeout,
} from "@/lib/diretta/tabellone";
import type { PublicLiveScore, PublicLiveScoreTeam } from "@/lib/types";
import { TIMEOUT_SECONDS, TIMEOUTS_PER_SET } from "@/lib/volleyRules";

/** Il punteggio come la grafica di Streamlabs: anche a 0–0 appena si accende il live, e senza la copia della rete di Vercel. */
const SCORE_URL = "/api/livescore/pubblico?prima=1&regia=1";
const FETCH_TIMEOUT_MS = 4_000;
const SWAP_KEY = "vl-tabellone-lati";

interface BoardState {
  loaded: boolean;
  live: PublicLiveScore | null;
  timeout: BoardTimeout | null;
  /** L'ultima lettura riuscita (millisecondi). */
  okAt: number | null;
}

// I lati (Lignano a sinistra o a destra) restano come li si è lasciati su questo tablet; senza memoria del browser valgono finché
// la pagina resta aperta.
let swapMemory = false;
const swapListeners = new Set<() => void>();
function readSwap(): boolean {
  try {
    const stored = localStorage.getItem(SWAP_KEY);
    if (stored !== null) return stored === "1";
  } catch {
    // Memoria del browser non disponibile.
  }
  return swapMemory;
}
function writeSwap(value: boolean) {
  swapMemory = value;
  try {
    localStorage.setItem(SWAP_KEY, value ? "1" : "0");
  } catch {
    // Non si ricorda alla prossima apertura, ma si scambia lo stesso.
  }
  swapListeners.forEach((listener) => listener());
}
function subscribeSwap(listener: () => void) {
  swapListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    swapListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const clock = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

/**
 * Il tabellone per la palestra: un tablet che fa da tabellone segnapunti quando quello della palestra non funziona. Rilegge il
 * punteggio dello Scout ogni secondo (è un dispositivo solo, come la grafica di Streamlabs) e mostra solo squadre, punti, set
 * vinti, chi batte e time-out (con il conto dei 30 secondi). Mai una giocatrice. `?prova=1`: la partita finta, per provarlo a casa.
 */
export function TabelloneClient() {
  const params = useSearchParams();
  const demo = params.get("prova") === "1";
  const [state, setState] = useState<BoardState>({ loaded: false, live: null, timeout: null, okAt: null });
  const [now, setNow] = useState<number | null>(null);
  const swapped = useSyncExternalStore(subscribeSwap, readSwap, () => false);
  const [fullscreen, setFullscreen] = useState<{ can: boolean; on: boolean }>({ can: false, on: false });

  // L'ultima lettura e il time-out in corso, per confrontarli con la lettura nuova (vedi nextBoardTimeout).
  const previous = useRef<PublicLiveScore | null>(null);
  const timeout = useRef<BoardTimeout | null>(null);
  const apply = useRef((live: PublicLiveScore | null, at: number) => {
    timeout.current = nextBoardTimeout(previous.current, live, timeout.current, at);
    previous.current = live;
    setState({ loaded: true, live, timeout: timeout.current, okAt: at });
  });

  // L'orologio: l'ora in alto, il conto del time-out e l'avviso di connessione persa.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, []);

  // Il punteggio: ogni secondo mentre si gioca, più di rado senza partita (vedi boardPollDelay).
  useEffect(() => {
    if (demo) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: AbortController | null = null;
    const read = async () => {
      clearTimeout(timer);
      if (inFlight) return;
      const controller = new AbortController();
      inFlight = controller;
      const abort = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let delay = BOARD_RETRY_MS;
      try {
        const response = await fetch(SCORE_URL, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { live?: PublicLiveScore | null };
        if (stopped) return;
        const live = data.live ?? null;
        apply.current(live, Date.now());
        delay = boardPollDelay(live, document.visibilityState === "hidden");
      } catch {
        // Rete assente o risposta sbagliata: resta l'ultimo punteggio (con l'avviso) e si riprova presto.
      } finally {
        clearTimeout(abort);
        inFlight = null;
      }
      if (!stopped) timer = setTimeout(read, delay);
    };
    void read();
    // Riacceso lo schermo si rilegge subito, senza aspettare il ritmo lento.
    const onVisible = () => {
      if (document.visibilityState === "visible") void read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      inFlight?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [demo]);

  // La partita finta, in ciclo.
  useEffect(() => {
    if (!demo) return;
    const script = demoScript();
    let index = 0;
    const step = () => {
      apply.current(script[index % script.length], Date.now());
      index += 1;
    };
    step();
    const timer = setInterval(step, DEMO_STEP_MS);
    return () => clearInterval(timer);
  }, [demo]);

  // Lo schermo resta acceso (dove il browser lo permette); si richiede di nuovo quando torna visibile o al primo tocco.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      if (lock || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {
        // Non permesso (batteria scarica, browser vecchio): si tiene acceso dalle impostazioni del tablet.
      }
    };
    const retry = () => void request();
    void request();
    document.addEventListener("visibilitychange", retry);
    window.addEventListener("pointerdown", retry);
    return () => {
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("pointerdown", retry);
      void lock?.release().catch(() => {});
    };
  }, []);

  const toggleSwap = () => writeSwap(!swapped);

  useEffect(() => {
    const sync = () => setFullscreen({ can: Boolean(document.fullscreenEnabled), on: Boolean(document.fullscreenElement) });
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const { live, okAt, loaded } = state;
  const stale = !demo && now !== null && okAt !== null && now - okAt > BOARD_STALE_MS;
  const shownTimeout = state.timeout && now !== null && now < state.timeout.endsAt + BOARD_TIMEOUT_LINGER_MS ? state.timeout : null;
  const phase = !loaded ? "loading" : !live ? "waiting" : live.finished ? "finished" : live.notStarted ? "pregame" : "live";

  return (
    <main
      className="fixed inset-0 flex select-none flex-col overflow-hidden bg-[#050f18] text-white"
      data-tabellone={phase}
      data-tabellone-swapped={swapped || undefined}
    >
      {live ? (
        <>
          <header className="flex shrink-0 items-center justify-between gap-[2vmin] px-[3vmin] pt-[2.4vmin] text-[4.2vmin] font-bold uppercase leading-none tracking-[0.08em]">
            <span className="text-[#facc15]" data-board-set-label>
              {boardSetLabel(live)}
            </span>
            {live.sets.length > 0 && (
              <span className="tabular min-w-0 truncate text-[3.4vmin] font-semibold normal-case tracking-normal text-white/60" data-board-partials>
                {live.sets.map((set) => `${set.home}-${set.away}`).join("  ·  ")}
              </span>
            )}
            <span className="tabular text-white/60">{now !== null ? clock.format(now) : ""}</span>
          </header>

          <div className={cn("flex min-h-0 flex-1 gap-[2.4vmin] p-[3vmin] portrait:flex-col", swapped ? "flex-row-reverse portrait:flex-col-reverse" : "flex-row")}>
            {(["home", "away"] as const).map((side) => (
              <TeamPanel
                key={side}
                side={side}
                team={live[side]}
                finished={live.finished}
                serving={!live.finished && live.serving === side}
                timeoutsUsed={live.timeouts[side]}
                timeoutLeft={
                  shownTimeout?.side === side && now !== null
                    ? Math.min(TIMEOUT_SECONDS, Math.max(0, Math.ceil((shownTimeout.endsAt - now) / 1000)))
                    : null
                }
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-[3vmin] px-[6vmin] text-center">
          <Volleyball className="h-[12vmin] w-[12vmin] text-[#facc15]" aria-hidden />
          <p className="font-display text-[7vmin] font-extrabold uppercase leading-none tracking-[0.04em]">
            {loaded ? "In attesa della partita" : "Collegamento…"}
          </p>
          {loaded && (
            <p className="max-w-[90vmin] text-[3.4vmin] leading-snug text-white/60">
              Il tabellone si accende da solo quando nello Scout della partita la diretta è accesa (lo è di partenza), poco prima dell&apos;orario.
            </p>
          )}
          {now !== null && <p className="tabular font-display text-[16vmin] font-extrabold leading-none text-white/85">{clock.format(now)}</p>}
        </div>
      )}

      <footer className="flex shrink-0 items-center justify-between gap-[2vmin] px-[3vmin] pb-[2vmin] text-[2.2vmin] text-white/35">
        <button
          type="button"
          onClick={toggleSwap}
          className="inline-flex items-center gap-[1vmin] rounded-full px-[1.6vmin] py-[1vmin] hover:bg-white/10 hover:text-white/70"
          data-board-swap
        >
          <ArrowLeftRight className="h-[2.8vmin] w-[2.8vmin]" aria-hidden />
          Scambia lati
        </button>
        {stale ? (
          <span className="inline-flex items-center gap-[1vmin] rounded-full bg-[#f59e0b] px-[2vmin] py-[0.8vmin] font-bold text-black" data-board-stale>
            <WifiOff className="h-[2.8vmin] w-[2.8vmin]" aria-hidden />
            Senza connessione: ultimo punteggio ricevuto alle {okAt !== null ? clock.format(okAt) : ""}
          </span>
        ) : (
          <span>{demo ? "Partita finta di prova" : "Risultato non ufficiale · dallo Scout"}</span>
        )}
        {fullscreen.can ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-[1vmin] rounded-full px-[1.6vmin] py-[1vmin] hover:bg-white/10 hover:text-white/70"
            data-board-fullscreen
          >
            {fullscreen.on ? <Minimize className="h-[2.8vmin] w-[2.8vmin]" aria-hidden /> : <Maximize className="h-[2.8vmin] w-[2.8vmin]" aria-hidden />}
            {fullscreen.on ? "Esci" : "Schermo intero"}
          </button>
        ) : (
          <span />
        )}
      </footer>
    </main>
  );
}

/** Una squadra: nome, chi batte, i punti grandi, i set vinti e i time-out usati nel set (a fine partita i set vinti al posto dei punti). */
function TeamPanel({
  side,
  team,
  finished,
  serving,
  timeoutsUsed,
  timeoutLeft,
}: {
  side: BoardSide;
  team: PublicLiveScoreTeam;
  finished: boolean;
  serving: boolean;
  timeoutsUsed: number;
  /** Secondi del time-out in corso di questa squadra, null se non ce n'è uno. */
  timeoutLeft: number | null;
}) {
  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[2.4vmin] bg-white/[0.045] ring-1 ring-white/10"
      style={{ borderTop: `1.4vmin solid ${team.color}` }}
      aria-label={team.name}
      data-board-team={side}
    >
      {/* Il nome al centro; il pallone di chi batte a sinistra, senza spostare il nome. */}
      <div className="relative px-[8.6vmin] pt-[2vmin] text-center">
        <span
          className={cn("absolute left-[3vmin] top-[2.2vmin] transition-opacity", serving ? "opacity-100" : "opacity-0")}
          data-board-serving={serving || undefined}
        >
          <Volleyball className="h-[5.4vmin] w-[5.4vmin] text-[#facc15]" aria-hidden />
          <span className="sr-only">{serving ? "Batte" : ""}</span>
        </span>
        {/* Un nome lungo va su due righe, mai tagliato a metà. */}
        <p className="line-clamp-2 break-words font-display text-[5.2vmin] font-extrabold uppercase leading-[1.1] tracking-[0.02em]">{team.name}</p>
      </div>

      <div className="relative grid min-h-0 flex-1 place-items-center">
        {timeoutLeft !== null && (
          <p
            className={cn(
              "tabular absolute top-[1vmin] rounded-full px-[2.6vmin] py-[0.8vmin] text-[4.2vmin] font-extrabold uppercase leading-none tracking-[0.06em]",
              timeoutLeft <= 10 ? "bg-[#ef4444] text-white" : "bg-[#facc15] text-black",
            )}
            data-board-timeout-alert={side}
          >
            Time-out {timeoutLeft}
          </p>
        )}
        <p
          className="tabular font-display font-extrabold leading-none text-[min(42vh,24vw)] portrait:text-[min(26vh,46vw)]"
          aria-label={finished ? `Set vinti ${team.sets}` : `Punti ${team.score}`}
          data-board-points={side}
        >
          {finished ? team.sets : team.score}
        </p>
      </div>

      <div className="flex items-end justify-between gap-[2vmin] px-[3vmin] pb-[2.4vmin]">
        {finished ? (
          <span className="text-[3.6vmin] font-bold uppercase tracking-[0.1em] text-white/60">Set vinti</span>
        ) : (
          <div className="flex items-center gap-[1.6vmin]">
            <span className="text-[3vmin] font-bold uppercase tracking-[0.1em] text-white/55">Set</span>
            <span
              className="tabular grid min-w-[9vmin] place-items-center rounded-[1.4vmin] bg-white/10 px-[1.6vmin] py-[0.4vmin] font-display text-[7.4vmin] font-extrabold leading-tight"
              data-board-sets={side}
            >
              {team.sets}
            </span>
          </div>
        )}
        {!finished && (
          <div className="flex items-center gap-[1.4vmin]" data-board-timeouts={side} data-used={timeoutsUsed}>
            <span className="text-[3vmin] font-bold uppercase tracking-[0.1em] text-white/55">Time-out</span>
            {Array.from({ length: TIMEOUTS_PER_SET }, (_, index) => (
              <span
                key={index}
                aria-hidden
                className={cn("h-[4.2vmin] w-[4.2vmin] rounded-full", index < timeoutsUsed ? "bg-[#facc15]" : "ring-[0.5vmin] ring-inset ring-white/25")}
              />
            ))}
            <span className="sr-only">
              {timeoutsUsed} su {TIMEOUTS_PER_SET}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
