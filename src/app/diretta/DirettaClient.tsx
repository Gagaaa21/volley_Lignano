"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Minus, Plus, Radio } from "lucide-react";
import { cn } from "@/lib/cn";
import { clampDelaySeconds } from "@/lib/diretta/delay";
import { OPTIONS_MESSAGE, READY_MESSAGE } from "@/lib/diretta/overlayEvents";
import { DEFAULT_DELAY_SECONDS, embedUrl, type Camera } from "@/lib/diretta/streams";

const ENDPOINT = "/api/diretta";
/** Con la diretta in corso si rilegge l'elenco delle camere ogni minuto, senza: ogni 20 secondi, per vederla partire. */
const LIVE_REFRESH_MS = 60_000;
const IDLE_REFRESH_MS = 20_000;
const CAMERA_KEY = "vl-diretta-camera";
const DELAY_KEY = "vl-diretta-ritardo";
/** Ogni quanti secondi la grafica rilegge il punteggio (la rete di Vercel lo tiene 3: il database non se ne accorge). */
const SCORE_POLL_SECONDS = 8;

interface Config {
  cameras: Camera[];
  delaySeconds: number;
  /** La grafica è già dentro il video (Streamlabs / OBS): qui solo il video, senza punteggio sopra né ritardo da regolare. */
  graphicInVideo?: boolean;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Memoria del telefono non disponibile: la scelta vale solo per questa visita.
  }
}

/** Quanto ingrandire la barra del punteggio: su un telefono in verticale il video è stretto e la barra, in proporzione, minuscola. */
export function scaleForWidth(width: number): number {
  return width >= 900 ? 100 : width >= 600 ? 140 : 180;
}

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

/**
 * Il video di una camera con il punteggio sopra: due riquadri uno sull'altro, quello del punteggio trasparente e senza tocchi.
 * Con la grafica già nel video (`overlay` spento) solo il video: il punteggio sopra sarebbe doppio.
 */
