"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, Maximize, Minimize, Moon, Sun, Volleyball, WifiOff } from "lucide-react";
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

const FETCH_TIMEOUT_MS = 4_000;

interface BoardState {
  loaded: boolean;
  /** Il link non è (più) quello giusto: la chiave è cambiata. */
  invalid: boolean;
  live: PublicLiveScore | null;
  timeout: BoardTimeout | null;
  /** L'ultima lettura riuscita (millisecondi). */
  okAt: number | null;
  /** Da quando le letture non riescono, se non ne è ancora riuscita nessuna (millisecondi): per dire che il sito non risponde. */
  failedAt: number | null;
}

/**
 * Una scelta che resta su questo tablet (memoria del browser); senza memoria vale finché la pagina resta aperta. Letta con
 * useSyncExternalStore: niente stato copiato in un effetto.
 */
function localChoice<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  let memory = fallback;
  const listeners = new Set<() => void>();
  return {
    read(): T {
      try {
        const stored = localStorage.getItem(key);
        if (stored !== null && (allowed as readonly string[]).includes(stored)) return stored as T;
      } catch {
        // Memoria del browser non disponibile.
      }
      return memory;
    },
    write(value: T) {
      memory = value;
      try {
        localStorage.setItem(key, value);
      } catch {
        // Non si ricorda alla prossima apertura, ma vale lo stesso.
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      window.addEventListener("storage", listener);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", listener);
      };
    },
  };
}

/** Lignano a sinistra («normale») o a destra («scambiati»). */
const sidesChoice = localChoice("vl-tabellone-lati", "normale", ["normale", "scambiati"] as const);
/** Il tema: scuro di partenza (si legge meglio da lontano), chiaro per una palestra molto luminosa. */
const themeChoice = localChoice("vl-tabellone-tema", "scuro", ["scuro", "chiaro"] as const);
type BoardTheme = ReturnType<typeof themeChoice.read>;

/**
 * I colori dei due temi, come variabili CSS: tutto il tabellone li usa, così il tema cambia con un tocco. Il giallo del pallone
 * e dei time-out nel tema chiaro diventa ambra scuro, che sul bianco si legge; le pillole del conto e dell'avviso restano uguali.
 */
const THEMES: Record<BoardTheme, CSSProperties> = {
  scuro: {
    "--b-bg": "#050f18",
    "--b-fg": "#ffffff",
    "--b-muted": "rgb(255 255 255 / 0.6)",
    "--b-faint": "rgb(255 255 255 / 0.38)",
    "--b-panel": "rgb(255 255 255 / 0.045)",
    "--b-line": "rgb(255 255 255 / 0.1)",
    "--b-chip": "rgb(255 255 255 / 0.1)",
    "--b-hover": "rgb(255 255 255 / 0.1)",
    "--b-accent": "#facc15",
    "--b-dot-off": "rgb(255 255 255 / 0.25)",
    "--b-shadow": "0 0 #0000",
  } as CSSProperties,
  chiaro: {
    "--b-bg": "#eef2f6",
    "--b-fg": "#0b1a2a",
    "--b-muted": "#475569",
    "--b-faint": "#5b6b7e",
    "--b-panel": "#ffffff",
    "--b-line": "rgb(11 26 42 / 0.12)",
    "--b-chip": "#e2e8f0",
    "--b-hover": "rgb(11 26 42 / 0.07)",
    "--b-accent": "#b45309",
    "--b-dot-off": "rgb(11 26 42 / 0.28)",
    "--b-shadow": "0 14px 34px -22px rgb(11 26 42 / 0.45)",
  } as CSSProperties,
};

const clock = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

/**
 * Il tabellone per la palestra: un tablet che fa da tabellone segnapunti quando quello della palestra non funziona. Non è sul
 * sito pubblico: si apre con il link con la chiave (lo staff lo trova nello Scout), senza accesso e senza scadenza. Rilegge il
 * punteggio dello Scout ogni secondo mentre si gioca, anche con la diretta spenta, e mostra solo squadre, punti, set vinti, chi
 * batte e time-out (con il conto dei 30 secondi). Mai una giocatrice. Tema scuro o chiaro. `?prova=1`: la partita finta.
 */
