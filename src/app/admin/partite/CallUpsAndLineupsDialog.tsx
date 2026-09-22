"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Download, Save, X } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import { CallUpsSection } from "./CallUpsSection";
import { LineupEditor } from "./LineupEditor";
import { saveCallUpsAndLineupAction, type CallUpsAndLineupFormState } from "./actions";
import { emptyMatchLineupSets } from "@/lib/types";
import type { Athlete, MatchLineup, SetLineup } from "@/lib/types";

const initialState: CallUpsAndLineupFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva convocazioni e formazioni"}
    </Button>
  );
}

/** Finestra alta e spaziosa, unica per convocazioni (stile Presenze) e
 * formazioni per set (campo con trascinamento), aperta da un tasto in fondo
 * alla pagina partita. */
export function CallUpsAndLineupsDialog({
  matchId,
  opponent,
  allAthletes,
  initialCalledUpIds,
  initialLineup,
  onClose,
}: {
  matchId: string;
  opponent: string;
  allAthletes: Athlete[];
  initialCalledUpIds: string[];
  initialLineup: MatchLineup | null;
  onClose: () => void;
}) {
  const [calledUp, setCalledUp] = useState<Set<string>>(() => new Set(initialCalledUpIds));
  const [sets, setSets] = useState<SetLineup[]>(() => initialLineup?.sets ?? emptyMatchLineupSets());
  const [activeSet, setActiveSet] = useState(0);
  const [state, formAction] = useActionState(saveCallUpsAndLineupAction, initialState);

  function toggleCalledUp(athleteId: string) {
    setCalledUp((prev) => {
      const next = new Set(prev);
      if (next.has(athleteId)) {
        next.delete(athleteId);
        // Rimuove l'atleta anche da eventuali posizioni/libero già assegnati:
        // non può restare in formazione chi non è più convocata.
        setSets((prevSets) =>
          prevSets.map((set) => ({
            slots: set.slots.map((slot) =>
              slot.athleteId === athleteId ? { ...slot, athleteId: null, role: null, isCaptain: false } : slot,
            ),
            liberoIds: set.liberoIds.map((id) => (id === athleteId ? null : id)),
          })),
        );
      } else {
        next.add(athleteId);
      }
      return next;
    });
  }

  const calledUpAthletes = allAthletes.filter((a) => calledUp.has(a.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-sea-950/60 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
    >
      <div
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-surface shadow-2xl sm:h-[92vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Convocazioni e formazioni"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-foreground">Convocazioni e formazioni</p>
            <p className="truncate text-sm text-foreground/55">vs {opponent}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="shrink-0 rounded-full p-2 text-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form action={formAction} className="flex flex-1 flex-col overflow-hidden">
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="sets" value={JSON.stringify(sets)} />
          {Array.from(calledUp).map((athleteId) => (
            <input key={athleteId} type="hidden" name="calledUpAthleteIds" value={athleteId} />
          ))}

          <div className="flex-1 space-y-8 overflow-y-auto px-5 py-5">
            <section>
              <h3 className="font-display text-base font-semibold text-foreground">Convocazioni</h3>
              <p className="mt-0.5 mb-3 text-sm text-foreground/55">
                Chi convochi qui diventa selezionabile nelle formazioni per set, qui sotto.
              </p>
              <CallUpsSection
                athletes={allAthletes}
                calledUp={calledUp}
                onToggle={toggleCalledUp}
                onSelectAll={() => setCalledUp(new Set(allAthletes.map((a) => a.id)))}
                onSelectNone={() => setCalledUp(new Set())}
              />
            </section>

            <section className="border-t border-border-subtle pt-6">
              <h3 className="font-display text-base font-semibold text-foreground">Formazioni per set</h3>
              <p className="mt-0.5 mb-3 text-sm text-foreground/55">
                Visibili solo allo staff dell&apos;area riservata: mai sul sito pubblico.
              </p>
              {calledUpAthletes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-foreground/50">
                  Convoca prima almeno un&apos;atleta qui sopra per poter costruire le formazioni.
                </div>
              ) : (
                <LineupEditor
                  athletes={calledUpAthletes}
                  sets={sets}
                  onSetsChange={setSets}
                  activeSet={activeSet}
                  onActiveSetChange={setActiveSet}
                />
              )}
            </section>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border-subtle px-5 py-4">
            <SubmitButton />
            <LinkButton href={`/api/partite/${matchId}/formazioni/pdf`} variant="outline" target="_blank">
              <Download className="h-4 w-4" />
              Esporta PDF
            </LinkButton>
            {state.error && <FieldError>{state.error}</FieldError>}
            {state.success && <span className="text-sm font-medium text-primary">Salvato.</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
