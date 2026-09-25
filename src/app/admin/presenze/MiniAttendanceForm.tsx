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
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva presenze"}
    </Button>
  );
}

/** Registro presenze del Minivolley: nessuna anagrafica da tenere
 * aggiornata prima. Lo staff scrive a mano chi era presente allenamento
 * per allenamento; i nomi usati in passato (per questa squadra) vengono
 * suggeriti mentre si scrive, solo per evitare refusi che spezzerebbero il
 * conteggio della stessa persona in due — mai un elenco da spuntare. */
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

  const suggestions = useMemo(() => {
    const pool = knownNames.filter((name) => !present.includes(name));
    return suggestSimilarNames(query, pool);
  }, [knownNames, present, query]);

  function addName(raw: string) {
    const name = normalizePersonName(raw);
    if (!name) return;
    setPresent((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setQuery("");
    inputRef.current?.focus();
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

      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 focus-within:border-primary/40">
          <UserPlus className="h-4 w-4 shrink-0 text-foreground/35" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Scrivi un nome e premi Invio…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/35"
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => addName(query)}
              aria-label="Aggiungi"
              className="shrink-0 rounded-full p-1 text-primary transition-colors hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-[0_20px_50px_-20px_rgba(9,27,38,0.35)]">
            <p className="border-b border-border-subtle px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground/40">
              Forse intendevi
            </p>
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => addName(name)}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {present.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-muted-foreground">
          Nessun nome ancora aggiunto: scrivi qui sopra chi era presente.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {present.map((name) => (
            <li
              key={name}
              className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1.5 pl-3.5 pr-2 text-sm font-medium text-primary"
            >
              {name}
              <button
                type="button"
                onClick={() => removeName(name)}
                aria-label={`Rimuovi ${name}`}
                className="rounded-full p-0.5 text-primary/60 transition-colors hover:bg-primary/15 hover:text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
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