export function TabelloneClient({ chiave }: { chiave: string }) {
  const params = useSearchParams();
  const demo = params.get("prova") === "1";
  const [state, setState] = useState<BoardState>({ loaded: false, invalid: false, live: null, timeout: null, okAt: null, failedAt: null });
  const [now, setNow] = useState<number | null>(null);
  const swapped = useSyncExternalStore(sidesChoice.subscribe, sidesChoice.read, () => "normale") === "scambiati";
  const theme = useSyncExternalStore(themeChoice.subscribe, themeChoice.read, () => "scuro" as const);
  const [fullscreen, setFullscreen] = useState<{ can: boolean; on: boolean }>({ can: false, on: false });

  // L'ultima lettura (con la sua ora) e il time-out in corso, per confrontarli con la lettura nuova (vedi nextBoardTimeout).
  const previous = useRef<{ live: PublicLiveScore | null; at: number } | null>(null);
  const timeout = useRef<BoardTimeout | null>(null);
  const apply = useRef((live: PublicLiveScore | null, at: number) => {
    timeout.current = nextBoardTimeout(previous.current?.live ?? null, live, timeout.current, at, previous.current?.at ?? at);
    previous.current = { live, at };
    setState({ loaded: true, invalid: false, live, timeout: timeout.current, okAt: at, failedAt: null });
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
    const url = `/api/tabellone/${encodeURIComponent(chiave)}`;
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
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (response.status === 404) {
          // La chiave non è più quella giusta: lo si dice (il link nuovo è nello Scout) e si riprova con calma. Il sito ha risposto:
          // niente avviso di connessione, e il punteggio di prima non conta più.
          previous.current = null;
          timeout.current = null;
          if (!stopped) setState({ loaded: true, invalid: true, live: null, timeout: null, okAt: Date.now(), failedAt: null });
          delay = boardPollDelay(null, document.visibilityState === "hidden");
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { live?: PublicLiveScore | null };
        if (stopped) return;
        const live = data.live ?? null;
        apply.current(live, Date.now());
        delay = boardPollDelay(live, document.visibilityState === "hidden");
      } catch {
        // Rete assente o risposta sbagliata: resta l'ultimo punteggio (con l'avviso) e si riprova presto. Se non è mai riuscita
        // una lettura, si segna da quando: dopo qualche secondo il tabellone dice che il sito non risponde.
        if (!stopped) setState((current) => (current.okAt === null && current.failedAt === null ? { ...current, failedAt: Date.now() } : current));
      } finally {
        clearTimeout(abort);
        inFlight = null;
        if (!stopped) timer = setTimeout(read, delay);
      }
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
  }, [demo, chiave]);

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

  const { live, okAt, loaded, invalid, failedAt } = state;
  // Senza letture riuscite da un po' (o mai riuscite): l'avviso arancione in basso.
  const lastGood = okAt ?? failedAt;
  const stale = !demo && !invalid && now !== null && lastGood !== null && now - lastGood > BOARD_STALE_MS;
  const shownTimeout = state.timeout && now !== null && now < state.timeout.endsAt + BOARD_TIMEOUT_LINGER_MS ? state.timeout : null;
  const phase = !loaded ? "loading" : invalid ? "invalid" : !live ? "waiting" : live.finished ? "finished" : live.notStarted ? "pregame" : "live";
  const footerButton = "inline-flex items-center gap-[1vmin] rounded-full px-[1.6vmin] py-[1vmin] hover:bg-[var(--b-hover)] hover:text-[var(--b-fg)]";

  return (
    <main
      className="fixed inset-0 flex select-none flex-col overflow-hidden bg-[var(--b-bg)] text-[var(--b-fg)] transition-colors"
      style={{ ...THEMES[theme], colorScheme: theme === "chiaro" ? "light" : "dark" }}
      data-tabellone={phase}
      data-tabellone-theme={theme}
      data-tabellone-swapped={swapped || undefined}
    >
      {live ? (
        <>
          <header className="flex shrink-0 items-center justify-between gap-[2vmin] px-[3vmin] pt-[2.4vmin] text-[4.2vmin] font-bold uppercase leading-none tracking-[0.08em]">
            <span className="text-[var(--b-accent)]" data-board-set-label>
              {boardSetLabel(live)}
            </span>
            {live.sets.length > 0 && (
              <span className="tabular min-w-0 truncate text-[3.4vmin] font-semibold normal-case tracking-normal text-[var(--b-muted)]" data-board-partials>
                {live.sets.map((set) => `${set.home}-${set.away}`).join("  ·  ")}
              </span>
            )}
            <span className="tabular text-[var(--b-muted)]">{now !== null ? clock.format(now) : ""}</span>
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
          <Volleyball className="h-[12vmin] w-[12vmin] text-[var(--b-accent)]" aria-hidden />
          <p className="font-display text-[7vmin] font-extrabold uppercase leading-none tracking-[0.04em]">
            {!loaded ? "Collegamento…" : invalid ? "Link non più valido" : "In attesa della partita"}
          </p>
          {loaded && (
            <p className="max-w-[90vmin] text-[3.4vmin] leading-snug text-[var(--b-muted)]" data-board-message>
              {invalid
                ? "Questo link del tabellone è cambiato: riaprilo dallo Scout, scheda «Tabellone per la palestra»."
                : "Il tabellone si accende da solo appena si prepara lo Scout della partita di oggi (anche con la diretta spenta) e segue ogni punto."}
            </p>
          )}
          {now !== null && <p className="tabular font-display text-[16vmin] font-extrabold leading-none opacity-85">{clock.format(now)}</p>}
        </div>
      )}

      <footer className="flex shrink-0 items-center justify-between gap-[2vmin] px-[3vmin] pb-[2vmin] text-[2.2vmin] text-[var(--b-faint)]">
        <div className="flex items-center gap-[1vmin]">
          <button type="button" onClick={() => sidesChoice.write(swapped ? "normale" : "scambiati")} className={footerButton} data-board-swap>
            <ArrowLeftRight className="h-[2.8vmin] w-[2.8vmin]" aria-hidden />
            Scambia lati
          </button>
          <button
            type="button"
            onClick={() => themeChoice.write(theme === "scuro" ? "chiaro" : "scuro")}
            className={footerButton}
            data-board-theme-toggle
          >
            {theme === "scuro" ? <Sun className="h-[2.8vmin] w-[2.8vmin]" aria-hidden /> : <Moon className="h-[2.8vmin] w-[2.8vmin]" aria-hidden />}
            {theme === "scuro" ? "Tema chiaro" : "Tema scuro"}
          </button>
        </div>
        {stale ? (
          <span className="inline-flex items-center gap-[1vmin] rounded-full bg-[#f59e0b] px-[2vmin] py-[0.8vmin] font-bold text-black" data-board-stale>
            <WifiOff className="h-[2.8vmin] w-[2.8vmin]" aria-hidden />
            {okAt !== null ? `Senza connessione: ultimo punteggio ricevuto alle ${clock.format(okAt)}` : "Il sito non risponde: riprovo da solo"}
          </span>
        ) : (
          <span>{demo ? "Partita finta di prova" : "Risultato non ufficiale · dallo Scout"}</span>
        )}
        {fullscreen.can ? (
          <button type="button" onClick={toggleFullscreen} className={footerButton} data-board-fullscreen>
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
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[2.4vmin] bg-[var(--b-panel)]"
      style={{ borderTop: `1.4vmin solid ${team.color}`, boxShadow: "inset 0 0 0 1px var(--b-line), var(--b-shadow)" }}
      aria-label={team.name}
      data-board-team={side}
    >
      {/* Il nome al centro; il pallone di chi batte a sinistra, senza spostare il nome. */}
      <div className="relative px-[8.6vmin] pt-[2vmin] text-center">
        <span
          className={cn("absolute left-[3vmin] top-[2.2vmin] transition-opacity", serving ? "opacity-100" : "opacity-0")}
          data-board-serving={serving || undefined}
        >
          <Volleyball className="h-[5.4vmin] w-[5.4vmin] text-[var(--b-accent)]" aria-hidden />
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
              timeoutLeft <= 10 ? "bg-[#dc2626] text-white" : "bg-[#facc15] text-black",
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
          <span className="text-[3.6vmin] font-bold uppercase tracking-[0.1em] text-[var(--b-muted)]">Set vinti</span>
        ) : (
          <div className="flex items-center gap-[1.6vmin]">
            <span className="text-[3vmin] font-bold uppercase tracking-[0.1em] text-[var(--b-muted)]">Set</span>
            <span
              className="tabular grid min-w-[9vmin] place-items-center rounded-[1.4vmin] bg-[var(--b-chip)] px-[1.6vmin] py-[0.4vmin] font-display text-[7.4vmin] font-extrabold leading-tight"
              data-board-sets={side}
            >
              {team.sets}
            </span>
          </div>
        )}
        {!finished && (
          <div className="flex items-center gap-[1.4vmin]" data-board-timeouts={side} data-used={timeoutsUsed}>
            <span className="text-[3vmin] font-bold uppercase tracking-[0.1em] text-[var(--b-muted)]">Time-out</span>
            {Array.from({ length: TIMEOUTS_PER_SET }, (_, index) => (
              <span
                key={index}
                aria-hidden
                className={cn("h-[4.2vmin] w-[4.2vmin] rounded-full", index < timeoutsUsed && "bg-[var(--b-accent)]")}
                style={index < timeoutsUsed ? undefined : { boxShadow: "inset 0 0 0 0.5vmin var(--b-dot-off)" }}
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