function Stage({ camera, delaySeconds, overlay }: { camera: Camera; delaySeconds: number; overlay: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLIFrameElement>(null);
  const scaleRef = useRef(100);
  // L'indirizzo della grafica si fissa alla prima volta: il resto (ritardo, scala) lo si cambia con i messaggi, senza ricaricarla.
  const [overlaySrc] = useState(() => `/diretta/grafica?ritardo=${delaySeconds}&intervallo=${SCORE_POLL_SECONDS}`);
  const [fullscreen, setFullscreen] = useState(false);
  const [pageFull, setPageFull] = useState(false);

  const sendOptions = useCallback((options: { ritardo?: number; scala?: number }) => {
    overlayRef.current?.contentWindow?.postMessage({ type: OPTIONS_MESSAGE, ...options }, window.location.origin);
  }, []);
  const sendAll = useCallback(() => sendOptions({ ritardo: delaySeconds, scala: scaleRef.current }), [sendOptions, delaySeconds]);

  useEffect(() => {
    sendOptions({ ritardo: delaySeconds });
  }, [delaySeconds, sendOptions]);

  // Quando la grafica dice di essere pronta (un messaggio mandato prima andrebbe perso) le si dà ritardo e scala di adesso.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== overlayRef.current?.contentWindow) return;
      if ((event.data as { type?: string } | null)?.type === READY_MESSAGE) sendAll();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sendAll]);

  // La barra si ingrandisce sui riquadri stretti (telefono in verticale) e torna normale su quelli larghi.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      const scala = scaleForWidth(entry.contentRect.width);
      if (scala === scaleRef.current) return;
      scaleRef.current = scala;
      sendOptions({ scala });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [sendOptions]);

  useEffect(() => {
    const onChange = () => {
      const doc = document as FullscreenDocument;
      setFullscreen((doc.fullscreenElement ?? doc.webkitFullscreenElement) === stageRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // Il riquadro a tutta pagina (iPhone, dove lo schermo intero vero c'è solo per il video) non fa scorrere la pagina sotto.
  useEffect(() => {
    if (!pageFull) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [pageFull]);

  async function toggleFullscreen() {
    const stage = stageRef.current as FullscreenElement | null;
    const doc = document as FullscreenDocument;
    if (!stage) return;
    if (pageFull) return setPageFull(false);
    if (fullscreen) {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    // Schermo intero del riquadro intero (video + punteggio): quello di YouTube lascerebbe fuori il punteggio.
    const request = stage.requestFullscreen?.bind(stage) ?? stage.webkitRequestFullscreen?.bind(stage);
    if (request) {
      try {
        await request();
        return;
      } catch {
        // Non concesso: si ripiega sul riquadro a tutta pagina.
      }
    }
    setPageFull(true);
  }

  const full = fullscreen || pageFull;
  return (
    <div
      ref={stageRef}
      className={cn(full ? "fixed inset-0 z-50 flex items-center justify-center bg-black" : "relative")}
      data-diretta-stage
      data-diretta-full={full ? "" : undefined}
    >
      <div
        ref={frameRef}
        className={cn("relative w-full overflow-hidden bg-black", !full && "aspect-video rounded-2xl shadow-card")}
        style={full ? { aspectRatio: "16 / 9", maxWidth: "calc(100vh * 16 / 9)" } : undefined}
      >
        <iframe
          key={camera.id}
          src={embedUrl(camera.id)}
          title={`Diretta: ${camera.name}`}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          data-diretta-player={camera.id}
        />
        {overlay && (
          <iframe
            ref={overlayRef}
            src={overlaySrc}
            title="Punteggio della partita"
            aria-hidden
            tabIndex={-1}
            onLoad={sendAll}
            className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-transparent"
            style={{ colorScheme: "light" }}
            data-diretta-overlay
          />
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={full ? "Esci dallo schermo intero" : "Schermo intero"}
          title={full ? "Esci dallo schermo intero" : "Schermo intero"}
          className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-lg bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
          data-diretta-fullscreen
        >
          {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/**
 * La pagina dei genitori: il video della diretta (YouTube, nessun peso per il sito) con il punteggio dello Scout sopra e, se
 * le camere sono più d'una, i pulsanti per scegliere quale guardare. YouTube mostra il video con 10–20 secondi di ritardo, il
 * punteggio arriverebbe prima: la grafica lo ritarda (di partenza quanto ha scelto lo staff) e ognuno lo può regolare da solo.
 * Se lo staff manda in onda la grafica da Streamlabs / OBS (`graphicInVideo`) il punteggio è già nel video, sempre allineato:
 * qui resta solo il video.
 */
export function DirettaClient() {
  const [config, setConfig] = useState<Config | null>(null);
  const [failed, setFailed] = useState(false);
  const [cameraName, setCameraName] = useState<string | null>(() => readStored(CAMERA_KEY));
  const [ownDelay, setOwnDelay] = useState<number | null>(() => {
    const stored = readStored(DELAY_KEY);
    return stored === null ? null : clampDelaySeconds(stored);
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      if (timer) clearTimeout(timer);
      timer = null;
      let next = IDLE_REFRESH_MS;
      try {
        const res = await fetch(ENDPOINT);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Config;
        if (!cancelled) {
          setConfig(data);
          setFailed(false);
        }
        next = data.cameras.length > 0 ? LIVE_REFRESH_MS : IDLE_REFRESH_MS;
      } catch {
        if (!cancelled) setFailed(true);
      }
      if (!cancelled) timer = setTimeout(load, next);
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const cameras = config?.cameras ?? [];
  const selected = cameras.find((camera) => camera.name === cameraName) ?? cameras[0] ?? null;
  const delaySeconds = ownDelay ?? config?.delaySeconds ?? DEFAULT_DELAY_SECONDS;
  const overlay = config?.graphicInVideo !== true;

  function chooseCamera(name: string) {
    setCameraName(name);
    writeStored(CAMERA_KEY, name);
  }
  function chooseDelay(seconds: number) {
    const next = clampDelaySeconds(seconds);
    setOwnDelay(next);
    writeStored(DELAY_KEY, String(next));
  }

  if (!config) {
    return failed ? (
      <p className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground" role="status" data-diretta-offline>
        Non riesco a collegarmi. Riprovo da solo tra poco.
      </p>
    ) : (
      <div className="aspect-video animate-pulse rounded-2xl bg-surface-muted" aria-hidden />
    );
  }

  if (!selected) {
    return (
      <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-card" data-diretta-idle>
        <Radio className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="font-display text-xl font-bold text-foreground">La diretta non è ancora iniziata</p>
        <p className="max-w-md text-sm text-muted-foreground">Tieni aperta questa pagina: quando comincia, il video compare da solo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Stage camera={selected} delaySeconds={delaySeconds} overlay={overlay} />

      {cameras.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Scegli la camera" data-diretta-cameras>
          {cameras.map((camera) => (
            <button
              key={camera.id}
              type="button"
              onClick={() => chooseCamera(camera.name)}
              aria-pressed={camera.id === selected.id}
              data-diretta-camera={camera.name}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                camera.id === selected.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-surface-muted text-foreground/80 hover:bg-border",
              )}
            >
              {camera.name}
            </button>
          ))}
        </div>
      )}

      {overlay && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-surface-muted px-4 py-3 text-sm" data-diretta-delay-box>
          <span className="font-semibold text-foreground/80">Punteggio non allineato al video?</span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => chooseDelay(delaySeconds - 1)}
              aria-label="Meno ritardo"
              className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-foreground shadow-xs ring-1 ring-border hover:bg-border"
              data-diretta-delay-down
            >
              <Minus className="h-4 w-4" />
            </button>
            <b className="min-w-[3.5rem] text-center tabular-nums text-foreground" data-diretta-delay>
              {delaySeconds} s
            </b>
            <button
              type="button"
              onClick={() => chooseDelay(delaySeconds + 1)}
              aria-label="Più ritardo"
              className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-foreground shadow-xs ring-1 ring-border hover:bg-border"
              data-diretta-delay-up
            >
              <Plus className="h-4 w-4" />
            </button>
          </span>
          <span className="text-xs text-muted-foreground">Se il punteggio compare prima del punto nel video, aumenta; se dopo, diminuisci.</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Risultato non ufficiale. Il video è di YouTube.</p>
    </div>
  );
}
