"use client";

import { useState } from "react";
import { Pencil, UserMinus } from "lucide-react";
import { MAX_NOTE_LENGTH, UNAVAILABILITY_REASONS, UNAVAILABILITY_REASON_LABELS, type UnavailabilityReason } from "@/lib/availability/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { clearStaffUnavailabilityAction, setStaffUnavailabilityAction } from "./availability-actions";

/**
 * Una non disponibilità della partita, per lo staff: chi, perché, chi l'ha scritta per ultimo e quando. Lo staff la modifica
 * (motivo e nota) o la toglie sempre, anche se l'ha segnata il genitore e anche a partita finita.
 */
export function AvailabilityRow({
  matchId,
  athleteId,
  name,
  calledUp,
  description,
  attribution,
  reason,
  note,
}: {
  matchId: string;
  athleteId: string;
  name: string;
  calledUp: boolean;
  /** Motivo e nota in una riga, già pronti. */
  description: string;
  /** «Ultima modifica del genitore · 23 ott 2026, 10:02», già pronto. */
  attribution: string;
  reason: UnavailabilityReason | null;
  note: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const field = `avail-${matchId}-${athleteId}`;

  return (
    <li className="px-4 py-3" data-availability-row={athleteId}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {name}
            {calledUp && <Badge tone="danger">Convocata</Badge>}
          </p>
          <p className="text-sm text-foreground/75">{description}</p>
          <p className="text-[12px] text-muted-foreground">{attribution}</p>
        </div>
        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)} data-availability-edit>
              <Pencil className="h-4 w-4" />
              Modifica
            </Button>
            <form action={clearStaffUnavailabilityAction}>
              <input type="hidden" name="matchId" value={matchId} />
              <input type="hidden" name="athleteId" value={athleteId} />
              <Button type="submit" size="sm" variant="outline" data-availability-clear>
                <UserMinus className="h-4 w-4" />
                Torna disponibile
              </Button>
            </form>
          </div>
        )}
      </div>

      {editing && (
        <form
          action={async (formData) => {
            await setStaffUnavailabilityAction(formData);
            setEditing(false);
          }}
          className="mt-3 space-y-3 rounded-xl bg-surface-muted px-4 py-4"
          data-availability-edit-form
        >
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="athleteId" value={athleteId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${field}-reason`}>Motivo</Label>
              <Select id={`${field}-reason`} name="reason" defaultValue={reason ?? ""}>
                <option value="">Non indicato</option>
                {UNAVAILABILITY_REASONS.map((key) => (
                  <option key={key} value={key}>
                    {UNAVAILABILITY_REASON_LABELS[key]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`${field}-note`}>Nota (facoltativa)</Label>
              <Input id={`${field}-note`} name="note" defaultValue={note ?? ""} maxLength={MAX_NOTE_LENGTH} autoComplete="off" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" data-availability-save>
              Salva le modifiche
            </Button>
            <Button type="button" size="sm" variant="quiet" onClick={() => setEditing(false)}>
              Annulla
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
