"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Crown, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { FieldError } from "@/components/ui/Field";
import { VolleyCourt, GRID_ORDER } from "@/components/matches/VolleyCourt";
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

/** Prima posizione vuota, nell'ordine visivo del campo (rete, poi fondo). */
function firstEmptyPosition(set: SetLineup): CourtPosition | null {
  for (const position of GRID_ORDER) {
    if (!set.find((s) => s.position === position)?.athleteId) return position;
  }
  return null;
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
  const [selectedPosition, setSelectedPosition] = useState<CourtPosition | null>(() => firstEmptyPosition(sets[0]));
  const [state, formAction] = useActionState(saveMatchLineupAction, initialState);

  const athletesById = new Map(athletes.map((a) => [a.id, a] as const));
  const currentSet = sets[activeSet];
  const selectedSlot: LineupSlot | null =
    selectedPosition != null ? (currentSet.find((s) => s.position === selectedPosition) ?? null) : null;
  const selectedAthlete = selectedSlot?.athleteId ? (athletesById.get(selectedSlot.athleteId) ?? null) : null;
  const filledCount = currentSet.filter((s) => s.athleteId).length;

  function selectSet(idx: number) {
    setActiveSet(idx);
    setSelectedPosition(firstEmptyPosition(sets[idx]));
  }

  function updateSlot(position: CourtPosition, patch: Partial<LineupSlot>) {
    setSets((prev) =>
      prev.map((set, idx) =>
        idx === activeSet ? set.map((slot) => (slot.position === position ? { ...slot, ...patch } : slot)) : set,
      ),
    );
  }

  /** Assegna la giocatrice alla posizione selezionata. Se era già in un'altra
   * posizione di questo set, la sposta (liberando quella vecchia) invece di
   * duplicarla. Se la posizione selezionata era vuota, passa da sola alla
   * prossima posizione libera — per compilare l'intera formazione toccando
   * in sequenza le convocate, senza riaprire nulla ad ogni giocatrice. */
  function assignAthlete(athleteId: string) {
    if (selectedPosition == null) return;
    const existing = currentSet.find((s) => s.athleteId === athleteId);
    const isFreshFill = !selectedSlot?.athleteId && !existing;

    setSets((prev) =>
      prev.map((set, idx) => {
        if (idx !== activeSet) return set;
        return set.map((slot) => {
          if (existing && slot.position === existing.position && slot.position !== selectedPosition) {
            return { ...slot, athleteId: null, role: null, isCaptain: false };
          }
          if (slot.position === selectedPosition) {
            return { ...slot, athleteId };
          }
          return slot;
        });
      }),
    );

    if (isFreshFill) {
      const updatedSet = currentSet.map((slot) =>
        slot.position === selectedPosition ? { ...slot, athleteId } : slot,
      );
      setSelectedPosition(firstEmptyPosition(updatedSet));
    }
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
    setSelectedPosition(position);
  }

  function copyFromPreviousSet() {
    if (activeSet === 0) return;
    const copied = sets[activeSet - 1].map((s) => ({ ...s }));
    setSets((prev) => prev.map((set, idx) => (idx === activeSet ? copied : set)));
    setSelectedPosition(firstEmptyPosition(copied));
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
              onClick={() => selectSet(idx)}
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

      <p className="mt-2.5 text-xs text-foreground/50">
        Tocca una posizione sul campo, poi una convocata per assegnarla: la selezione passa da sola alla
        posizione libera successiva.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <div>
          <VolleyCourt
            slots={currentSet}
            athletesById={athletesById}
            onSlotClick={setSelectedPosition}
            selectedPosition={selectedPosition}
          />
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

        <div className="space-y-3.5">
          <div className="rounded-xl border border-border-subtle bg-surface-muted/60 p-3.5">
            {selectedPosition == null ? (
              <p className="text-sm text-foreground/60">Formazione completa per questo set.</p>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  Posizione {selectedPosition}
                </p>
                {selectedAthlete ? (
                  <>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="font-display text-base font-bold text-foreground">{selectedAthlete.fullName}</p>
                      <button
                        type="button"
                        onClick={() => clearSlot(selectedPosition)}
                        className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                      >
                        Svuota
                      </button>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {VOLLEY_ROLES.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() =>
                            updateSlot(selectedPosition, { role: selectedSlot?.role === role ? null : role })
                          }
                          title={VOLLEY_ROLE_LABELS[role]}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                            selectedSlot?.role === role
                              ? "bg-sea-700 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/70",
                          )}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                    <label className="mt-2.5 flex cursor-pointer items-center gap-1.5 text-sm font-medium text-foreground/80">
                      <input
                        type="checkbox"
                        checked={selectedSlot?.isCaptain ?? false}
                        onChange={(event) =>
                          event.target.checked
                            ? setCaptain(selectedPosition)
                            : updateSlot(selectedPosition, { isCaptain: false })
                        }
                        className="h-4 w-4 accent-sea-700"
                      />
                      <Crown className="h-3.5 w-3.5 text-sand-500" />
                      Capitana in questo set
                    </label>
                  </>
                ) : (
                  <p className="mt-0.5 text-sm text-foreground/60">Tocca una convocata qui sotto per assegnarla.</p>
                )}
              </>
            )}
          </div>

          <div>
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
                  const slotFor = currentSet.find((s) => s.athleteId === athlete.id);
                  const isAtSelected = slotFor?.position === selectedPosition;
                  return (
                    <button
                      key={athlete.id}
                      type="button"
                      onClick={() => assignAthlete(athlete.id)}
                      disabled={selectedPosition == null}
                      className={cn(
                        "truncate rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                        isAtSelected
                          ? "bg-sea-700 text-white"
                          : slotFor
                            ? "bg-primary/10 text-primary hover:bg-primary/15"
                            : "bg-muted text-muted-foreground hover:bg-muted/70",
                        selectedPosition == null && "cursor-not-allowed opacity-60",
                      )}
                    >
                      {slotFor && !isAtSelected ? `${athlete.fullName} · pos. ${slotFor.position}` : athlete.fullName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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
