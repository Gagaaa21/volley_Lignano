"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Clock, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint } from "@/components/ui/Field";
import { WeekdayPicker } from "@/components/forms/WeekdayPicker";
import { cn } from "@/lib/cn";
import { saveTrainingAction, type TrainingFormState } from "./actions";
import type { TrainingBlock, TrainingRepeat, TrainingRule } from "@/lib/types";

const initialState: TrainingFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva allenamento"}
    </Button>
  );
}

export function TrainingForm({
  training,
  blocks = [],
  selectedBlockIds = [],
}: {
  training?: TrainingRule;
  blocks?: TrainingBlock[];
  selectedBlockIds?: string[];
}) {
  const [state, formAction] = useActionState(saveTrainingAction, initialState);
  const [repeat, setRepeat] = useState<TrainingRepeat>(training?.repeat ?? "weekly");
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {training && <input type="hidden" name="id" value={training.id} />}

      <div>
        <Label htmlFor="title">Titolo</Label>
        <Input id="title" name="title" defaultValue={training?.title ?? "Allenamento"} required />
      </div>

      <div>
        <Label htmlFor="location">Luogo</Label>
        <Input
          id="location"
          name="location"
          defaultValue={training?.location}
          placeholder="Es. Palestra Comunale, Lignano Sabbiadoro"
          required
        />
      </div>

      <div>
        <Label>Ripetizione</Label>
        <div className="flex gap-2">
          <label
            className="flex-1 cursor-pointer rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 text-center text-sm font-semibold text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white"
          >
            <input
              type="radio"
              name="repeat"
              value="weekly"
              checked={repeat === "weekly"}
              onChange={() => setRepeat("weekly")}
              className="sr-only"
            />
            Settimanale
          </label>
          <label
            className="flex-1 cursor-pointer rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 text-center text-sm font-semibold text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white"
          >
            <input
              type="radio"
              name="repeat"
              value="once"
              checked={repeat === "once"}
              onChange={() => setRepeat("once")}
              className="sr-only"
            />
            Singolo giorno
          </label>
        </div>
      </div>

      {repeat === "weekly" ? (
        <div>
          <Label>Giorni della settimana</Label>
          <WeekdayPicker selected={training?.weekdays} />
          <FieldHint>L&apos;allenamento si ripete ogni settimana nei giorni selezionati.</FieldHint>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startTime">Ora inizio</Label>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={training?.startTime ?? "18:30"}
            required
          />
        </div>
        <div>
          <Label htmlFor="endTime">Ora fine</Label>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue={training?.endTime ?? "20:30"}
            required
          />
        </div>
      </div>

      {repeat === "once" ? (
        <div>
          <Label htmlFor="startDate">Data</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={training?.startDate ?? todayStr}
            required
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Valido dal</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={training?.startDate ?? todayStr}
              required
            />
          </div>
          <div>
            <Label htmlFor="endDate">Valido fino al (opzionale)</Label>
            <Input id="endDate" name="endDate" type="date" defaultValue={training?.endDate ?? ""} />
            <FieldHint>Lascia vuoto per un allenamento senza scadenza.</FieldHint>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <Label>Blocchi allenamento (opzionale)</Label>
          <Link
            href="/admin/schede/blocchi/nuovo"
            className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Plus className="h-3 w-3" />
            Nuovo blocco
          </Link>
        </div>
        {blocks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-subtle bg-surface px-3.5 py-3 text-sm text-foreground/50">
            Nessun blocco in libreria.{" "}
            <Link href="/admin/schede/blocchi/nuovo" className="font-semibold text-primary hover:underline">
              Creane uno
            </Link>{" "}
            per poterlo scegliere qui.
          </p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border-subtle bg-surface p-2">
            {blocks.map((block) => (
              <label
                key={block.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors has-[:checked]:bg-primary/8"
              >
                <input
                  type="checkbox"
                  name="blockIds"
                  value={block.id}
                  defaultChecked={selectedBlockIds.includes(block.id)}
                  className="h-4 w-4 shrink-0 rounded border-border-subtle accent-sea-700 focus:ring-sea-500"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/85">
                  {block.title}
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-[var(--color-training-strong)]",
                    "bg-[var(--color-training-soft)]",
                  )}
                >
                  <Clock className="h-2.5 w-2.5" />
                  {block.durationMinutes}&apos;
                </span>
              </label>
            ))}
          </div>
        )}
        <FieldHint>
          Scegli i blocchi già pronti nella libreria da usare in questo allenamento: modificarli in
          seguito aggiorna il contenuto ovunque vengano usati.
        </FieldHint>
      </div>

      <div>
        <Label htmlFor="notes">Note (opzionale)</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={training?.notes ?? ""}
          placeholder="Es. Portare ginocchiere, lavoro su battuta e ricezione…"
        />
      </div>

      <label className="flex items-center gap-2.5 text-sm font-medium text-foreground/80">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={training?.isActive ?? true}
          className="h-4 w-4 rounded border-border-subtle accent-sea-700 focus:ring-sea-500"
        />
        Allenamento attivo (visibile nel calendario pubblico)
      </label>

      {state.error && (
        <div className="rounded-xl bg-red-50 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
