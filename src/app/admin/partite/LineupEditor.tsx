"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Crown, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { FieldError } from "@/components/ui/Field";
import { VolleyCourt, GRID_ORDER, shortName } from "@/components/matches/VolleyCourt";
import { cn } from "@/lib/cn";
import { VOLLEY_ROLES, VOLLEY_ROLE_LABELS, emptyMatchLineupSets } from "@/lib/types";
import type { Athlete, CourtPosition, LineupSlot, MatchLineup, SetLineup } from "@/lib/types";
import { saveMatchLineupAction, type LineupFormState } from "./actions";

const initialState: LineupFormState = {};

/** Una posizione in campo (1-6) o uno dei due slot libero, "fuori dalla
 * rotazione": stesso meccanismo di selezione-poi-assegnazione per entrambi. */
type Target = { kind: "position"; position: CourtPosition } | { kind: "libero"; index: 0 | 1 };

function targetsEqual(a: Target | null, b: Target | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "position" && b.kind === "position") return a.position === b.position;
  if (a.kind === "libero" && b.kind === "libero") return a.index === b.index;
  return false;
}

function athleteIdAt(set: SetLineup, target: Target): string | null {
  if (target.kind === "position") {
    return set.slots.find((s) => s.position === target.position)?.athleteId ?? null;
  }
  return set.liberoIds[target.index] ?? null;
}

/** Dove si trova già questa convocata in questo set (posizione o libero), se c'è. */
function findAthleteTarget(set: SetLineup, athleteId: string): Target | null {
  const slot = set.slots.find((s) => s.athleteId === athleteId);
  if (slot) return { kind: "position", position: slot.position };
  const liberoIdx = set.liberoIds.findIndex((id) => id === athleteId);
  if (liberoIdx !== -1) return { kind: "libero", index: liberoIdx as 0 | 1 };
  return null;
}

/** Prima posizione vuota in campo (ordine visivo), poi il primo slot libero vuoto. */
function firstEmptyTarget(set: SetLineup): Target | null {
  for (const position of GRID_ORDER) {
    if (!set.slots.find((s) => s.position === position)?.athleteId) return { kind: "position", position };
  }
  for (let i = 0; i < set.liberoIds.length; i++) {
    if (!set.liberoIds[i]) return { kind: "libero", index: i as 0 | 1 };
  }
  return null;
}

/** Rimuove l'atleta dal target dov'è già assegnata (se diverso dal target di destinazione). */
function clearTarget(set: SetLineup, target: Target): SetLineup {
  if (target.kind === "position") {
    return {
      ...set,
      slots: set.slots.map((slot) =>
        slot.position === target.position ? { ...slot, athleteId: null, role: null, isCaptain: false } : slot,
      ),
    };
  }
  const liberoIds = [...set.liberoIds];
  liberoIds[target.index] = null;
  return { ...set, liberoIds };
}

