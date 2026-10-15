"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { parseClockTime } from "@/lib/clockTime";
import { cn } from "@/lib/cn";
import { Input } from "./Field";

/**
 * Un'ora facoltativa che si scrive e si può togliere. Il selettore nativo (`type="time"`) su iPad e telefono non ha modo di
 * svuotare il campo e in alcuni browser non si apre: qui si scrive con la tastiera dei numeri (1730, 17.30 e 17:30 diventano
 * 17:30 appena si esce dal campo) e la X a destra toglie l'ora. Il valore è controllato da chi lo usa (`value`/`onChange`),
 * così può proporre anche orari già pronti. Vuoto = nessuna ora; il server rilegge comunque quel che arriva (`parseClockTime`).
 */
export function TimeField({
  id,
  name,
  value,
  onChange,
  clearLabel = "Togli l'ora",
  className,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Nome accessibile del pulsante X. */
  clearLabel?: string;
  className?: string;
}) {
  const [invalid, setInvalid] = useState(false);
  const errorId = `${id}-errore`;

  function settle() {
    const parsed = parseClockTime(value);
    if (parsed.ok) {
      setInvalid(false);
      onChange(parsed.value ?? "");
    } else {
      setInvalid(true);
    }
  }

  return (
    <div className={className}>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder="17:30"
          value={value}
          onChange={(e) => {
            setInvalid(false);
            onChange(e.target.value);
          }}
          onBlur={settle}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn("tabular pr-11", invalid && "border-destructive focus:border-destructive focus:ring-destructive/15")}
        />
        {value !== "" && (
          <button
            type="button"
            aria-label={clearLabel}
            title={clearLabel}
            data-time-clear
            // Il tocco non deve togliere il fuoco dal campo prima del click (sul telefono chiuderebbe la tastiera per niente).
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setInvalid(false);
              onChange("");
            }}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {invalid && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          Non è un&apos;ora: scrivila così, 17:30.
        </p>
      )}
    </div>
  );
}
