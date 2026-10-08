"use client";

import { useActionState, useState } from "react";
import { CalendarClock, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Toggle } from "@/components/ui/Field";
import { saveOccurrenceOverrideAction, type OccurrenceOverrideState } from "./actions";

interface Schedule {
  startTime: string;
  endTime: string;
  location: string;
}

const initialState: OccurrenceOverrideState = {};

/**
 * Orario e luogo di un allenamento ricorrente solo per un giorno: quella data
 * si sposta (es. dalle 17:30 alle 19:30 alle Medie invece che al Palazzetto),
 * tutte le altre della serie restano come sono.
 */
export function OccurrenceOverrideForm({
  ruleId,
  date,
  current,
  usual,
  locationSuggestions,
}: {
  ruleId: string;
  date: string;
  /** Orario e luogo di questo giorno (cambiati o di sempre). */
  current: Schedule;
  /** Orario e luogo di sempre, se questo giorno è cambiato; altrimenti null. */
  usual: Schedule | null;
  locationSuggestions: string[];
}) {
  const [state, formAction, pending] = useActionState(saveOccurrenceOverrideAction, initialState);
  const [startTime, setStartTime] = useState(current.startTime);
  const [endTime, setEndTime] = useState(current.endTime);
  const [location, setLocation] = useState(current.location);

  // Dopo un salvataggio la pagina arriva con i valori nuovi: i campi li seguono.
  const currentKey = `${current.startTime}|${current.endTime}|${current.location}`;
  const [syncedKey, setSyncedKey] = useState(currentKey);
  if (currentKey !== syncedKey) {
    setSyncedKey(currentKey);
    setStartTime(current.startTime);
    setEndTime(current.endTime);
    setLocation(current.location);
  }

  const listId = `locations-${ruleId}`;

  return (
    <form action={formAction} className="space-y-4" data-occurrence-override>
      <input type="hidden" name="ruleId" value={ruleId} />
      <input type="hidden" name="date" value={date} />

      <div className="flex items-start gap-3">
        <span className="icon-chip">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-bold leading-tight text-foreground">Orario e luogo di questo giorno</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Cambia solo questa data: le altre della serie restano come sono.
          </p>
        </div>
      </div>

      {usual && (
        <p className="rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning" data-occurrence-usual>
          <span className="font-semibold">Cambiato solo per questo giorno.</span> Di solito: {usual.startTime}–
          {usual.endTime} · {usual.location}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="override-start">Ora inizio</Label>
          <Input
            id="override-start"
            name="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="override-end">Ora fine</Label>
          <Input
            id="override-end"
            name="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="override-location">Luogo</Label>
        <Input
          id="override-location"
          name="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          list={listId}
          placeholder="Es. Palestra delle Medie"
          required
        />
        <datalist id={listId}>
          {locationSuggestions.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      <Toggle
        name="notify"
        defaultChecked
        label="Avvisa con una notifica"
        description="Chi segue il calendario riceve il nuovo orario e luogo di questo giorno."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" name="intent" value="save" disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? "Salvo…" : "Salva solo per questo giorno"}
        </Button>
        {usual && (
          <Button type="submit" name="intent" value="reset" variant="outline" disabled={pending}>
            <RotateCcw className="h-4 w-4" />
            Torna all&apos;orario di sempre
          </Button>
        )}
      </div>

      {state.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}
      {state.message && (
        <p className="text-sm font-medium text-success" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
