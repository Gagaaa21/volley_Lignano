"use client";

import { useState } from "react";
import { Download, ShieldHalf } from "lucide-react";
import { SharePdfButton } from "@/components/pdf/SharePdfButton";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { CallUpsAndLineupsDialog } from "./CallUpsAndLineupsDialog";
import type { UnavailableFlag } from "./CallUpsSection";
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
  unavailable = {},
}: {
  matchId: string;
  title: string;
  allAthletes: Athlete[];
  initialCalledUpIds: string[];
  initialLineup: MatchLineup | null;
  /** Le atlete segnalate non disponibili per questa partita (motivo e chi l'ha segnalato), per atleta. */
  unavailable?: Record<string, UnavailableFlag>;
}) {
  const [open, setOpen] = useState(false);
  const calledUpCount = initialCalledUpIds.length;
  const unavailableCount = Object.keys(unavailable).length;
  const calledUpButUnavailable = initialCalledUpIds.filter((id) => unavailable[id]).length;

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
            {calledUpButUnavailable > 0 && (
              <p className="mt-1 text-sm font-semibold text-destructive" data-called-up-unavailable>
                {calledUpButUnavailable === 1 ? "1 convocata è segnalata non disponibile" : `${calledUpButUnavailable} convocate sono segnalate non disponibili`}
              </p>
            )}
            {calledUpButUnavailable === 0 && unavailableCount > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {unavailableCount === 1 ? "1 atleta non disponibile, non convocata" : `${unavailableCount} atlete non disponibili, non convocate`}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Le formazioni in PDF si prendono anche da qui, senza aprire la finestra (sono quelle salvate). */}
          <LinkButton href={`/api/partite/${matchId}/formazioni/pdf`} variant="outline" target="_blank" data-lineups-pdf>
            <Download className="h-4 w-4" />
            Formazioni PDF
          </LinkButton>
          <SharePdfButton
            href={`/api/partite/${matchId}/formazioni/pdf`}
            title={`Formazioni ${title}`}
            data-share-pdf="formazioni-partita"
          />
          <Button type="button" onClick={() => setOpen(true)}>
            Apri
          </Button>
        </div>
      </div>

      {open && (
        <CallUpsAndLineupsDialog
          matchId={matchId}
          title={title}
          allAthletes={allAthletes}
          initialCalledUpIds={initialCalledUpIds}
          initialLineup={initialLineup}
          unavailable={unavailable}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
