"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint, FormActions, FormSection, RadioSegment, Toggle } from "@/components/ui/Field";
import { WeekdayPicker } from "@/components/forms/WeekdayPicker";
import { cn } from "@/lib/cn";
import { trainingDotClass, TRAINING_COLOR_LABELS } from "@/lib/category";
import { saveTrainingAction, type TrainingFormState } from "./actions";
import { DEFAULT_TRAINING_COLOR, TRAINING_COLORS, type TrainingColor, type TrainingRepeat, type TrainingRule, type TrainingTeam } from "@/lib/types";

const initialState: TrainingFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva allenamento"}
    </Button>
  );
}

export function TrainingForm({
  training,
  team = "u14u15",
  allowTournament = false,
  defaultIsTournament = false,
}: {
  training?: TrainingRule;
  team?: TrainingTeam;
  allowTournament?: boolean;
  defaultIsTournament?: boolean;
}) {
  const [state, formAction] = useActionState(saveTrainingAction, initialState);
  const values = state.values;
  const [repeat, setRepeat] = useState<TrainingRepeat>(
    (values?.repeat as TrainingRepeat | undefined) ??
      training?.repeat ??
      (defaultIsTournament ? "once" : "weekly"),
  );
  const [color, setColor] = useState<TrainingColor>(
    (values?.color as TrainingColor | undefined) ?? training?.color ?? DEFAULT_TRAINING_COLOR,
  );
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} noValidate>
      {training && <input type="hidden" name="id" value={training.id} />}
      <input type="hidden" name="team" value={training?.team ?? team} />

      <FormSection title="Informazioni" description="Come compare nel calendario pubblico.">
        <div>
          <Label htmlFor="title">Titolo</Label>
          <Input id="title" name="title" defaultValue={values?.title ?? training?.title ?? "Allenamento"} required />
        </div>

        <div>
          <Label htmlFor="location">Luogo</Label>
          <Input
            id="location"
            name="location"
            defaultValue={values?.location ?? training?.location}
            placeholder="Es. Palestra Comunale, Lignano Sabbiadoro"
            required
          />
        </div>

        <div>
          <Label>Colore</Label>
          <div className="flex flex-wrap gap-2">
            {TRAINING_COLORS.map((c) => (
              <label
                key={c}
                className="cursor-pointer rounded-full p-0.5 ring-offset-2 ring-offset-card transition-shadow has-[:checked]:ring-2 has-[:checked]:ring-foreground/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              >
                <input
                  type="radio"
                  name="color"
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                  aria-label={TRAINING_COLOR_LABELS[c]}
                  className="sr-only"
                />
                <span
                  className={cn("flex h-8 w-8 items-center justify-center rounded-full", trainingDotClass(c))}
                  title={TRAINING_COLOR_LABELS[c]}
                >
                  {color === c && <Check className="h-4 w-4 text-white" />}
                </span>
              </label>
            ))}
          </div>
          <FieldHint>Per distinguere questo allenamento dagli altri sul calendario.</FieldHint>
        </div>
      </FormSection>

      <FormSection title="Quando" description="Ogni settimana nei giorni scelti, oppure una volta sola.">
        <div>
          <Label>Ripetizione</Label>
          <RadioSegment
            name="repeat"
            value={repeat}
            onChange={setRepeat}
            options={[
              { value: "weekly", label: "Settimanale" },
              { value: "once", label: "Singolo giorno" },
            ]}
          />
        </div>

        {repeat === "weekly" ? (
          <div>
            <Label>Giorni della settimana</Label>
            <WeekdayPicker selected={values?.weekdays ?? training?.weekdays} />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startTime">Ora inizio</Label>
            <Input
              id="startTime"
              name="startTime"
              type="time"
              defaultValue={values?.startTime || training?.startTime || "18:30"}
              required
            />
          </div>
          <div>
            <Label htmlFor="endTime">Ora fine</Label>
            <Input
              id="endTime"
              name="endTime"
              type="time"
              defaultValue={values?.endTime || training?.endTime || "20:30"}
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
              defaultValue={values?.startDate || training?.startDate || todayStr}
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
                defaultValue={values?.startDate || training?.startDate || todayStr}
                required
              />
            </div>
            <div>
              <Label htmlFor="endDate">Fino al (opzionale)</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={values?.endDate ?? training?.endDate ?? ""} />
            </div>
          </div>
        )}
        {repeat === "weekly" && <FieldHint>Lascia vuota la data di fine per un allenamento senza scadenza.</FieldHint>}
      </FormSection>

      <FormSection title="Altro">
        <div>
          <Label htmlFor="notes">Note (opzionale)</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={values?.notes ?? training?.notes ?? ""}
            placeholder="Es. Portare ginocchiere, lavoro su battuta e ricezione…"
          />
        </div>

        <div className="space-y-2">
          {allowTournament && (
            <Toggle
              name="isTournament"
              label="Torneo"
              description="Giornata multi-club, senza un avversario singolo."
              defaultChecked={values?.isTournament ?? training?.isTournament ?? defaultIsTournament}
              onChange={(e) => {
                if (e.target.checked) setRepeat("once");
              }}
            />
          )}
          <Toggle
            name="isActive"
            label="Allenamento attivo"
            description="Visibile nel calendario pubblico."
            defaultChecked={values?.isActive ?? training?.isActive ?? true}
          />
          <Toggle name="notify" label="Invia notifica push" description="A chi segue il calendario." defaultChecked />
        </div>
      </FormSection>

      {state.error && (
        <div className="mb-4 rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <FormActions>
        <SubmitButton />
      </FormActions>
    </form>
  );
}
