"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldError, FieldHint } from "@/components/ui/Field";
import { CATEGORY_LABELS } from "@/lib/category";
import { saveMatchAction, type MatchFormState } from "./actions";
import type { Athlete, Match } from "@/lib/types";

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

const SET_OPTIONS = [0, 1, 2, 3];

export function MatchForm({ match, athletes = [] }: { match?: Match; athletes?: Athlete[] }) {
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

      {athletes.length > 0 && (
        <div>
          <Label>Convocate (opzionale)</Label>
          <div className="flex flex-wrap gap-2">
            {athletes.map((athlete) => (
              <label
                key={athlete.id}
                className="cursor-pointer rounded-full border border-border-subtle bg-surface px-3.5 py-1.5 text-sm font-medium text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white"
              >
                <input
                  type="checkbox"
                  name="calledUpAthleteIds"
                  value={athlete.id}
                  defaultChecked={match?.calledUpAthleteIds.includes(athlete.id) ?? false}
                  className="sr-only"
                />
                {athlete.fullName}
              </label>
            ))}
          </div>
          <FieldHint>Chi convochi qui diventa selezionabile nelle formazioni per set.</FieldHint>
        </div>
      )}

      {isPastMatch && (
        <div className="rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-3.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground/85">
            <Trophy className="h-4 w-4 text-sand-600" />
            Risultato finale
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Set vinti e persi da Volley Lignano. Lascia entrambi su &quot;—&quot; se non ancora
            disponibile.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="resultSetsWon">Set vinti</Label>
              <Select id="resultSetsWon" name="resultSetsWon" defaultValue={match?.resultSetsWon ?? ""}>
                <option value="">—</option>
                {SET_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="resultSetsLost">Set persi</Label>
              <Select id="resultSetsLost" name="resultSetsLost" defaultValue={match?.resultSetsLost ?? ""}>
                <option value="">—</option>
                {SET_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
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
