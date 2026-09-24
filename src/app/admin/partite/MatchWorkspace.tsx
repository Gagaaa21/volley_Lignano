"use client";

import { useState } from "react";
import { ShieldHalf } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
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
      <Card className="mt-6">
        <CardBody className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sea-700/10 text-sea-700">
              <ShieldHalf className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-base font-semibold text-foreground">Convocazioni e formazioni</p>
              <p className="mt-0.5 text-sm text-foreground/60">
                {calledUpCount}/{allAthletes.length} convocate · gestisci qui l&apos;elenco e le formazioni per set.
              </p>
            </div>
          </div>
          <Button type="button" onClick={() => setOpen(true)}>
            Apri
          </Button>
        </CardBody>
      </Card>

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
