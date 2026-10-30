"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FullScreen } from "@/components/diretta/FullScreen";
import { LowerThird } from "@/components/diretta/LowerThird";
import { Scorebug } from "@/components/diretta/Scorebug";
import { ScorebugWide } from "@/components/diretta/ScorebugWide";
import { VerifyFrame } from "@/components/diretta/VerifyFrame";
import { cn } from "@/lib/cn";
import { DEMO_STEP_MS, demoScript } from "@/lib/diretta/demo";
import { clampDelaySeconds, nextOffset, stampOf, takeDue, type Reading } from "@/lib/diretta/delay";
import { feedReducer, INITIAL_FEED, OPTIONS_MESSAGE, READY_MESSAGE } from "@/lib/diretta/overlayEvents";
import type { PublicLiveScore } from "@/lib/types";

/** Con `prima=1` risponde anche la partita con il live acceso e ancora nessun punto (0–0): la barra c'è appena si accende il live. */
const ENDPOINT = "/api/livescore/pubblico?prima=1";
/**
 * In Streamlabs / OBS (un computer solo) si legge senza la copia della CDN (`regia=1`) e ogni secondo: il punto entra nel video
 * circa un secondo dopo il tocco nello Scout, invece che fino a 8. Chi guarda dalla pagina /diretta passa dalla CDN (sono tanti).
 */
const DIRECT_ENDPOINT = `${ENDPOINT}&regia=1`;
const DIRECT_POLL_MS = 1_000;
/** Chi guarda dalla pagina /diretta rilegge di partenza ogni 2 secondi (la rete di Vercel lo tiene 3: il database non se ne accorge)… */
const LIVE_POLL_MS = 2_000;
/** …altrimenti ogni 15, per accorgersi di una partita che comincia. */
const IDLE_POLL_MS = 15_000;
/** Con una grafica in onda (o in coda) si aggiorna l'ora ogni decimo di secondo: conto alla rovescia, transizioni, coda. */
const TICK_MS = 100;
/** Ogni quanto si guarda la coda del ritardo. */
const QUEUE_MS = 250;

const clock = () => Date.now();

const POSITIONS = {
  "alto-sinistra": "items-start justify-start",
  "alto-destra": "items-start justify-end",
  "basso-sinistra": "items-end justify-start",
  "basso-destra": "items-end justify-end",
} as const;
type Position = keyof typeof POSITIONS;

const parsePosition = (value: string | null): Position => (value && value in POSITIONS ? (value as Position) : "alto-sinistra");

/**
 * Quali barre mostrare: di partenza la barra in alto a sinistra, come in SuperLega; oppure la larga in basso al centro, o tutte
 * e due (come prima: le stesse informazioni due volte).
 */
type BarStyle = "piccola" | "larga" | "entrambe";
const parseStyle = (value: string | null): BarStyle => (value === "larga" || value === "entrambe" ? value : "piccola");
/** La scala in percentuale (50–200), 100 se manca o non è un numero. */
const parseScale = (value: string | null): number => {
  const scale = Number(value);
  return Number.isFinite(scale) && scale >= 50 && scale <= 200 ? scale : 100;
};
/** Ogni quanti secondi rileggere il punteggio per chi guarda dalla pagina /diretta (2–60). */
const parseInterval = (value: string | null): number => {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.min(Math.max(seconds, 2), 60) * 1000 : LIVE_POLL_MS;
};

