"use client";

import { useActionState, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Save, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import { normalizePersonName, suggestSimilarNames } from "@/lib/text";
import { saveMiniAttendanceAction, type MiniAttendanceFormState } from "./actions";

const initialState: MiniAttendanceFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva presenze"}
    </Button>
  );
}

/** Un nome già usato, mostrato come tocco rapido (quando non si sta
 * digitando) o come suggerimento filtrato (mentre si digita): stesso
 * pulsante grande, pensato per il pollice su telefono/tablet, dove viene
 * usato quasi sempre questo registro. */
function NameChipButton({ name, onAdd }: { name: string; onAdd: (name: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(name)}
      className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors active:bg-muted sm:hover:border-primary/30 sm:hover:bg-muted"
    >
      <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
      {name}
    </button>
  );
}

/** Registro presenze del Minivolley: nessuna anagrafica da tenere
 * aggiornata prima. Pensato soprattutto per telefono/tablet durante
 * l'allenamento: di default mostra come tocchi rapidi i nomi già usati in
 * passato (i più frequenti prima), così la maggior parte delle volte non
 * serve scrivere nulla — solo per una prima volta o un nome nuovo si usa la
 * tastiera. Mai un elenco da spuntare uno per uno. */
export function MiniAttendanceForm({
  knownNames,
  initialPresentNames,
  sessionId,
  trainingRuleId,
  sessionDate,
  title,
  location,
}: {
  knownNames: string[];
  initialPresentNames: string[];
  sessionId?: string;
  trainingRuleId: string | null;
  sessionDate: string;
  title: string;
  location: string;
}) {
  const [present, setPresent] = useState<string[]>(() => initialPresentNames);
  const [query, setQuery] = useState("");
  const [state, formAction] = useActionState(saveMiniAttendanceAction, initialState);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableKnown = useMemo(
    () => knownNames.filter((name) => !present.includes(name)),
    [knownNames, present],
  );
  const filteredSuggestions = useMemo(() => suggestSimilarNames(query, availableKnown), [availableKnown, query]);

  function addName(raw: string) {
    const name = normalizePersonName(raw);
    if (!name) return;
    setPresent((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setQuery("");
  }

  function removeName(name: string) {
    setPresent((prev) => prev.filter((existing) => existing !== name));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addName(query);
    } else if (event.key === "Escape") {
      setQuery("");
      inputRef.current?.blur();
    }
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
      {trainingRuleId && <input type="hidden" name="trainingRuleId" value={trainingRuleId} />}
      <input type="hidden" name="sessionDate" value={sessionDate} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="presentNames" value={JSON.stringify(present)} />

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{present.length}</span> presenti
      </p>

      {present.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {present.map((name) => (
            <li
              key={name}
              className="flex items-center gap-1 rounded-full bg-primary/10 py-2 pl-4 pr-1.5 text-sm font-medium text-primary"
            >
              {name}
              <button
                type="button"
                onClick={() => removeName(name)}
                aria-label={`Rimuovi ${name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary/60 transition-colors active:bg-primary/20 sm:hover:bg-primary/15 sm:hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 focus-within:border-primary/40">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 shrink-0 text-foreground/35" />
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Scrivi un nome nuovo e premi Invio…"
            className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-foreground/35"
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => addName(query)}
              aria-label="Aggiungi"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors active:bg-primary/15 sm:hover:bg-primary/10"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {query.trim() ? (
        filteredSuggestions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
              Forse intendevi
            </p>
            <div className="flex flex-wrap gap-2">
              {filteredSuggestions.map((name) => (
                <NameChipButton key={name} name={name} onAdd={addName} />
              ))}
            </div>
          </div>
        )
      ) : (
        availableKnown.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
              Tocca per aggiungere
            </p>
            <div className="flex flex-wrap gap-2">
              {availableKnown.map((name) => (
                <NameChipButton key={name} name={name} onAdd={addName} />
              ))}
            </div>
          </div>
        )
      )}

      {present.length === 0 && availableKnown.length === 0 && (
        <p className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-muted-foreground">
          Nessun nome ancora aggiunto: scrivi qui sopra chi era presente.
        </p>
      )}

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
