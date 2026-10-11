"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldError, FieldHint, FormActions, Toggle } from "@/components/ui/Field";
import { CATEGORY_LABELS, MINIVOLLEY_GROUP_LABELS } from "@/lib/category";
import { jerseyText, parseJerseyNumber } from "@/lib/jersey";
import { saveAthleteAction, type AthleteFormState } from "./actions";
import type { Athlete, Category, TrainingTeam } from "@/lib/types";

/** Un'altra atleta attiva che ha già un numero di maglia: serve ad avvisare se si sceglie lo stesso. */
export interface TakenJersey {
  name: string;
  category: Category | null;
  jerseyNumber: number;
}

const initialState: AthleteFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva atleta"}
    </Button>
  );
}

/** Numero di maglia: solo cifre, e se un'altra atleta ha già lo stesso lo dice (senza vietarlo). */
function JerseyNumberField({ defaultValue, taken }: { defaultValue: number | null; taken: TakenJersey[] }) {
  const [text, setText] = useState(jerseyText(defaultValue));
  const parsed = parseJerseyNumber(text);
  const sharedWith = typeof parsed === "number" ? taken.filter((other) => other.jerseyNumber === parsed) : [];
  return (
    <div className="sm:max-w-xs">
      <Label htmlFor="jerseyNumber">Numero di maglia (opzionale)</Label>
      <Input
        id="jerseyNumber"
        name="jerseyNumber"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 2))}
        inputMode="numeric"
        maxLength={2}
        placeholder="Es. 7"
        className="w-28 text-center font-bold tabular-nums"
      />
      {sharedWith.length > 0 ? (
        <p role="status" className="mt-1.5 text-xs leading-relaxed text-warning" data-jersey-shared>
          Il {parsed} ce l&apos;ha già {sharedWith.map((o) => (o.category ? `${o.name} (${o.category})` : o.name)).join(", ")}. Va bene se
          giocano in categorie diverse; in una stessa partita però due maglie uguali non si possono usare.
        </p>
      ) : (
        <FieldHint>Lo scrivi una volta qui e lo Scout e il Live score lo ritrovano da soli.</FieldHint>
      )}
    </div>
  );
}

export function AthleteForm({ athlete, team, taken = [] }: { athlete?: Athlete; team: TrainingTeam; taken?: TakenJersey[] }) {
  const [state, formAction] = useActionState(saveAthleteAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {athlete && <input type="hidden" name="id" value={athlete.id} />}

      <div>
        <Label htmlFor="fullName">Nome e cognome</Label>
        <Input id="fullName" name="fullName" defaultValue={athlete?.fullName} placeholder="Es. Giulia Bianchi" required />
      </div>

      {team === "u14u15" ? (
        <>
          <div className="sm:max-w-xs">
            <Label htmlFor="category">Categoria (opzionale)</Label>
            <Select id="category" name="category" defaultValue={athlete?.category ?? ""}>
              <option value="">Nessuna categoria</option>
              <option value="U14">{CATEGORY_LABELS.U14}</option>
              <option value="U15">{CATEGORY_LABELS.U15}</option>
            </Select>
          </div>
          <JerseyNumberField defaultValue={athlete?.jerseyNumber ?? null} taken={taken} />
        </>
      ) : (
        <div className="sm:max-w-xs">
          <Label htmlFor="group">Gruppo (opzionale)</Label>
          <Select id="group" name="group" defaultValue={athlete?.group ?? ""}>
            <option value="">Nessun gruppo</option>
            <option value="lignano">{MINIVOLLEY_GROUP_LABELS.lignano}</option>
            <option value="san_michele">{MINIVOLLEY_GROUP_LABELS.san_michele}</option>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="notes">Note (opzionale)</Label>
        <Textarea id="notes" name="notes" defaultValue={athlete?.notes ?? ""} rows={3} />
      </div>

      <Toggle
        name="isActive"
        label="Atleta attiva"
        description="Compare nel registro presenze."
        defaultChecked={athlete?.isActive ?? true}
      />

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <FormActions>
        <SubmitButton />
      </FormActions>
    </form>
  );
}
