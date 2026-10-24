"use client";

import { useState } from "react";
import { Download, ShieldHalf } from "lucide-react";
import { SharePdfButton } from "@/components/pdf/SharePdfButton";
import { Button } from "@/components/ui/Button";
import { buttonVariants } from "@/components/ui/button-variants";
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
  absences = {},
}: {
  matchId: string;
  title: string;
  allAthletes: Athlete[];
  initialCalledUpIds: string[];
  initialLineup: MatchLineup | null;
  /** Le assenze, per atleta: la riga già scritta («Non ci sarà · motivo · nota»). */
  absences?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const calledUpCount = initialCalledUpIds.length;
  const calledUpButAbsent = initialCalledUpIds.filter((id) => absences[id]).length;

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              {calledUpButAbsent > 0 && (
                <p className="mt-1 text-sm font-semibold text-destructive" data-called-up-absent>
                  {calledUpButAbsent === 1 ? "1 convocata non ci sarà" : `${calledUpButAbsent} convocate non ci saranno`}
                </p>
              )}
            </div>
          </div>
          <Button type="button" onClick={() => setOpen(true)} className="shrink-0">
            Apri
          </Button>
        </div>

        {/* I due PDF si prendono anche da qui, senza aprire la finestra (sono quelli salvati): le convocazioni da sole, e le formazioni. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border pt-4" data-match-pdfs>
          <div role="group" aria-label="Convocazioni in PDF" className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">Convocazioni</span>
            <a
              href={`/api/partite/${matchId}/convocazioni/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
              data-convocations-pdf
            >
              <Download className="h-4 w-4" />
              PDF
            </a>
            <SharePdfButton
              href={`/api/partite/${matchId}/convocazioni/pdf`}
              title={`Convocazioni ${title}`}
              label="Condividi"
              size="sm"
              data-share-pdf="convocazioni-partita"
            />
          </div>
          <div role="group" aria-label="Formazioni in PDF" className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">Formazioni</span>
            <a
              href={`/api/partite/${matchId}/formazioni/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
              data-lineups-pdf
            >
              <Download className="h-4 w-4" />
              PDF
            </a>
            <SharePdfButton
              href={`/api/partite/${matchId}/formazioni/pdf`}
              title={`Formazioni ${title}`}
              label="Condividi"
              size="sm"
              data-share-pdf="formazioni-partita"
            />
          </div>
        </div>
      </div>

      {open && (
        <CallUpsAndLineupsDialog
          matchId={matchId}
          title={title}
          allAthletes={allAthletes}
          initialCalledUpIds={initialCalledUpIds}
          initialLineup={initialLineup}
          absences={absences}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
