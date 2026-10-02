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
export function SectionTour({ steps, label }: { steps: BaseTourStep[]; label?: string }) {
  const engine = useTourEngine(steps);

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
      >
        <CircleHelp className="h-[18px] w-[18px]" />
        {label}
      </Button>
      {engine.active && <TourOverlay {...engine} />}
    </>
  );
}
