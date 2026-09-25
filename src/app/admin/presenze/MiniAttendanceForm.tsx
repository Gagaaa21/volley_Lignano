"use client";

import { useActionState, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Save, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import { saveMiniAttendanceAction, type MiniAttendanceFormState } from "./actions";
import type { Athlete } from "@/lib/types";

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

/** Registro presenze del Minivolley: niente elenco con spunte su ogni
 * atleta, solo un piccolo elenco libero costruito aggiungendo un nome alla
 * volta, con suggerimenti dall'anagrafica mentre si scrive. */
export function MiniAttendanceForm({
  athletes,
  initialPresentIds,
  sessionId,
  trainingRuleId,
  sessionDate,
  title,
  location,
}: {
  athletes: Athlete[];
  initialPresentIds: string[];
  sessionId?: string;
  trainingRuleId: string | null;
  sessionDate: string;
  title: string;
  location: string;
}) {
  const [presentIds, setPresentIds] = useState<string[]>(() =>
    initialPresentIds.filter((id) => athletes.some((a) => a.id === id)),
  );
  const [query, setQuery] = useState("");
  const [state, formAction] = useActionState(saveMiniAttendanceAction, initialState);
  const inputRef = useRef<HTMLInputElement>(null);

  const athleteById = useMemo(() => new Map(athletes.map((a) => [a.id, a] as const)), [athletes]);
  const present = presentIds.map((id) => athleteById.get(id)).filter((a): a is Athlete => Boolean(a));

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return athletes
      .filter((a) => !presentIds.includes(a.id) && a.fullName.toLowerCase().includes(q))
      .slice(0, 6);
  }, [athletes, presentIds, query]);

  function addAthlete(id: string) {
    setPresentIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setQuery("");
    inputRef.current?.focus();
  }

  function removeAthlete(id: string) {
    setPresentIds((prev) => prev.filter((existingId) => existingId !== id));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (suggestions[0]) addAthlete(suggestions[0].id);
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
      <input type="hidden" name="presentAthleteIds" value={presentIds.join(",")} />

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{present.length}</span> presenti su{" "}
        {athletes.length} in anagrafica
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
            placeholder="Scrivi il nome di chi era presente…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/35"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-[0_20px_50px_-20px_rgba(9,27,38,0.35)]">
            {suggestions.map((athlete) => (
              <button
                key={athlete.id}
                type="button"
                onClick={() => addAthlete(athlete.id)}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                {athlete.fullName}
              </button>
            ))}
          </div>
        )}
      </div>

      {present.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-muted-foreground">
          Nessuna atleta ancora aggiunta: scrivi un nome qui sopra.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {present.map((athlete) => (
            <li
              key={athlete.id}
              className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1.5 pl-3.5 pr-2 text-sm font-medium text-primary"
            >
              {athlete.fullName}
              <button
                type="button"
                onClick={() => removeAthlete(athlete.id)}
                aria-label={`Rimuovi ${athlete.fullName}`}
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
