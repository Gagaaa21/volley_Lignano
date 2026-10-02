"use client";

import { useState } from "react";
import { ShieldHalf } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CallUpsAndLineupsDialog } from "./CallUpsAndLineupsDialog";
import type { Athlete, MatchLineup } from "@/lib/types";

/** Tasto in fondo alla pagina partita che apre la finestra unica per
 * convocazioni e formazioni: tenerla separata dal form dei dettagli la
 * rende più spaziosa e pulita da usare. */
export function MatchWorkspace({
  matchId,
  title,
  allAthletes,
  initialCalledUpIds,
  initialLineup,
}: {
  matchId: string;
  title: string;
  allAthletes: Athlete[];
  initialCalledUpIds: string[];
  initialLineup: MatchLineup | null;
}) {
  const [open, setOpen] = useState(false);
  const calledUpCount = initialCalledUpIds.length;

  return (
    <>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="icon-chip h-11 w-11">
            <ShieldHalf className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-foreground">Convocazioni e formazioni</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="tabular font-semibold text-foreground">{calledUpCount}</span> su {allAthletes.length}{" "}
              convocate · formazioni per set ed esportazione PDF
            </p>
          </div>
        </div>
        <Button type="button" onClick={() => setOpen(true)} className="shrink-0">
          Apri
        </Button>
      </div>

      {open && (
        <CallUpsAndLineupsDialog
          matchId={matchId}
          title={title}
          allAthletes={allAthletes}
          initialCalledUpIds={initialCalledUpIds}
          initialLineup={initialLineup}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
