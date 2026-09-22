"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldError, FieldHint } from "@/components/ui/Field";
import { CATEGORY_LABELS } from "@/lib/category";
import { saveMatchAction, type MatchFormState } from "./actions";
import type { Match } from "@/lib/types";

const initialState: MatchFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva partita"}
    </Button>
  );
}

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const MAX_SETS = 5;

export function MatchForm({ match }: { match?: Match }) {
  const [state, formAction] = useActionState(saveMatchAction, initialState);
  const isPastMatch = Boolean(match && match.matchDate.slice(0, 10) <= todayStr());

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {match && <input type="hidden" name="id" value={match.id} />}

      <div>
        <Label htmlFor="category">Categoria</Label>
        <Select id="category" name="category" defaultValue={match?.category ?? "U15"} required>
          <option value="U14">{CATEGORY_LABELS.U14}</option>
          <option value="U15">{CATEGORY_LABELS.U15}</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="opponent">Squadra avversaria</Label>
        <Input
          id="opponent"
          name="opponent"
          defaultValue={match?.opponent}
          placeholder="Es. Pallavolo Udine"
          required
        />
      </div>

      <div>
        <Label>Casa o trasferta</Label>
        <div className="flex gap-2">
          <label className="flex-1 cursor-pointer rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-center text-sm font-semibold text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white">
            <input
              type="radio"
              name="isHome"
              value="home"
              defaultChecked={match ? match.isHome : true}
              className="sr-only"
            />
            Casa
          </label>
          <label className="flex-1 cursor-pointer rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-center text-sm font-semibold text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white">
            <input
              type="radio"
              name="isHome"
              value="away"
              defaultChecked={match ? !match.isHome : false}
              className="sr-only"
            />
            Trasferta
          </label>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-3 text-sm font-medium text-foreground/85">
        <input
          type="checkbox"
          name="isFriendly"
          defaultChecked={match?.isFriendly ?? false}
          className="h-4 w-4 shrink-0 rounded border-border-subtle accent-sea-700 focus:ring-sea-500"
        />
        Amichevole (non di campionato)
      </label>

      <div>
        <Label htmlFor="location">Luogo della partita</Label>
        <Input
          id="location"
          name="location"
          defaultValue={match?.location}
          placeholder="Es. Palestra Comunale, Lignano Sabbiadoro"
          required
        />
      </div>

      <div>
        <Label htmlFor="matchDate">Data e ora della partita</Label>
        <Input
          id="matchDate"
          name="matchDate"
          type="datetime-local"
          defaultValue={match?.matchDate}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="meetingTime">Ora di ritrovo (opzionale)</Label>
          <Input id="meetingTime" name="meetingTime" type="time" defaultValue={match?.meetingTime ?? ""} />
        </div>
        <div>
          <Label htmlFor="meetingLocation">Luogo di ritrovo (opzionale)</Label>
          <Input
            id="meetingLocation"
            name="meetingLocation"
            defaultValue={match?.meetingLocation ?? ""}
            placeholder="Se diverso dal luogo della partita"
          />
        </div>
      </div>
      <FieldHint>Lascia vuoti se il ritrovo coincide con orario e luogo della partita.</FieldHint>

      <div>
        <Label htmlFor="notes">Note (opzionale)</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={match?.notes ?? ""}
          placeholder="Es. Portare la seconda maglia…"
        />
      </div>

      {isPastMatch && (
        <div className="rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-3.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground/85">
            <Trophy className="h-4 w-4 text-sand-600" />
            Risultato finale
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Inserisci i punti dei singoli set. Lascia in bianco i set non giocati: set vinti e
            persi vengono calcolati automaticamente.
          </p>
          <div className="mt-3 flex items-center gap-3 pl-14 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
            <span className="w-14 text-center">Lignano</span>
            <span className="w-3" />
            <span className="w-14 text-center">Avv.</span>
          </div>
          <div className="mt-1.5 space-y-2">
            {Array.from({ length: MAX_SETS }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-sm font-medium text-foreground/60">Set {i + 1}</span>
                <Input
                  type="number"
                  name="setUs"
                  min={0}
                  max={99}
                  defaultValue={match?.setScores?.[i]?.us ?? ""}
                  className="w-14 px-2 text-center"
                  aria-label={`Punti Lignano, set ${i + 1}`}
                />
                <span className="text-foreground/40">–</span>
                <Input
                  type="number"
                  name="setThem"
                  min={0}
                  max={99}
                  defaultValue={match?.setScores?.[i]?.them ?? ""}
                  className="w-14 px-2 text-center"
                  aria-label={`Punti avversario, set ${i + 1}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {state.error && (
        <div className="rounded-xl bg-red-50 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
