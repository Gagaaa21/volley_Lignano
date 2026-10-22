"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Save } from "lucide-react";
import { saveContactsAction, type ContactsFormState } from "@/app/admin/trasferte/rubrica/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { MAX_CONTACTS_PER_ATHLETE, type AthleteContact } from "@/lib/trips/types";

const initialState: ContactsFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} data-contacts-submit>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva i numeri"}
    </Button>
  );
}

/**
 * I numeri di chi chiamare per un'atleta: fino a quattro righe (nome, chi è, numero). Una riga lasciata vuota non conta;
 * togliere tutto cancella la rubrica dell'atleta.
 */
export function ContactsForm({ athleteId, contacts }: { athleteId: string; contacts: AthleteContact[] }) {
  const [state, formAction] = useActionState(saveContactsAction, initialState);
  // Dopo un errore i campi tornano com'erano stati scritti (React altrimenti li svuoterebbe).
  const typed = state.values;
  return (
    <form action={formAction} noValidate className="space-y-3" data-contacts-form={athleteId}>
      <input type="hidden" name="athleteId" value={athleteId} />
      {Array.from({ length: MAX_CONTACTS_PER_ATHLETE }, (_, index) => {
        const row = typed?.[index] ?? contacts[index];
        const n = index + 1;
        return (
          <div key={n} className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
            <div>
              <Label htmlFor={`${athleteId}-nome-${n}`} className={n > 1 ? "sr-only" : undefined}>
                Nome
              </Label>
              <Input
                id={`${athleteId}-nome-${n}`}
                name={`name${n}`}
                autoComplete="off"
                defaultValue={row?.name ?? ""}
                placeholder={n === 1 ? "Es. Giulia Bianchi" : "Altro nome"}
                aria-label={`Nome ${n}`}
              />
            </div>
            <div>
              <Label htmlFor={`${athleteId}-chi-${n}`} className={n > 1 ? "sr-only" : undefined}>
                Chi è
              </Label>
              <Input
                id={`${athleteId}-chi-${n}`}
                name={`relation${n}`}
                autoComplete="off"
                defaultValue={row?.relation ?? ""}
                placeholder={n === 1 ? "Es. mamma" : "Chi è"}
                aria-label={`Chi è ${n}`}
              />
            </div>
            <div>
              <Label htmlFor={`${athleteId}-tel-${n}`} className={n > 1 ? "sr-only" : undefined}>
                Numero
              </Label>
              <Input
                id={`${athleteId}-tel-${n}`}
                name={`phone${n}`}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                defaultValue={row?.phone ?? ""}
                placeholder="333 1234567"
                aria-label={`Numero ${n}`}
              />
            </div>
          </div>
        );
      })}

      {state.error && (
        <p role="alert" data-contacts-error className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        {state.savedAt && !state.error && (
          <span role="status" data-contacts-saved className="inline-flex items-center gap-1 text-sm font-semibold text-success">
            <Check className="h-4 w-4" />
            Salvato
          </span>
        )}
        <SubmitButton />
      </div>
    </form>
  );
}
