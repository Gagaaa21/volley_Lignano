"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Download, Save, X } from "lucide-react";
import { PdfLink } from "@/components/pdf/PdfLink";
import { SharePdfButton } from "@/components/pdf/SharePdfButton";
import { Button } from "@/components/ui/Button";
import { buttonVariants } from "@/components/ui/button-variants";
import { FieldError } from "@/components/ui/Field";
import { CallUpsSection } from "./CallUpsSection";
import { LineupEditor } from "./LineupEditor";
import { saveCallUpsAndLineupAction, type CallUpsAndLineupFormState } from "./actions";
import { emptyMatchLineupSets } from "@/lib/types";
import type { Athlete, MatchLineup, SetLineup } from "@/lib/types";

const initialState: CallUpsAndLineupFormState = {};

/** Quello che il modulo manda al salvataggio (convocate e formazioni), per capire se dopo l'ultimo salvataggio c'è altro da salvare. */
const snapshotOf = (calledUp: Iterable<string>, sets: SetLineup[]) => JSON.stringify({ calledUp: [...calledUp].sort(), sets });

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
  title,
  allAthletes,
  initialCalledUpIds,
  initialLineup,
  absences,
  notifyByDefault = true,
  onClose,
}: {
  matchId: string;
  title: string;
  allAthletes: Athlete[];
  initialCalledUpIds: string[];
  initialLineup: MatchLineup | null;
  absences?: Record<string, string>;
  notifyByDefault?: boolean;
  onClose: () => void;
}) {
  const [calledUp, setCalledUp] = useState<Set<string>>(() => new Set(initialCalledUpIds));
  const [sets, setSets] = useState<SetLineup[]>(() => initialLineup?.sets ?? emptyMatchLineupSets());
  const [activeSet, setActiveSet] = useState(0);
  const snapshot = snapshotOf(calledUp, sets);
  // Quello che la finestra mostra in questo momento: al salvataggio si prende quello dell'istante dell'invio, così un
  // cambiamento fatto mentre il salvataggio è in corso resta «non salvato».
  const latestSnapshot = useRef(snapshot);
  useEffect(() => {
    latestSnapshot.current = snapshot;
  });
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    snapshotOf(initialCalledUpIds, initialLineup?.sets ?? emptyMatchLineupSets()),
  );
  const [state, formAction] = useActionState(async (previous: CallUpsAndLineupFormState, formData: FormData) => {
    const submitted = latestSnapshot.current;
    const next = await saveCallUpsAndLineupAction(previous, formData);
    if (next.success) setSavedSnapshot(submitted);
    return next;
  }, initialState);
  // Il PDF delle formazioni si prepara da quelle salvate: con modifiche non salvate riporterebbe la versione di prima.
  const dirty = snapshot !== savedSnapshot;
  // Il PDF delle convocazioni, invece, segue quello che si vede: la selezione di adesso viaggia nell'indirizzo.
  const convocationsHref = `/api/partite/${matchId}/convocazioni/pdf?ids=${[...calledUp].join(",")}`;
  const lineupsHref = `/api/partite/${matchId}/formazioni/pdf`;

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
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[rgba(12,29,54,0.45)] backdrop-blur-[3px] sm:items-center sm:p-6"
      role="presentation"
    >
      <div
        className="flex h-full w-full max-w-5xl animate-[pop-in_180ms_ease-out] flex-col overflow-hidden bg-card shadow-pop sm:h-[92vh] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label="Convocazioni e formazioni"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="display-wide text-xl text-foreground">Convocazioni e formazioni</p>
            <p className="truncate text-sm text-muted-foreground">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

          <div className="flex-1 space-y-8 overflow-y-auto px-5 py-5 sm:px-6">
            <section>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">Convocazioni</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">Chi convochi qui diventa selezionabile nelle formazioni per set, qui sotto.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PdfLink
                    href={convocationsHref}
                    target="_blank"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    sheetTitle={`Convocazioni ${title}`}
                    data-convocations-pdf-dialog
                  >
                    <Download className="h-4 w-4" />
                    Convocazioni PDF
                  </PdfLink>
                  <SharePdfButton href={convocationsHref} title={`Convocazioni ${title}`} size="sm" prefetch data-share-pdf="convocazioni" />
                </div>
              </div>
              <CallUpsSection
                athletes={allAthletes}
                calledUp={calledUp}
                onToggle={toggleCalledUp}
                onSelectAll={() => setCalledUp(new Set(allAthletes.map((a) => a.id)))}
                onSelectNone={() => setCalledUp(new Set())}
                absences={absences}
              />
            </section>

            <section className="border-t border-border pt-6">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">Formazioni per set</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">Visibili solo allo staff dell&apos;area tecnici: mai sul sito pubblico.</p>
                  {dirty && (
                    <p className="mt-1 text-[13px] font-semibold text-warning" data-lineups-stale>
                      Il PDF delle formazioni riporta l&apos;ultima versione salvata.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PdfLink
                    href={lineupsHref}
                    target="_blank"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    sheetTitle={`Formazioni ${title}`}
                    data-lineups-pdf-dialog
                  >
                    <Download className="h-4 w-4" />
                    Formazioni PDF
                  </PdfLink>
                  <SharePdfButton href={lineupsHref} title={`Formazioni ${title}`} size="sm" prefetch data-share-pdf="formazioni" />
                </div>
              </div>
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

          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border bg-surface-muted px-5 py-3.5 sm:px-6">
            <SubmitButton />
            {/* L'avviso parte solo se cambia la lista delle convocate (le formazioni restano allo staff), e dice quante sono e il ritrovo. */}
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-foreground" data-callups-notify>
              <input type="checkbox" name="notify" defaultChecked={notifyByDefault} className="h-4 w-4 rounded border-border-strong accent-[var(--primary)]" />
              Avvisa le famiglie se cambiano le convocate
            </label>
            {state.error && <FieldError>{state.error}</FieldError>}
            {state.success && !dirty && <span className="text-sm font-semibold text-success">Salvato.</span>}
            {dirty && (
              <span className="text-[13px] font-semibold text-warning" data-unsaved-hint>
                Modifiche non salvate.
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
