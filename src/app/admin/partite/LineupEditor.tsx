"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Crown, Download, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { Label, Select, FieldError } from "@/components/ui/Field";
import { VolleyCourt } from "@/components/matches/VolleyCourt";
import { cn } from "@/lib/cn";
import { VOLLEY_ROLES, VOLLEY_ROLE_LABELS, emptyMatchLineupSets } from "@/lib/types";
import type { Athlete, CourtPosition, LineupSlot, MatchLineup, SetLineup } from "@/lib/types";
import { saveMatchLineupAction, type LineupFormState } from "./actions";

const initialState: LineupFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva formazioni"}
    </Button>
  );
}

export function LineupEditor({
  matchId,
  athletes,
  initialLineup,
}: {
  matchId: string;
  athletes: Athlete[];
  initialLineup: MatchLineup | null;
}) {
  const [sets, setSets] = useState<SetLineup[]>(() => initialLineup?.sets ?? emptyMatchLineupSets());
  const [activeSet, setActiveSet] = useState(0);
  const [editingPosition, setEditingPosition] = useState<CourtPosition | null>(null);
  const [state, formAction] = useActionState(saveMatchLineupAction, initialState);

  const athletesById = new Map(athletes.map((a) => [a.id, a] as const));
  const currentSet = sets[activeSet];
  const editingSlot: LineupSlot | null =
    editingPosition != null ? (currentSet.find((s) => s.position === editingPosition) ?? null) : null;
  const usedAthleteIds = new Set(
    currentSet.filter((s) => s.athleteId && s.position !== editingPosition).map((s) => s.athleteId as string),
  );
  const filledCount = currentSet.filter((s) => s.athleteId).length;

  function updateSlot(position: CourtPosition, patch: Partial<LineupSlot>) {
    setSets((prev) =>
      prev.map((set, idx) =>
        idx === activeSet ? set.map((slot) => (slot.position === position ? { ...slot, ...patch } : slot)) : set,
      ),
    );
  }

  function setCaptain(position: CourtPosition) {
    setSets((prev) =>
      prev.map((set, idx) =>
        idx === activeSet ? set.map((slot) => ({ ...slot, isCaptain: slot.position === position })) : set,
      ),
    );
  }

  function clearSlot(position: CourtPosition) {
    updateSlot(position, { athleteId: null, role: null, isCaptain: false });
  }

  function copyFromPreviousSet() {
    if (activeSet === 0) return;
    const source = sets[activeSet - 1];
    setSets((prev) => prev.map((set, idx) => (idx === activeSet ? source.map((s) => ({ ...s })) : set)));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {sets.map((set, idx) => {
          const count = set.filter((s) => s.athleteId).length;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveSet(idx)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
                activeSet === idx
                  ? "bg-sea-700 text-white shadow-sm"
                  : "bg-surface-muted text-foreground/60 hover:bg-surface-muted/70",
              )}
            >
              Set {idx + 1}
              {count > 0 && <span className="ml-1 text-xs opacity-70">{count}/6</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <div>
          <VolleyCourt slots={currentSet} athletesById={athletesById} onSlotClick={setEditingPosition} />
          {activeSet > 0 && filledCount === 0 && (
            <button
              type="button"
              onClick={copyFromPreviousSet}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              Copia formazione dal Set {activeSet}
            </button>
          )}
        </div>

        <div className="space-y-1">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/40">
            Convocate ({athletes.length})
          </p>
          {athletes.length === 0 ? (
            <p className="text-sm text-foreground/50">
              Nessuna convocata: selezionale nella sezione &quot;Dettagli&quot; qui sopra.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {athletes.map((athlete) => {
                const inLineup = currentSet.some((s) => s.athleteId === athlete.id);
                return (
                  <span
                    key={athlete.id}
                    className={cn(
                      "truncate rounded-full px-2.5 py-1 text-xs font-medium",
                      inLineup ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {athlete.fullName}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editingPosition != null && editingSlot && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/50 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setEditingPosition(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-t-2xl border border-border-subtle bg-surface p-5 shadow-[0_-20px_50px_-20px_rgba(9,27,38,0.35)] sm:rounded-2xl sm:shadow-[0_20px_50px_-20px_rgba(9,27,38,0.35)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Posizione ${editingPosition}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-base font-bold text-foreground">Posizione {editingPosition}</p>
              <button
                type="button"
                onClick={() => setEditingPosition(null)}
                aria-label="Chiudi"
                className="rounded-full p-1.5 text-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <Label htmlFor="slot-athlete">Giocatrice</Label>
              <Select
                id="slot-athlete"
                value={editingSlot.athleteId ?? ""}
                onChange={(event) => updateSlot(editingPosition, { athleteId: event.target.value || null })}
              >
                <option value="">— Nessuna —</option>
                {athletes
                  .filter((a) => !usedAthleteIds.has(a.id) || a.id === editingSlot.athleteId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.fullName}
                    </option>
                  ))}
              </Select>
            </div>

            <div className="mt-4">
              <Label>Ruolo</Label>
              <div className="flex flex-wrap gap-1.5">
                {VOLLEY_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() =>
                      updateSlot(editingPosition, { role: editingSlot.role === role ? null : role })
                    }
                    title={VOLLEY_ROLE_LABELS[role]}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                      editingSlot.role === role
                        ? "bg-sea-700 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/70",
                    )}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-foreground/45">
                {editingSlot.role ? VOLLEY_ROLE_LABELS[editingSlot.role] : "Nessun ruolo assegnato."}
              </p>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-border-subtle px-3.5 py-2.5 has-[:checked]:border-sand-400 has-[:checked]:bg-sand-50">
              <input
                type="checkbox"
                checked={editingSlot.isCaptain}
                onChange={(event) =>
                  event.target.checked
                    ? setCaptain(editingPosition)
                    : updateSlot(editingPosition, { isCaptain: false })
                }
                className="h-4 w-4 accent-sea-700"
              />
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Crown className="h-3.5 w-3.5 text-sand-500" />
                È la capitana in questo set
              </span>
            </label>

            <div className="mt-5 flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                onClick={() => {
                  clearSlot(editingPosition);
                  setEditingPosition(null);
                }}
              >
                Svuota posizione
              </Button>
              <Button type="button" className="ml-auto" onClick={() => setEditingPosition(null)}>
                Fatto
              </Button>
            </div>
          </div>
        </div>
      )}

      <form action={formAction} className="mt-5 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-5">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="sets" value={JSON.stringify(sets)} />
        <SubmitButton />
        <LinkButton href={`/api/partite/${matchId}/formazioni/pdf`} variant="outline" target="_blank">
          <Download className="h-4 w-4" />
          Esporta PDF
        </LinkButton>
        {state.error && <FieldError>{state.error}</FieldError>}
        {state.success && <span className="text-sm font-medium text-primary">Formazioni salvate.</span>}
      </form>
    </div>
  );
}
