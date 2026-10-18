"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Scorebug } from "@/components/diretta/Scorebug";
import { GraficaCard } from "@/components/diretta/Cards";
import { cn } from "@/lib/cn";
import { demoScript } from "@/lib/diretta/demo";
import { clampDelaySeconds, takeDue, type Reading } from "@/lib/diretta/delay";
import { feedReducer, INITIAL_FEED, OPTIONS_MESSAGE, READY_MESSAGE } from "@/lib/diretta/overlayEvents";
import type { PublicLiveScore } from "@/lib/types";

/** Con `prima=1` risponde anche la partita con il live acceso e ancora nessun punto (0–0): la barra c'è appena si accende il live. */
const ENDPOINT = "/api/livescore/pubblico?prima=1";
/** Con una partita in corso si rilegge il punteggio ogni 2 secondi (la rete di Vercel lo tiene 3: il database non se ne accorge)… */
const LIVE_POLL_MS = 2_000;
/** …altrimenti ogni 15, per accorgersi di una partita che comincia. */
const IDLE_POLL_MS = 15_000;
/** Ogni quanto avanza la partita finta (`?prova=1`). */
const DEMO_STEP_MS = 1_500;
/** Con una scheda aperta si aggiorna l'ora ogni decimo di secondo: conto alla rovescia e dissolvenza. */
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
 * La grafica della diretta video: si mette sopra il video, in OBS come «Sorgente browser» (1920×1080) oppure, come fa la
 * pagina /diretta dei genitori, in un riquadro trasparente sopra il lettore YouTube. Sfondo trasparente, barra del punteggio in
 * un angolo e, sotto, le schede di time-out, fine set e finale. Legge lo stesso punteggio pubblico del banner del sito
 * (squadre, punti, set, battuta, time-out: mai nomi né numeri di maglia).
 *
 * Opzioni nell'indirizzo: `?prova=1` (partita finta in ciclo, per provare senza Scout), `?posizione=alto-destra|basso-sinistra|
 * basso-destra` (default alto-sinistra), `?scala=120` (percentuale), `?ritardo=15` (secondi: il punteggio si mostra dopo tanto,
 * per allinearlo al video di YouTube, che arriva con 10–20 secondi di ritardo; la pagina /diretta lo cambia con un messaggio,
 * come la scala),
 * `?intervallo=8` (secondi tra una lettura e l'altra, e si ferma a scheda nascosta: per chi guarda dalla pagina /diretta).
 */
export function GraficaClient() {
  const params = useSearchParams();
  const demo = params.get("prova") === "1";
  const position = parsePosition(params.get("posizione"));
  const viewer = params.get("intervallo") !== null;
  const livePollMs = viewer ? parseInterval(params.get("intervallo")) : LIVE_POLL_MS;
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

  // Le letture che aspettano il loro turno (con ritardo 0 non si passa di qui).
  const queue = useRef<Reading[]>([]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (queue.current.length === 0) return;
      const { due, rest } = takeDue(queue.current, clock(), delayMs.current);
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
        const res = await fetch(ENDPOINT);
        if (res.ok) {
          const data = (await res.json()) as { live: PublicLiveScore | null };
          const live = data.live && data.live.team === "u14u15" ? data.live : null;
          if (!cancelled) {
            // La prima lettura si mostra subito (chi arriva a metà partita non aspetta); le altre aspettano il ritardo.
            if (!shown || delayMs.current === 0) {
              shown = true;
              dispatch({ type: "poll", live, now: clock() });
            } else {
              queue.current.push({ at: clock(), live });
            }
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
  }, [demo, viewer, livePollMs]);

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

  // Con una scheda aperta l'ora corre: conto alla rovescia e chiusura.
  const hasCard = feed.card !== null;
  useEffect(() => {
    if (!hasCard) return;
    const timer = setInterval(() => dispatch({ type: "tick", now: clock() }), TICK_MS);
    return () => clearInterval(timer);
  }, [hasCard]);

  const { live, card, now } = feed;
  const bottom = position.startsWith("basso");

  return (
    <>
      <style>{`html{font-size:calc(100vw / 120 * ${scale / 100}) !important}`}</style>
      <main
        className={cn("fixed inset-0 flex p-[4rem]", POSITIONS[position])}
        data-grafica={live ? "live" : "idle"}
        data-grafica-demo={demo ? "" : undefined}
        data-grafica-delay={delaySeconds}
      >
        {live && (
          <div className={cn("flex w-[40rem] gap-[0.5rem]", bottom ? "flex-col-reverse" : "flex-col")} style={{ "--card-from": bottom ? "40%" : "-40%" } as React.CSSProperties}>
            <Scorebug live={live} />
            {card && <GraficaCard card={card} live={live} now={now} />}
          </div>
        )}
      </main>
    </>
  );
}