/**
 * La grafica della diretta video, come una regia di Serie A: si mette sopra il video, in OBS / Streamlabs come «Sorgente
 * browser» (1920×1080) oppure, come fa la pagina /diretta dei genitori, in un riquadro trasparente sopra il lettore YouTube.
 * Sfondo trasparente; legge lo stesso punteggio pubblico del banner del sito e da solo, senza nessuno in regia, manda in onda:
 * - la barra del punteggio in alto a sinistra, con SET POINT / MATCH POINT e la serie di punti in corso;
 * - in basso a sinistra i sottopancia: time-out (conto alla rovescia e punti del set) e cambi della nostra squadra;
 * - a schermo intero, con la transizione: presentazione e formazione prima del via, fine set, risultato finale.
 *
 * Opzioni nell'indirizzo: `?stile=larga|entrambe` (la barra larga in basso al centro, da sola o insieme a quella in alto),
 * `?prova=1` (partita finta in ciclo, per provare senza Scout), `?verifica=1` (la partita finta con la verifica delle misure
 * della sorgente: angoli, area sicura e cosa correggere), `?posizione=alto-destra|basso-sinistra|basso-destra` (default
 * alto-sinistra, vale per la barra), `?scala=120` (percentuale), `?ritardo=15` (secondi: ogni punto si mostra tanto dopo
 * essere stato segnato, per allinearlo al video di YouTube, che arriva con 10–20 secondi di ritardo; la pagina /diretta lo
 * cambia con un messaggio, come la scala), `?intervallo=8` (secondi tra una lettura e l'altra, e si ferma a scheda nascosta:
 * per chi guarda dalla pagina /diretta). Senza `intervallo` è la grafica di Streamlabs / OBS: legge ogni secondo, senza la
 * copia della CDN, così il punto entra nel video subito dopo il tocco nello Scout.
 */
