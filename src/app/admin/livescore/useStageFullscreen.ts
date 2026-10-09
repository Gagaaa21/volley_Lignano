"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

// Safari (iPad) conosce solo la versione con prefisso webkit dell'API.
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

function nativeFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * Schermo intero per un riquadro della pagina.
 *
 * Dove il browser lo permette si usa quello vero (anche con l'API di Safari su
 * iPad). Altrove — iPhone, app installata sulla schermata Home, richiesta
 * rifiutata — si ripiega su uno schermo intero "simulato": il riquadro
 * ricopre tutta la finestra, nascondendo intestazione e menu, e si chiude con
 * Esc o con lo stesso pulsante. Così il pulsante funziona su ogni dispositivo.
 */
export function useStageFullscreen(stageRef: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [simulated, setSimulated] = useState(false);
  // Numero dell'ultimo clic: se mentre si aspetta l'esito di una richiesta ne arriva un altro,
  // quella richiesta non deve più cambiare nulla.
  const lastToggle = useRef(0);

  // Segue lo stato reale dello schermo intero (anche se si esce con Esc).
  useEffect(() => {
    function sync() {
      const element = nativeFullscreenElement();
      setNative(element !== null && element === stageRef.current);
    }
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [stageRef]);

  // Schermo intero simulato: Esc lo chiude e la pagina sotto non scorre.
  useEffect(() => {
    if (!simulated) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSimulated(false);
    }
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [simulated]);

  const toggle = useCallback(async () => {
    const stage = stageRef.current as FullscreenElement | null;
    if (!stage) return;
    const doc = document as FullscreenDocument;
    const thisToggle = ++lastToggle.current;

    if (nativeFullscreenElement() === stage) {
      try {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } catch {
        // Già uscito per conto suo: lo stato si aggiorna con l'evento.
      }
      return;
    }
    if (simulated) {
      setSimulated(false);
      return;
    }

    const request = stage.requestFullscreen?.bind(stage) ?? stage.webkitRequestFullscreen?.bind(stage);
    if (request) {
      try {
        await request();
        // Alcuni browser accettano la richiesta senza fare nulla: se dopo un attimo
        // lo schermo intero vero non c'è, si passa a quello simulato.
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (lastToggle.current !== thisToggle || nativeFullscreenElement() === stage) return;
      } catch {
        // Negato o non supportato: si ripiega sullo schermo intero simulato.
        if (lastToggle.current !== thisToggle) return;
      }
    }
    setSimulated(true);
  }, [stageRef, simulated]);

  return { isFullscreen: native || simulated, isSimulated: simulated, toggle };
}
