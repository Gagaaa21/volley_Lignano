"use client";

import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { CueBurst } from "@/components/diretta/CueBurst";
import { SILENCE_OUT_MS, SilenceCard } from "@/components/diretta/SilenceCard";
import { FullScreen } from "@/components/diretta/FullScreen";
import { LowerThird } from "@/components/diretta/LowerThird";
import { PregameBanner } from "@/components/diretta/PregameBanner";
import { Scorebug } from "@/components/diretta/Scorebug";
import { ScorebugWide } from "@/components/diretta/ScorebugWide";
import { VerifyFrame } from "@/components/diretta/VerifyFrame";
import { cn } from "@/lib/cn";
import { DEMO_STEP_MS, demoScript } from "@/lib/diretta/demo";
import { CUE_DURATION_MS, CUE_KINDS, type CueKind, type PublicCue, type PublicSilence } from "@/lib/diretta/cues";
import { clampDelaySeconds, nextOffset, stampOf, takeDue, type Reading } from "@/lib/diretta/delay";
import { playCue, preloadCue, stopCueSound } from "@/lib/diretta/jingles";
import { CUE_CHANNEL, CUE_EVENT, realtimeSocketUrl, RING_MIN_GAP_MS, type RealtimeConfig } from "@/lib/diretta/realtime";
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
/**
 * Prima del via (copertina, riscaldamento, presentazione: possono durare un'ora) basta rileggere ogni 3 secondi: le fasi le
 * decide l'orario e il tasto del riscaldamento non ha fretta. Su Vercel ogni lettura è una chiamata al server, e il piano
 * gratuito ne ha un tetto di CPU al mese: così un'ora di attesa costa un terzo. Dal minuto prima del via (barra a 0–0) e in
 * partita si torna a ogni secondo.
 */
const PREGAME_POLL_MS = 3_000;
/** Chi guarda dalla pagina /diretta rilegge di partenza ogni 2 secondi (la rete di Vercel lo tiene 3: il database non se ne accorge)… */
const LIVE_POLL_MS = 2_000;
/** …altrimenti ogni 15, per accorgersi di una partita che comincia. */
const IDLE_POLL_MS = 15_000;
/**
 * In Streamlabs / OBS senza il campanello in tempo reale della pulsantiera (canale non collegato) si rilegge senza partita ogni
 * 5 secondi invece che ogni 15: una scritta arriva comunque presto e non diventa mai troppo vecchia per partire.
 */
const NO_RING_IDLE_POLL_MS = 5_000;
/** Lettura della sola scritta, quando suona il campanello: se non risponde in fretta si lascia perdere (c'è la lettura normale). */
const CUE_FETCH_TIMEOUT_MS = 3_000;
/** Una scritta letta per il campanello appena aperta la grafica parte solo se è di pochi secondi fa (non quella di prima). */
const RING_FRESH_MS = 5_000;
/** Con una grafica in onda (o in coda) si aggiorna l'ora ogni decimo di secondo: conto alla rovescia, transizioni, coda. */
const TICK_MS = 100;
/**
 * Con una connessione debole (l'hotspot del telefono in palestra) una lettura può non arrivare mai: dopo questo tempo si lascia
 * perdere e se ne fa un'altra, invece di restare appesi con il punteggio fermo nel video.
 */
const FETCH_TIMEOUT_MS = 4_000;
/** Una lettura andata male (rete caduta un attimo, server lento) si ripete presto: il punteggio non resta indietro a lungo. */
const RETRY_MS = 1_500;
/** Ogni quanto si guarda la coda del ritardo. */
const QUEUE_MS = 250;
/** Nella partita finta, ogni quanto parte una scritta della pulsantiera (una dopo l'altra, tutte). */
const DEMO_CUE_MS = 12_000;

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
 *
 * Le scritte della pulsantiera («MONSTER BLOCK», «ACE»…, vedi src/lib/diretta/cues.ts) arrivano con la stessa lettura: al
 * centro, con il loro jingle. Il suono solo nella grafica di Streamlabs / OBS (entra nella diretta); chi guarda dalla pagina
 * /diretta vede la scritta, in silenzio, quando il video arriva a quel punto (il ritardo).
 */
