"use client";

import { useEffect, useRef } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { BaseTourStep } from "./engine/types";
import { TourOverlay } from "./engine/TourOverlay";
import { useTourEngine } from "./engine/useTourEngine";

/** Mini-tour su richiesta per una singola sezione admin: nessun auto-avvio
 * (salvo `autoStart`, usato da un link che apre la guida di proposito),
 * nessuna persistenza — ogni clic riparte dal primo passo. Il pulsante che
 * lo avvia vive dentro la pagina della sezione, già protetta lato server da
 * requireStaffPage/requireDev: chi non ha accesso alla sezione non riceve
 * mai il markup o il JS di questo componente, quindi non può né aprirlo né
 * sapere che esiste. */
export function SectionTour({
  steps,
  label,
  autoStart = false,
  onFinish,
}: {
  steps: BaseTourStep[];
  label?: string;
  /** Parte da sola una volta, all'apertura della pagina (es. dal link «Avvia la guida»). */
  autoStart?: boolean;
  /** `completed` è vero solo se si è arrivati all'ultimo passo. */
  onFinish?: (completed: boolean) => void;
}) {
  const engine = useTourEngine(steps, { onFinish });

  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    engine.start();
    // Il parametro del link serve solo ad aprire la guida: tolto, un ricaricamento non la rilancia.
    const url = new URL(window.location.href);
    if (url.searchParams.has("guida")) {
      url.searchParams.delete("guida");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <>
      <Button
        type="button"
        variant="quiet"
        size={label ? "sm" : "icon-sm"}
        onClick={engine.start}
        aria-label="Guida di questa sezione"
        title="Guida di questa sezione"
        className={label ? undefined : "rounded-full"}
        data-tour-start
      >
        <CircleHelp className="h-[18px] w-[18px]" />
        {label}
      </Button>
      {engine.active && <TourOverlay {...engine} />}
    </>
  );
}