function assignAt(set: SetLineup, target: Target, athleteId: string): SetLineup {
  if (target.kind === "position") {
    return {
      ...set,
      slots: set.slots.map((slot) => (slot.position === target.position ? { ...slot, athleteId } : slot)),
    };
  }
  const liberoIds = [...set.liberoIds];
  liberoIds[target.index] = athleteId;
  return { ...set, liberoIds };
}

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
  const [selected, setSelected] = useState<Target | null>(() => firstEmptyTarget(sets[0]));
  const [state, formAction] = useActionState(saveMatchLineupAction, initialState);

  const athletesById = new Map(athletes.map((a) => [a.id, a] as const));
  const currentSet = sets[activeSet];
  const selectedSlot: LineupSlot | null =
    selected?.kind === "position" ? (currentSet.slots.find((s) => s.position === selected.position) ?? null) : null;
  const selectedAthleteId = selected ? athleteIdAt(currentSet, selected) : null;
  const selectedAthlete = selectedAthleteId ? (athletesById.get(selectedAthleteId) ?? null) : null;
  const filledCount = currentSet.slots.filter((s) => s.athleteId).length;

  function selectSet(idx: number) {
    setActiveSet(idx);
    setSelected(firstEmptyTarget(sets[idx]));
  }

  function updateSlot(position: CourtPosition, patch: Partial<LineupSlot>) {
    setSets((prev) =>
      prev.map((set, idx) =>
        idx === activeSet
          ? { ...set, slots: set.slots.map((slot) => (slot.position === position ? { ...slot, ...patch } : slot)) }
          : set,
      ),
    );
  }

  /** Assegna la convocata al target selezionato (posizione o libero). Se era
   * già altrove in questo set, la sposta invece di duplicarla. Se il target
   * era vuoto, passa da sola al prossimo target libero — per compilare tutta
   * la formazione toccando in sequenza le convocate. */
  function assignAthlete(athleteId: string) {
    if (!selected) return;
    const existing = findAthleteTarget(currentSet, athleteId);
    const isFreshFill = !selectedAthleteId && !existing;

    let updated = currentSet;
    if (existing && !targetsEqual(existing, selected)) updated = clearTarget(updated, existing);
    updated = assignAt(updated, selected, athleteId);

    setSets((prev) => prev.map((set, idx) => (idx === activeSet ? updated : set)));
    if (isFreshFill) setSelected(firstEmptyTarget(updated));
  }

  function setCaptain(position: CourtPosition) {
    setSets((prev) =>
      prev.map((set, idx) =>
        idx === activeSet
          ? { ...set, slots: set.slots.map((slot) => ({ ...slot, isCaptain: slot.position === position })) }
          : set,
      ),
    );
  }

  function clearSelected() {
    if (!selected) return;
    setSets((prev) => prev.map((set, idx) => (idx === activeSet ? clearTarget(set, selected) : set)));
  }

  function copyFromPreviousSet() {
    if (activeSet === 0) return;
    const copied: SetLineup = {
      slots: sets[activeSet - 1].slots.map((s) => ({ ...s })),
      liberoIds: [...sets[activeSet - 1].liberoIds],
    };
    setSets((prev) => prev.map((set, idx) => (idx === activeSet ? copied : set)));
    setSelected(firstEmptyTarget(copied));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {sets.map((set, idx) => {
          const count = set.slots.filter((s) => s.athleteId).length;
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
        Tocca una posizione (o il libero), poi una convocata per assegnarla: la selezione passa da sola al
        prossimo posto libero.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <div>
          <VolleyCourt
            slots={currentSet.slots}
            athletesById={athletesById}
            onSlotClick={(position) => setSelected({ kind: "position", position })}
            selectedPosition={selected?.kind === "position" ? selected.position : null}
          />

          <div className="mt-2.5 rounded-2xl border border-dashed border-sea-700/25 bg-sea-50/60 p-2.5">
            <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-sea-700">
              Libero — fuori dalla rotazione
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([0, 1] as const).map((i) => {
                const athleteId = currentSet.liberoIds[i];
                const athlete = athleteId ? athletesById.get(athleteId) : undefined;
                const isSelected = selected?.kind === "libero" && selected.index === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected({ kind: "libero", index: i })}
                    className={cn(
                      "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 py-2 text-center transition-colors",
                      athlete
                        ? "border-sea-700 bg-white shadow-sm shadow-sea-950/10"
                        : "border-dashed border-sea-700/25 bg-white/60",
                      "cursor-pointer hover:border-sea-700/60",
                      isSelected && "ring-2 ring-sand-400 ring-offset-1",
                    )}
                  >
                    <span className="text-[9px] font-bold uppercase text-foreground/35">Libero {i + 1}</span>
                    {athlete ? (
                      <span className="line-clamp-2 px-0.5 text-[11px] font-bold leading-tight text-foreground">
                        {shortName(athlete.fullName)}
                      </span>
                    ) : (
                      <span className="text-base font-bold text-foreground/20">+</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {activeSet > 0 && filledCount === 0 && currentSet.liberoIds.every((id) => !id) && (
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
            {selected == null ? (
              <p className="text-sm text-foreground/60">Formazione completa per questo set.</p>
            ) : selected.kind === "libero" ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  Libero {selected.index + 1}
                </p>
                {selectedAthlete ? (
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="font-display text-base font-bold text-foreground">{selectedAthlete.fullName}</p>
                    <button
                      type="button"
                      onClick={clearSelected}
                      className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                    >
                      Svuota
                    </button>
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm text-foreground/60">
                    Tocca una convocata qui sotto per assegnarla come libero.
                  </p>
                )}
                <p className="mt-2 text-xs text-foreground/45">
                  Il libero non occupa una delle 6 posizioni: sostituisce chi è in seconda linea senza contare
                  come cambio.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  Posizione {selected.position}
                </p>
                {selectedAthlete ? (
                  <>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="font-display text-base font-bold text-foreground">{selectedAthlete.fullName}</p>
                      <button
                        type="button"
                        onClick={clearSelected}
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
                            updateSlot(selected.position, { role: selectedSlot?.role === role ? null : role })
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
                            ? setCaptain(selected.position)
                            : updateSlot(selected.position, { isCaptain: false })
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
                  const target = findAthleteTarget(currentSet, athlete.id);
                  const isAtSelected = targetsEqual(target, selected);
                  const label =
                    target?.kind === "position"
                      ? `pos. ${target.position}`
                      : target?.kind === "libero"
                        ? `L${target.index + 1}`
                        : null;
                  return (
                    <button
                      key={athlete.id}
                      type="button"
                      onClick={() => assignAthlete(athlete.id)}
                      disabled={selected == null}
                      className={cn(
                        "truncate rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                        isAtSelected
                          ? "bg-sea-700 text-white"
                          : target
                            ? "bg-primary/10 text-primary hover:bg-primary/15"
                            : "bg-muted text-muted-foreground hover:bg-muted/70",
                        selected == null && "cursor-not-allowed opacity-60",
                      )}
                    >
                      {label && !isAtSelected ? `${athlete.fullName} · ${label}` : athlete.fullName}
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
