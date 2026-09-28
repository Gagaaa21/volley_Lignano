"use client";

import { useEffect, useRef } from "react";
import type { TrainingTeam } from "@/lib/types";
import { TourOverlay } from "./engine/TourOverlay";
import { useTourEngine } from "./engine/useTourEngine";
import { getPublicTourSteps } from "./publicSteps";

function seenKey(team: TrainingTeam) {
  return `vl-public-tour-seen-${team}`;
}

/** Tour del sito pubblico: parte da solo al primo accesso di ogni sito
 * (U14/U15 e Minivolley separatamente), ricordato in localStorage dato che
 * qui non esiste alcuna sessione da leggere. A differenza del tour admin,
 * questo componente rimonta da zero a ogni caricamento della sua pagina
 * (nessun layout client persistente tra "/" e "/minivolley"), quindi non
 * serve il ref-guard contro un redirect a metà: il mount stesso è il
 * momento giusto per decidere. */
export function PublicTour({ team }: { team: TrainingTeam }) {
  const steps = getPublicTourSteps(team);
  const engine = useTourEngine(steps, {
    onFinish: () => {
      try {
        localStorage.setItem(seenKey(team), "1");
      } catch {
        // localStorage non disponibile (modalità privata, ecc.): il tour
        // ripartirà alla prossima visita, non è un problema bloccante.
      }
    },
  });

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let seen = false;
    try {
      seen = localStorage.getItem(seenKey(team)) === "1";
    } catch {
      seen = false;
    }
    if (!seen) engine.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!engine.active) return null;
  return <TourOverlay {...engine} />;
}
