"use client";

import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { BaseTourStep } from "./engine/types";
import { TourOverlay } from "./engine/TourOverlay";
import { useTourEngine } from "./engine/useTourEngine";

/** Mini-tour su richiesta per una singola sezione admin: nessun auto-avvio,
 * nessuna persistenza — ogni clic riparte dal primo passo. Il pulsante che
 * lo avvia vive dentro la pagina della sezione, già protetta lato server da
 * requireStaffPage/requireDev: chi non ha accesso alla sezione non riceve
 * mai il markup o il JS di questo componente, quindi non può né aprirlo né
 * sapere che esiste. */
export function SectionTour({ steps, label = "Guida" }: { steps: BaseTourStep[]; label?: string }) {
  const engine = useTourEngine(steps);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={engine.start}
        aria-label="Guida di questa sezione"
      >
        <CircleHelp className="h-4 w-4" />
        {label}
      </Button>
      {engine.active && <TourOverlay {...engine} />}
    </>
  );
}
