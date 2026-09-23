"use client";

import { useEffect, useState } from "react";
import { Crown, GripVertical, Users } from "lucide-react";
import { VolleyCourt, GRID_ORDER, shortName } from "@/components/matches/VolleyCourt";
import { AthletePickerDialog } from "./AthletePickerDialog";
import { cn } from "@/lib/cn";
import { VOLLEY_ROLES, VOLLEY_ROLE_LABELS } from "@/lib/types";
import type { Athlete, CourtPosition, LineupSlot, SetLineup } from "@/lib/types";

/** Sotto i 640px si usa tocco-poi-elenco invece del trascinamento: più
 * affidabile col dito su schermi piccoli. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

/** Una posizione in campo (1-6) o uno dei due slot libero, "fuori dalla
 * rotazione": stesso meccanismo di trascinamento per entrambi. */
type Target = { kind: "position"; position: CourtPosition } | { kind: "libero"; index: 0 | 1 };

type DragOrigin =
  | { kind: "roster"; athleteId: string }
  | { kind: "slot"; target: Target; athleteId: string };

const DRAG_THRESHOLD = 6;

function targetsEqual(a: Target | null, b: Target | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "position" && b.kind === "position") return a.position === b.position;
  if (a.kind === "libero" && b.kind === "libero") return a.index === b.index;
  return false;
}

function targetLabel(target: Target): string {
  return target.kind === "position" ? `Posizione ${target.position}` : `Libero ${target.index + 1}`;
}

function dropKeyOf(target: Target): string {
  return target.kind === "position" ? `position-${target.position}` : `libero-${target.index}`;
}

