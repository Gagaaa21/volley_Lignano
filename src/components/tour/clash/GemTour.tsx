"use client";

import { useEffect } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { BaseTourStep } from "../engine/types";
import { useTourEngine } from "../engine/useTourEngine";
import { ClashTourOverlay } from "./ClashTourOverlay";

// Il suffisso è la "edizione" del tour: cambiarlo lo ripropone da solo a
// tutti, anche a chi l'aveva già visto e chiuso. Il valore senza suffisso
// ("vl-gem-tour-seen") è quello della prima edizione, ormai ignorato.
const SEEN_KEY = "vl-gem-tour-seen-2";
const AUTO_START_DELAY_MS = 700;

/** Mini-tour della sezione Test fisici, guidato da Gem (il boia) in stile
 * videogioco. Come SectionTour si riapre dal "?" accanto al titolo, ma la
 * prima visita da ogni dispositivo lo fa partire da solo (dopo un attimo,
 * per lasciar vedere la pagina prima che Gem salti fuori), ricordato
 * in localStorage come il tour pubblico. Chi aveva già aperto la sezione
 * prima dell'ultima edizione (SEEN_KEY) lo rivede una volta. */
export function GemTour({ steps }: { steps: BaseTourStep[] }) {
  const engine = useTourEngine(steps, {
    onFinish: () => {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        // localStorage non disponibile (modalità privata, ecc.): Gem si
        // ripresenterà alla prossima visita, niente di grave.
      }
    },
  });

  // Niente ref-guard come in PublicTour: qui l'avvio è rimandato con un
  // timer, e il cleanup che lo annulla deve poter ripartire al secondo
  // montaggio di StrictMode in sviluppo.
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    const timer = setTimeout(engine.start, AUTO_START_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="quiet"
        size="icon-sm"
        onClick={engine.start}
        aria-label="Guida di questa sezione"
        title="Guida di questa sezione"
        className="rounded-full"
        data-tour="test-fisici-help"
      >
        <CircleHelp className="h-[18px] w-[18px]" />
      </Button>
      {engine.active && <ClashTourOverlay {...engine} />}
    </>
  );
}
