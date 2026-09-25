"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint } from "@/components/ui/Field";
import { sendManualNotificationAction, type ManualNotificationState } from "./actions";

const initialState: ManualNotificationState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Send className="h-4 w-4" />
      {pending ? "Invio…" : "Invia notifica"}
    </Button>
  );
}

export function NotificationForm({
  u14u15Subscribers,
  minivolleySubscribers,
  adminSubscribers,
}: {
  u14u15Subscribers: number;
  minivolleySubscribers: number;
  adminSubscribers: number;
}) {
  const [state, formAction] = useActionState(sendManualNotificationAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="title">Titolo</Label>
        <Input id="title" name="title" defaultValue="Convocazioni disponibili" required />
      </div>

      <div>
        <Label htmlFor="body">Testo</Label>
        <Textarea
          id="body"
          name="body"
          defaultValue="Le convocazioni per la partita del 27 sono disponibili."
          required
        />
      </div>

      <div>
        <Label>Destinatari</Label>
        <div className="flex flex-wrap gap-2">
          <label className="flex-1 cursor-pointer rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-center text-sm font-semibold text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white">
            <input type="radio" name="audience" value="all-u14u15" defaultChecked className="sr-only" />
            Tutti U14/U15 ({u14u15Subscribers})
          </label>
          <label className="flex-1 cursor-pointer rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-center text-sm font-semibold text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white">
            <input type="radio" name="audience" value="all-minivolley" className="sr-only" />
            Tutti Minivolley ({minivolleySubscribers})
          </label>
          <label className="flex-1 cursor-pointer rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-center text-sm font-semibold text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white">
            <input type="radio" name="audience" value="admins" className="sr-only" />
            Solo Admin ({adminSubscribers})
          </label>
        </div>
        <FieldHint>
          Tutti U14/U15 o Tutti Minivolley: genitori e atlete iscritti alle notifiche di quella
          squadra. Solo Admin: tutti gli account Admin registrati, a prescindere dalla squadra.
        </FieldHint>
      </div>

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}
      {state.success && (
        <p className="text-sm font-medium text-primary">
          Notifica inviata a {state.sentTo} dispositiv{state.sentTo === 1 ? "o" : "i"}.
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
