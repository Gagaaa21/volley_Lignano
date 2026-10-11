"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { jerseyText, parseJerseyNumber } from "@/lib/jersey";
import { setAthleteJerseyAction } from "./actions";

/**
 * Il numero di maglia di un'atleta nell'elenco: si scrive qui e si salva da
 * solo quando si esce dal campo (o con Invio). Se un'altra atleta attiva della
 * stessa categoria ha lo stesso numero il bordo si colora, senza impedirlo.
 */
export function JerseyEditor({
  athleteId,
  name,
  value,
  sharedWith,
}: {
  athleteId: string;
  name: string;
  /** Il numero salvato. */
  value: number | null;
  /** Le altre atlete (stessa categoria) che hanno lo stesso numero. */
  sharedWith: string[];
}) {
  const [text, setText] = useState(jerseyText(value));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const parsed = parseJerseyNumber(text);
    if (parsed === undefined) {
      setError("Scrivi un numero da 0 a 99.");
      return;
    }
    if (parsed === value) {
      setError(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setAthleteJerseyAction(athleteId, text);
      if (!result.ok) setError(result.error);
    });
  }

  const shared = sharedWith.length > 0;
  return (
    <div className="relative shrink-0">
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value.replace(/\D/g, "").slice(0, 2));
          setError(null);
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        inputMode="numeric"
        maxLength={2}
        placeholder="N°"
        aria-label={`Numero di maglia di ${name}`}
        aria-invalid={Boolean(error)}
        title={error ?? (shared ? `Lo ha anche ${sharedWith.join(", ")}` : "Numero di maglia")}
        data-jersey-input={name}
        className={cn(
          "tabular h-9 w-12 rounded-lg border bg-surface px-1 text-center text-base font-bold text-foreground placeholder:font-semibold placeholder:text-foreground/30 transition-colors focus:outline-none focus:ring-4 focus:ring-primary/12 sm:text-sm",
          error ? "border-destructive" : shared ? "border-warning" : "border-input focus:border-primary",
          pending && "opacity-60",
        )}
      />
      {error && (
        <p role="alert" className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg bg-destructive px-2.5 py-1.5 text-left text-xs font-medium text-white shadow-lg">
          {error}
        </p>
      )}
    </div>
  );
}