export function GraficaClient() {
  const params = useSearchParams();
  const verify = params.get("verifica") === "1";
  const demo = verify || params.get("prova") === "1";
  const position = parsePosition(params.get("posizione"));
  const style = parseStyle(params.get("stile"));
  const viewer = params.get("intervallo") !== null;
  const livePollMs = viewer ? parseInterval(params.get("intervallo")) : DIRECT_POLL_MS;
  const endpoint = viewer ? ENDPOINT : DIRECT_ENDPOINT;
  const [feed, dispatch] = useReducer(feedReducer, INITIAL_FEED);

  // Ritardo e scala del punteggio: dall'indirizzo, poi dai messaggi della pagina /diretta.
  const [delaySeconds, setDelaySeconds] = useState(() => clampDelaySeconds(params.get("ritardo")));
  const [scale, setScale] = useState(() => parseScale(params.get("scala")));
  const delayMs = useRef(delaySeconds * 1000);
  useEffect(() => {
    delayMs.current = delaySeconds * 1000;
  }, [delaySeconds]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; ritardo?: unknown; scala?: unknown } | null;
      if (data?.type !== OPTIONS_MESSAGE) return;
      if (data.ritardo !== undefined) setDelaySeconds(clampDelaySeconds(data.ritardo));
      if (data.scala !== undefined) setScale(parseScale(String(data.scala)));
    };
    window.addEventListener("message", onMessage);
    // Dentro il riquadro della pagina /diretta: avvisa che ora ascolta (prima, i messaggi andrebbero persi).
    if (window.parent !== window) window.parent.postMessage({ type: READY_MESSAGE }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Le letture che aspettano il loro turno (con ritardo 0 non si passa di qui), e lo scarto tra il nostro orologio e quello del
  // server: il ritardo si conta dall'istante del punto (vedi delay.ts).
  const queue = useRef<Reading[]>([]);
  const offset = useRef<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      if (queue.current.length === 0) return;
      const { due, rest } = takeDue(queue.current, clock(), delayMs.current, offset.current);
      queue.current = rest;
      for (const reading of due) dispatch({ type: "poll", live: reading.live, now: clock() });
    }, QUEUE_MS);
    return () => clearInterval(timer);
  }, []);

  // Il punteggio vero: tiene l'ultimo valore se la rete cade, ignora il Minivolley.
  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    let inFlight = false;
    let shown = false;
    let lastStamp: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function poll() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (inFlight) return;
      // Chi guarda dalla pagina /diretta non rilegge a scheda nascosta: si riprende quando torna visibile.
      if (viewer && document.visibilityState === "hidden") return;
      inFlight = true;
      let delay = IDLE_POLL_MS;
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = (await res.json()) as { live: PublicLiveScore | null };
          const live = data.live && data.live.team === "u14u15" ? data.live : null;
          if (!cancelled) {
            const reading: Reading = { at: clock(), stamp: stampOf(live), live };
            offset.current = nextOffset(offset.current, reading);
            // La prima lettura si mostra subito (chi arriva a metà partita non aspetta); le altre aspettano il ritardo, dopo
            // quelle già in coda (una lettura nuova non passa mai davanti a una vecchia). La stessa lettura riletta non si accoda.
            if (!shown || (delayMs.current === 0 && queue.current.length === 0)) {
              shown = true;
              dispatch({ type: "poll", live, now: clock() });
            } else if (reading.stamp === null || reading.stamp !== lastStamp) {
              queue.current.push(reading);
            }
            lastStamp = reading.stamp;
          }
          delay = live && !live.finished ? livePollMs : IDLE_POLL_MS;
        }
      } catch {
        // Rete assente: si riprova al giro successivo, la grafica resta com'è.
      } finally {
        inFlight = false;
      }
      if (!cancelled) timer = setTimeout(poll, delay);
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    void poll();
    if (viewer) document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (viewer) document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [demo, viewer, livePollMs, endpoint]);

  // La partita finta: un passo ogni tanto, in ciclo.
  useEffect(() => {
    if (!demo) return;
    const script = demoScript();
    let index = 0;
    const step = () => {
      dispatch({ type: "poll", live: script[index], now: clock() });
      index = (index + 1) % script.length;
    };
    step();
    const timer = setInterval(step, DEMO_STEP_MS);
    return () => clearInterval(timer);
  }, [demo]);

  // Con una grafica in onda o in coda l'ora corre: conto alla rovescia, transizioni, la prossima della coda.
  const busy = feed.full !== null || feed.timeout !== null || feed.sub !== null || feed.fullQueue.length > 0 || feed.subQueue.length > 0;
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => dispatch({ type: "tick", now: clock() }), TICK_MS);
    return () => clearInterval(timer);
  }, [busy]);

  const { live, full, timeout, sub, now } = feed;
  const showSmall = style !== "larga";
  const showWide = style !== "piccola";
  // A schermo intero la barra si nasconde (la transizione la copre), e torna quando la grafica se ne va.
  const fullOn = full !== null;
  // I sottopancia in basso a sinistra; a destra se in basso a sinistra c'è la barra, più in alto se c'è la barra larga.
  const stripRight = showSmall && position === "basso-sinistra";

  return (
    <>
      <style>{`html{font-size:calc(100vw / 120 * ${scale / 100}) !important;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}`}</style>
      <main
        className="fixed inset-0 overflow-hidden"
        data-grafica={live ? "live" : "idle"}
        data-grafica-demo={demo ? "" : undefined}
        data-grafica-delay={delaySeconds}
        data-grafica-style={style}
      >
        {live && showSmall && (
          <div className={cn("absolute inset-0 flex px-[4rem] py-[3.4rem] transition-opacity duration-300", POSITIONS[position], fullOn && "opacity-0")}>
            <Scorebug live={live} />
          </div>
        )}
        {live && showWide && (
          <div className={cn("absolute inset-x-0 bottom-[2.5rem] flex justify-center px-[2rem] transition-opacity duration-300", fullOn && "opacity-0")}>
            <ScorebugWide live={live} />
          </div>
        )}
        {live && (timeout || sub) && !fullOn && (
          <div className={cn("absolute flex flex-col gap-[0.8rem]", stripRight ? "right-[4rem] items-end" : "left-[4rem] items-start", showWide ? "bottom-[12.5rem]" : "bottom-[3.6rem]")}>
            {sub && <LowerThird card={sub} live={live} now={now} />}
            {timeout && <LowerThird card={timeout} live={live} now={now} />}
          </div>
        )}
        {live && full && <FullScreen card={full} live={live} now={now} />}
        {verify && <VerifyFrame />}
      </main>
    </>
  );
}