function parseDropKey(key: string): Target | null {
  if (key.startsWith("position-")) {
    const position = Number(key.slice("position-".length));
    if (position >= 1 && position <= 6) return { kind: "position", position: position as CourtPosition };
  }
  if (key.startsWith("libero-")) {
    const index = Number(key.slice("libero-".length));
    if (index === 0 || index === 1) return { kind: "libero", index };
  }
  return null;
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

export function LineupEditor({
  athletes,
  sets,
  onSetsChange,
  activeSet,
  onActiveSetChange,
}: {
  athletes: Athlete[];
  sets: SetLineup[];
  onSetsChange: (updater: (prev: SetLineup[]) => SetLineup[]) => void;
  activeSet: number;
  onActiveSetChange: (index: number) => void;
}) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<Target | null>(() => firstEmptyTarget(sets[activeSet]));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<{ origin: DragOrigin; startX: number; startY: number } | null>(null);
  const [drag, setDrag] = useState<{ origin: DragOrigin; x: number; y: number; hoverKey: string | null } | null>(
    null,
  );

  const athletesById = new Map(athletes.map((a) => [a.id, a] as const));
  const currentSet = sets[activeSet];
  const selectedSlot: LineupSlot | null =
    selected?.kind === "position" ? (currentSet.slots.find((s) => s.position === selected.position) ?? null) : null;
  const selectedAthleteId = selected ? athleteIdAt(currentSet, selected) : null;
  const selectedAthlete = selectedAthleteId ? (athletesById.get(selectedAthleteId) ?? null) : null;

  function beginPointer(event: React.PointerEvent, origin: DragOrigin) {
    event.preventDefault();
    setPending({ origin, startX: event.clientX, startY: event.clientY });
  }

  /** Tocca una posizione o il libero: su mobile apre l'elenco convocate,
   * su desktop/tablet seleziona lo slot (l'assegnazione avviene trascinando). */
  function activateTarget(target: Target) {
    setSelected(target);
    if (isMobile) setPickerOpen(true);
  }

  function assignFromPicker(athleteId: string) {
    if (!selected) return;
    onSetsChange((prev) =>
      prev.map((set, idx) => {
        if (idx !== activeSet) return set;
        let updated = set;
        const existing = findAthleteTarget(set, athleteId);
        if (existing && !targetsEqual(existing, selected)) updated = clearTarget(updated, existing);
        updated = assignAt(updated, selected, athleteId);
        return updated;
      }),
    );
    setPickerOpen(false);
  }

  useEffect(() => {
    if (!pending && !drag) return;

    function resolveDropTarget(x: number, y: number): Target | null {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const dropEl = el?.closest<HTMLElement>("[data-drop-target]");
      const key = dropEl?.dataset.dropTarget;
      return key ? parseDropKey(key) : null;
    }

    function onMove(event: PointerEvent) {
      if (drag) {
        const target = resolveDropTarget(event.clientX, event.clientY);
        setDrag((d) => (d ? { ...d, x: event.clientX, y: event.clientY, hoverKey: target ? dropKeyOf(target) : null } : d));
        return;
      }
      if (pending) {
        const dx = event.clientX - pending.startX;
        const dy = event.clientY - pending.startY;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          setDrag({ origin: pending.origin, x: event.clientX, y: event.clientY, hoverKey: null });
          setPending(null);
        }
      }
    }

    function onUp(event: PointerEvent) {
      if (drag) {
        const target = resolveDropTarget(event.clientX, event.clientY);
        if (target) {
          const from = drag.origin.kind === "slot" ? drag.origin.target : undefined;
          const athleteId = drag.origin.athleteId;
          onSetsChange((prev) =>
            prev.map((set, idx) => {
              if (idx !== activeSet) return set;
              let updated = set;
              const existing = from ?? findAthleteTarget(set, athleteId);
              if (existing && !targetsEqual(existing, target)) updated = clearTarget(updated, existing);
              updated = assignAt(updated, target, athleteId);
              return updated;
            }),
          );
          setSelected(target);
        }
        setDrag(null);
        return;
      }
      if (pending) {
        if (pending.origin.kind === "slot") setSelected(pending.origin.target);
        setPending(null);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pending, drag, activeSet, onSetsChange]);

  function selectSet(idx: number) {
    onActiveSetChange(idx);
    setSelected(firstEmptyTarget(sets[idx]));
    setPickerOpen(false);
    setPending(null);
    setDrag(null);
  }

  function updateSlot(position: CourtPosition, patch: Partial<LineupSlot>) {
    onSetsChange((prev) =>
      prev.map((set, idx) =>
        idx === activeSet
          ? { ...set, slots: set.slots.map((slot) => (slot.position === position ? { ...slot, ...patch } : slot)) }
          : set,
      ),
    );
  }

  function setCaptain(position: CourtPosition) {
    onSetsChange((prev) =>
      prev.map((set, idx) =>
        idx === activeSet
          ? { ...set, slots: set.slots.map((slot) => ({ ...slot, isCaptain: slot.position === position })) }
          : set,
      ),
    );
  }

  function clearSelected() {
    if (!selected) return;
    onSetsChange((prev) => prev.map((set, idx) => (idx === activeSet ? clearTarget(set, selected) : set)));
    setPickerOpen(false);
  }

  function copyFromPreviousSet() {
    if (activeSet === 0) return;
    onSetsChange((prev) => {
      const copied: SetLineup = {
        slots: prev[activeSet - 1].slots.map((s) => ({ ...s })),
        liberoIds: [...prev[activeSet - 1].liberoIds],
      };
      return prev.map((set, idx) => (idx === activeSet ? copied : set));
    });
    setSelected(null);
  }

  const filledCount = currentSet.slots.filter((s) => s.athleteId).length;
  const occupiedLabels = new Map<string, string>();
  for (const slot of currentSet.slots) {
    if (slot.athleteId) occupiedLabels.set(slot.athleteId, `pos. ${slot.position}`);
  }
  currentSet.liberoIds.forEach((id, i) => {
    if (id) occupiedLabels.set(id, `Libero ${i + 1}`);
  });

  const dragHoverTarget = drag?.hoverKey ? parseDropKey(drag.hoverKey) : null;
  const dragHoverPosition = dragHoverTarget?.kind === "position" ? dragHoverTarget.position : null;
  const dragAthlete = drag ? athletesById.get(drag.origin.athleteId) : null;

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
        {isMobile
          ? "Tocca una posizione (o il libero) per aprire l'elenco delle convocate e assegnarla."
          : "Trascina una convocata dall'elenco sopra una posizione (o sul libero) per assegnarla."}
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <div>
          <VolleyCourt
            slots={currentSet.slots}
            athletesById={athletesById}
            onSlotClick={(position) => activateTarget({ kind: "position", position })}
            onSlotPointerDown={(event, position) => {
              if (isMobile) return;
              const athleteId = currentSet.slots.find((s) => s.position === position)?.athleteId;
              if (athleteId) beginPointer(event, { kind: "slot", target: { kind: "position", position }, athleteId });
            }}
            selectedPosition={selected?.kind === "position" ? selected.position : null}
            dragHoverPosition={dragHoverPosition}
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
                const isHovered = drag?.hoverKey === `libero-${i}`;
                return (
                  <button
                    key={i}
                    type="button"
                    data-drop-target={`libero-${i}`}
                    onClick={() => activateTarget({ kind: "libero", index: i })}
                    onPointerDown={(event) => {
                      if (isMobile) return;
                      if (athleteId) beginPointer(event, { kind: "slot", target: { kind: "libero", index: i }, athleteId });
                    }}
                    className={cn(
                      "flex min-h-[3.25rem] touch-none flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 py-2 text-center transition-colors",
                      athlete
                        ? "border-sea-700 bg-white shadow-sm shadow-sea-950/10"
                        : "border-dashed border-sea-700/25 bg-white/60",
                      "cursor-pointer hover:border-sea-700/60",
                      isSelected && "ring-2 ring-sand-400 ring-offset-1",
                      isHovered && "border-sea-700 bg-sea-50 ring-2 ring-sea-700 ring-offset-1",
                    )}
                  >
                    <span className="text-[9px] font-bold uppercase text-foreground/35">Libero {i + 1}</span>
                    {athlete ? (
                      <span className="line-clamp-2 px-0.5 text-[11px] font-bold leading-tight text-foreground">
                        {athlete.fullName}
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
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                    {targetLabel(selected)}
                  </p>
                  {isMobile && (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {selectedAthlete ? "Cambia" : "Scegli convocata"}
                    </button>
                  )}
                </div>
                {selectedAthlete ? (
                  <>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="font-display text-base font-bold text-foreground">{selectedAthlete.fullName}</p>
                      <button
                        type="button"
                        onClick={clearSelected}
                        className="shrink-0 text-xs font-semibold text-destructive hover:underline"
                      >
                        Svuota
                      </button>
                    </div>
                    {selected.kind === "position" ? (
                      <>
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
                      <p className="mt-2 text-xs text-foreground/45">
                        Il libero non occupa una delle 6 posizioni: sostituisce chi è in seconda linea senza
                        contare come cambio.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-0.5 text-sm text-foreground/60">
                    {isMobile
                      ? "Nessuna convocata assegnata qui: toccala per scegliere."
                      : "Nessuna convocata assegnata qui: trascinala dall'elenco."}
                  </p>
                )}
              </>
            )}
          </div>

          {!isMobile && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                Convocate — trascina in campo
              </p>
              {athletes.length === 0 ? (
                <p className="text-sm text-foreground/50">Nessuna convocata: selezionale qui sopra.</p>
              ) : (
                <div className="space-y-1.5">
                  {athletes.map((athlete) => {
                    const label = occupiedLabels.get(athlete.id);
                    return (
                      <div
                        key={athlete.id}
                        onPointerDown={(event) => beginPointer(event, { kind: "roster", athleteId: athlete.id })}
                        className={cn(
                          "flex touch-none cursor-grab items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors active:cursor-grabbing",
                          label ? "border-sea-700/30 bg-sea-700/[0.04]" : "border-border-subtle bg-surface",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <GripVertical className="h-4 w-4 shrink-0 text-foreground/25" />
                          <span className="truncate text-sm font-medium text-foreground">{athlete.fullName}</span>
                        </span>
                        {label && (
                          <span className="shrink-0 rounded-full bg-sea-700/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sea-700">
                            {label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {drag && dragAthlete && (
        <div
          className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-sea-950 px-3 py-1.5 text-xs font-bold text-white shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          {shortName(dragAthlete.fullName)}
        </div>
      )}

      {isMobile && pickerOpen && selected && (
        <AthletePickerDialog
          title={targetLabel(selected)}
          athletes={athletes}
          currentAthleteId={selectedAthleteId}
          occupiedLabels={occupiedLabels}
          onSelect={assignFromPicker}
          onClear={clearSelected}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