/** Niente da ascoltare: dove gira la pagina non cambia mentre è aperta. */
const subscribeNothing = () => () => {};

/** Il riquadro 16:9 più grande che entra nella finestra (in un browser normale, vedi `preview`). */
const STAGE_WIDTH = "min(100vw, 177.778vh)";
const STAGE_HEIGHT = "min(56.25vw, 100vh)";
/** Lo sfondo dell'anteprima con la partita finta: un palazzetto in penombra, così le grafiche si vedono come in TV. */
const PREVIEW_BACKDROP = "radial-gradient(ellipse at 50% 28%, #41588a 0%, #1d2747 52%, #0a0f1f 100%)";

export function GraficaClient({ realtime = null }: { realtime?: RealtimeConfig | null }) {
  const params = useSearchParams();
  const verify = params.get("verifica") === "1";
  const demo = verify || params.get("prova") === "1";
  const position = parsePosition(params.get("posizione"));
  const style = parseStyle(params.get("stile"));
  const viewer = params.get("intervallo") !== null;
  const livePollMs = viewer ? parseInterval(params.get("intervallo")) : DIRECT_POLL_MS;
  const endpoint = viewer ? ENDPOINT : DIRECT_ENDPOINT;
  // Anteprima: la pagina aperta in un browser normale (telefono, tablet, computer), non in Streamlabs / OBS (che aggiungono
  // `window.obsstudio`) né sopra il video della pagina /diretta. Lì la grafica sta tutta intera in un riquadro 16:9 al centro,
  // come una TV: sul telefono in verticale è piccola ma intera (e si invita a girarlo), in orizzontale riempie lo schermo.
  const preview = useSyncExternalStore(subscribeNothing, () => !viewer && !("obsstudio" in window), () => false);
  const [feed, dispatch] = useReducer(feedReducer, INITIAL_FEED);
  // Il minuto di silenzio (vedi LIVE_SILENCE_KEY in cues.ts): la sua scritta in basso e nient'altro. `leaving` durante la
  // dissolvenza in uscita.
  const [silence, setSilence] = useState<{ id: string; text: string | null; leaving: boolean } | null>(null);
  const silenceOn = useRef(false);
  // L'ultimo stato letto (l'id del minuto di silenzio acceso, o null): la grafica cambia solo quando cambia.
  const silenceWanted = useRef<string | null>(null);
  // La scritta della pulsantiera in onda (una alla volta: una nuova prende il posto della vecchia).
  const [cue, setCue] = useState<{ id: string; kind: CueKind } | null>(null);
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showCue = useRef((id: string, kind: CueKind, sound: number | null) => {
    // Durante il minuto di silenzio niente scritte né suoni.
    if (silenceOn.current) return;
    if (cueTimer.current) clearTimeout(cueTimer.current);
    setCue({ id, kind });
    cueTimer.current = setTimeout(() => setCue((current) => (current?.id === id ? null : current)), CUE_DURATION_MS);
    // Il suono entra nella diretta solo dalla grafica di Streamlabs / OBS: chi guarda da /diretta ha già l'audio del video.
    if (viewer) return;
    playCue(kind, sound);
  });

  // L'ultima scritta già vista (undefined = nessuna lettura ancora): quella presente alla prima lettura non riparte (era di prima).
  const lastCue = useRef<string | null | undefined>(undefined);
  // Il campanello in tempo reale della pulsantiera è collegato (vedi src/lib/diretta/realtime.ts).
  const ringOn = useRef(false);
  /** Una scritta letta (dal punteggio o, con `fromRing`, dal campanello): parte se è nuova; con il ritardo, quando arriva il video. */
  const takeCue = useRef((fresh: PublicCue | null, fromRing: boolean) => {
    if (!fresh) {
      if (lastCue.current === undefined) lastCue.current = null;
      return;
    }
    if (fresh.id === lastCue.current) return;
    const first = lastCue.current === undefined;
    lastCue.current = fresh.id;
    // Alla prima lettura la scritta che c'era già non riparte; col campanello invece è appena stata mandata.
    if (first && !(fromRing && fresh.age < RING_FRESH_MS)) return;
    // Con il ritardo (pagina /diretta) la scritta aspetta che il video arrivi a quel momento.
    const wait = viewer ? Math.max(0, delayMs.current - fresh.age) : 0;
    setTimeout(() => showCue.current(fresh.id, fresh.kind, fresh.sound), wait);
  });
  /**
   * Il minuto di silenzio letto (dal punteggio o dal campanello): si accende e si spegne quando cambia; con il ritardo (pagina
   * /diretta) quando il video arriva a quel momento. Accendendolo si ferma il suono in corso e si toglie la scritta.
   */
  const takeSilence = useRef((fresh: PublicSilence | null) => {
    const id = fresh?.id ?? null;
    if (id === silenceWanted.current) return;
    silenceWanted.current = id;
    const wait = viewer ? (fresh ? Math.max(0, delayMs.current - fresh.since) : delayMs.current) : 0;
    setTimeout(() => {
      if (silenceWanted.current !== id) return;
      if (fresh) {
        silenceOn.current = true;
        stopCueSound();
        setCue(null);
        setSilence({ id: fresh.id, text: fresh.text, leaving: false });
      } else {
        silenceOn.current = false;
        setSilence((current) => (current ? { ...current, leaving: true } : null));
        setTimeout(() => setSilence((current) => (current?.leaving ? null : current)), SILENCE_OUT_MS);
      }
    }, wait);
  });

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
    // Il ritmo dell'ultima lettura riuscita: dopo una lettura andata male si riprova presto, mai più tardi di così.
    let cadence = IDLE_POLL_MS;
    async function poll() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (inFlight) return;
      // Chi guarda dalla pagina /diretta non rilegge a scheda nascosta: si riprende quando torna visibile.
      if (viewer && document.visibilityState === "hidden") return;
      inFlight = true;
      // Se non va a buon fine (rete assente, risposta di errore, nessuna risposta entro FETCH_TIMEOUT_MS) si riprova presto.
      let delay = Math.min(cadence, RETRY_MS);
      const controller = new AbortController();
      const abort = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(endpoint, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as {
            live: PublicLiveScore | null;
            cue?: PublicCue | null;
            cueSounds?: Partial<Record<CueKind, number>>;
            silence?: PublicSilence | null;
          };
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
            // I suoni dei tasti (quelli caricati dallo staff o gli originali) si preparano subito, così al tocco partono senza
            // attesa; solo dove si sentono. Si scaricano una volta: dopo restano in memoria e nella cache.
            if (!viewer) for (const kind of CUE_KINDS) preloadCue(kind, data.cueSounds?.[kind] ?? null);
            takeSilence.current(data.silence ?? null);
            takeCue.current(data.cue ?? null, false);
          }
          const idle = !viewer && !ringOn.current ? NO_RING_IDLE_POLL_MS : IDLE_POLL_MS;
          delay = !live || live.finished ? idle : !viewer && live.notStarted && live.pregame ? PREGAME_POLL_MS : livePollMs;
          cadence = delay;
        }
      } catch {
        // Rete assente o lettura abbandonata: la grafica resta com'è e si riprova tra poco.
      } finally {
        clearTimeout(abort);
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

  // Il campanello della pulsantiera (solo in Streamlabs / OBS, solo con Supabase): appena suona si rilegge la scritta, così va in
  // onda subito invece di aspettare la lettura successiva. Il messaggio non si usa: la scritta vera la dice il sito.
  useEffect(() => {
    if (!realtime || viewer || demo) return;
    let cancelled = false;
    let inFlight = false;
    let again = false;
    let lastRing = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;
    let close: (() => void) | null = null;
    async function readCue() {
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      const controller = new AbortController();
      const abort = setTimeout(() => controller.abort(), CUE_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch("/api/diretta/scritta", { signal: controller.signal, cache: "no-store" });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { cue: PublicCue | null; cueSounds?: Partial<Record<CueKind, number>>; silence?: PublicSilence | null };
          for (const kind of CUE_KINDS) preloadCue(kind, data.cueSounds?.[kind] ?? null);
          takeSilence.current(data.silence ?? null);
          takeCue.current(data.cue ?? null, true);
        }
      } catch {
        // Lettura persa: la scritta arriva con la lettura normale del punteggio.
      } finally {
        clearTimeout(abort);
        inFlight = false;
      }
      if (again && !cancelled) {
        again = false;
        void readCue();
      }
    }
    const ring = () => {
      const now = clock();
      // Campanelli troppo vicini (o uno scherzo ripetuto) fanno una lettura sola.
      if (now - lastRing < RING_MIN_GAP_MS) {
        if (!trailing) trailing = setTimeout(() => {
          trailing = null;
          lastRing = clock();
          void readCue();
        }, RING_MIN_GAP_MS - (now - lastRing));
        return;
      }
      lastRing = now;
      void readCue();
    };
    void import("@supabase/realtime-js")
      .then(({ RealtimeClient }) => {
        if (cancelled) return;
        const client = new RealtimeClient(realtimeSocketUrl(realtime.url), { params: { apikey: realtime.key } });
        const channel = client.channel(CUE_CHANNEL);
        channel.on("broadcast", { event: CUE_EVENT }, ring);
        channel.subscribe((status) => {
          const was = ringOn.current;
          ringOn.current = status === "SUBSCRIBED";
          // Appena collegato (anche dopo una caduta) si rilegge: una scritta mandata nel frattempo non si perde.
          if (ringOn.current && !was) ring();
        });
        close = () => {
          void channel.unsubscribe();
          client.disconnect();
        };
      })
      .catch(() => {
        // Senza il canale la grafica legge come prima (più spesso, vedi NO_RING_IDLE_POLL_MS).
      });
    return () => {
      cancelled = true;
      ringOn.current = false;
      if (trailing) clearTimeout(trailing);
      close?.();
    };
  }, [realtime, viewer, demo]);

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
    // E ogni tanto una scritta della pulsantiera, tutte a giro (con il jingle: serve a provare l'audio in Streamlabs).
    let cueIndex = 0;
    const cues = setInterval(() => {
      const kind = CUE_KINDS[cueIndex % CUE_KINDS.length];
      showCue.current(`prova-${cueIndex}`, kind, null);
      cueIndex += 1;
    }, DEMO_CUE_MS);
    return () => {
      clearInterval(timer);
      clearInterval(cues);
    };
  }, [demo]);

  // Con una grafica in onda o in coda l'ora corre: conto alla rovescia, transizioni, la prossima della coda.
  const busy =
    feed.full !== null || feed.timeout !== null || feed.sub !== null || feed.moment !== null || feed.fullQueue.length > 0 || feed.subQueue.length > 0;
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => dispatch({ type: "tick", now: clock() }), TICK_MS);
    return () => clearInterval(timer);
  }, [busy]);

  const { live, full, timeout, sub, moment, now } = feed;
  const showSmall = style !== "larga";
  const showWide = style !== "piccola";
  // A schermo intero la barra si nasconde (la transizione la copre), e torna quando la grafica se ne va.
  const fullOn = full !== null;
  // I sottopancia in basso a sinistra; a destra se in basso a sinistra c'è la barra, più in alto se c'è la barra larga.
  const stripRight = showSmall && position === "basso-sinistra";
  // Prima del fischio d'inizio (copertina, riscaldamento, presentazione: vedi pregame.ts) niente punteggio: solo il banner in alto,
  // quando non c'è una grafica a schermo intero. Da 1 minuto prima (o dal primo punto) barra e punteggio.
  const pregame = live?.pregame ?? null;
  const scoreOn = !pregame;
  const banner = pregame && pregame !== "cover" && !fullOn ? pregame : null;
  // Il minuto di silenzio: quello vero, o nella partita finta con `?silenzio=1` (e `&dedica=…`) per vederlo prima.
  const demoSilence = demo && params.get("silenzio") === "1" ? { id: "prova", text: params.get("dedica")?.slice(0, 80) || null, leaving: false } : null;
  const silenceShown = silence ?? demoSilence;
  // Intanto tutto il resto sparisce piano: la telecamera fa vedere le squadre in campo.
  const quiet = silenceShown !== null && !silenceShown.leaving;

  return (
    <>
      <style>{`html{font-size:calc(${preview ? STAGE_WIDTH : "100vw"} / 120 * ${scale / 100}) !important;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}`}</style>
      {preview && demo && <style>{"html,body{background:#05070f!important}"}</style>}
      <main
        className={cn("fixed overflow-hidden", !preview && "inset-0")}
        // Il riquadro centrato con i margini (non con translate: vedi le altre grafiche); con la partita finta, lo sfondo.
        style={
          preview
            ? {
                left: "50%",
                top: "50%",
                width: STAGE_WIDTH,
                height: STAGE_HEIGHT,
                marginLeft: `calc(${STAGE_WIDTH} / -2)`,
                marginTop: `calc(${STAGE_HEIGHT} / -2)`,
                background: demo ? PREVIEW_BACKDROP : undefined,
              }
            : undefined
        }
        data-grafica-preview={preview ? "" : undefined}
        data-grafica={live ? "live" : "idle"}
        data-grafica-demo={demo ? "" : undefined}
        data-grafica-delay={delaySeconds}
        data-grafica-style={style}
      >
        <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: quiet ? 0 : 1 }} data-grafica-quiet={quiet ? "" : undefined}>
          {live && banner && (
            <div className="absolute inset-x-0 top-[3.4rem] flex justify-center px-[2rem]">
              <PregameBanner live={live} phase={banner} />
            </div>
          )}
          {live && scoreOn && showSmall && (
            <div className={cn("absolute inset-0 flex px-[4rem] py-[3.4rem] transition-opacity duration-300", POSITIONS[position], fullOn && "opacity-0")}>
              <Scorebug live={live} />
            </div>
          )}
          {live && scoreOn && showWide && (
            <div className={cn("absolute inset-x-0 bottom-[2.5rem] flex justify-center px-[2rem] transition-opacity duration-300", fullOn && "opacity-0")}>
              <ScorebugWide live={live} />
            </div>
          )}
          {live && scoreOn && (timeout || sub || moment) && !fullOn && (
            <div className={cn("absolute flex flex-col gap-[0.8rem]", stripRight ? "right-[4rem] items-end" : "left-[4rem] items-start", showWide ? "bottom-[12.5rem]" : "bottom-[3.6rem]")}>
              {sub && <LowerThird card={sub} live={live} now={now} />}
              {moment && <LowerThird card={moment} live={live} now={now} />}
              {timeout && <LowerThird card={timeout} live={live} now={now} />}
            </div>
          )}
          {live && full && <FullScreen card={full} live={live} now={now} />}
          {/* La scritta anche sopra una grafica a schermo intero: il suono parte comunque, e scritta e grido vanno insieme. */}
          {cue && <CueBurst key={cue.id} kind={cue.kind} />}
        </div>
        {silenceShown && <SilenceCard key={silenceShown.id} text={silenceShown.text} leaving={silenceShown.leaving} />}
      </main>
      {verify && <VerifyFrame />}
      {preview && (
        // Sul telefono in verticale la TV è stretta: un invito a girarlo (misure in px, non legate alla grafica).
        <p
          className="pointer-events-none fixed inset-x-0 top-[12px] hidden justify-center px-[16px] portrait:flex"
          data-grafica-rotate
        >
          <span className="rounded-full bg-black/70 px-[14px] py-[6px] text-[13px] font-semibold text-white">
            Gira il telefono in orizzontale per vederla più grande
          </span>
        </p>
      )}
    </>
  );
}
