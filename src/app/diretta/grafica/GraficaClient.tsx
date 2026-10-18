"use client";

import { useEffect, useReducer } from "react";
import { useSearchParams } from "next/navigation";
import { Scorebug } from "@/components/diretta/Scorebug";
import { GraficaCard } from "@/components/diretta/Cards";
import { cn } from "@/lib/cn";
import { demoScript } from "@/lib/diretta/demo";
import { feedReducer, INITIAL_FEED } from "@/lib/diretta/overlayEvents";
import type { PublicLiveScore } from "@/lib/types";

const ENDPOINT = "/api/livescore/pubblico";
/** Con una partita in corso si rilegge il punteggio ogni 2 secondi (la rete di Vercel lo tiene 3: il database non se ne accorge)… */
const LIVE_POLL_MS = 2_000;
/** …altrimenti ogni 15, per accorgersi di una partita che comincia. */
const IDLE_POLL_MS = 15_000;
/** Ogni quanto avanza la partita finta (`?prova=1`). */
const DEMO_STEP_MS = 1_500;
/** Con una scheda aperta si aggiorna l'ora ogni decimo di secondo: conto alla rovescia e dissolvenza. */
const TICK_MS = 100;

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

/**
 * La grafica della diretta video: va aggiunta in OBS come «Sorgente browser» (1920×1080) sopra le camere. Sfondo trasparente,
 * barra del punteggio in un angolo e, sotto, le schede di time-out, fine set e finale. Legge lo stesso punteggio pubblico
 * del banner del sito (squadre, punti, set, battuta, time-out: mai nomi né numeri di maglia).
 *
 * Opzioni nell'indirizzo: `?prova=1` (partita finta in ciclo, per provare senza Scout), `?posizione=alto-destra|basso-sinistra|
 * basso-destra` (default alto-sinistra), `?scala=120` (percentuale).
 */
export function GraficaClient() {
  const params = useSearchParams();
  const demo = params.get("prova") === "1";
  const position = parsePosition(params.get("posizione"));
  const scale = parseScale(params.get("scala"));
  const [feed, dispatch] = useReducer(feedReducer, INITIAL_FEED);

  // Il punteggio vero: tiene l'ultimo valore se la rete cade, ignora il Minivolley.
  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function poll() {
      let delay = IDLE_POLL_MS;
      try {
        const res = await fetch(ENDPOINT);
        if (res.ok) {
          const data = (await res.json()) as { live: PublicLiveScore | null };
          const live = data.live && data.live.team === "u14u15" ? data.live : null;
          if (!cancelled) dispatch({ type: "poll", live, now: clock() });
          delay = live && !live.finished ? LIVE_POLL_MS : IDLE_POLL_MS;
        }
      } catch {
        // Rete assente: si riprova al giro successivo, la grafica resta com'è.
      }
      if (!cancelled) timer = setTimeout(poll, delay);
    }
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [demo]);

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
      <main className={cn("fixed inset-0 flex p-[4rem]", POSITIONS[position])} data-grafica={live ? "live" : "idle"} data-grafica-demo={demo ? "" : undefined}>
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
