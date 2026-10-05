"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import { requestNotificationPromptAction, type NotificationPromptState } from "./actions";

const initialState: NotificationPromptState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <BellRing className="h-4 w-4" />
      {pending ? "Invio…" : "Chiedi a tutti di attivare le notifiche"}
    </Button>
  );
}

/** Pulsante «Chiedi a tutti di attivare le notifiche»: dopo l'invio resta un
 * messaggio di conferma; l'ultima richiesta compare nella riga sopra (la
 * pagina si aggiorna da sola). */
export function NotificationPromptForm() {
  const [state, formAction] = useActionState(requestNotificationPromptAction, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <SubmitButton />
      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}
      {state.success && (
        <p className="text-sm font-medium text-success" role="status">
          Richiesta inviata: chi apre il sito e non ha ancora attivato le notifiche vedrà il messaggio.
        </p>
      )}
    </form>
  );
}
