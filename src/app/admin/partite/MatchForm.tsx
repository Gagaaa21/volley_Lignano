"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint, FormActions, FormSection, RadioSegment, Toggle } from "@/components/ui/Field";
import {
  TournamentGamesEditor,
  tournamentGamesToFormState,
  type TournamentGameFormState,
} from "@/components/admin/TournamentGamesEditor";
import { CATEGORY_LABELS } from "@/lib/category";
import { saveMatchAction, type MatchFormState } from "./actions";
import type { Match, TrainingTeam } from "@/lib/types";

const initialState: MatchFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
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

export function MatchForm({ match, team = "u14u15" }: { match?: Match; team?: TrainingTeam }) {
  const [state, formAction] = useActionState(saveMatchAction, initialState);
  const [isTournament, setIsTournament] = useState(match?.isTournament ?? false);
  const [tournamentGames, setTournamentGames] = useState<TournamentGameFormState[]>(() =>
    tournamentGamesToFormState(match?.tournamentGames),
  );
  const isPastMatch = Boolean(match && match.matchDate.slice(0, 10) <= todayStr());
  const effectiveTeam = match?.team ?? team;

  return (
    <form action={formAction} noValidate>
      {match && <input type="hidden" name="id" value={match.id} />}
      <input type="hidden" name="team" value={effectiveTeam} />

      <FormSection title="Partita" description="Chi gioca, contro chi e dove.">
        {effectiveTeam === "u14u15" && (
          <div>
            <Label>Categoria</Label>
            <RadioSegment
              name="category"
              defaultValue={match?.category ?? "U15"}
              options={[
                { value: "U14", label: CATEGORY_LABELS.U14 },
                { value: "U15", label: CATEGORY_LABELS.U15 },
              ]}
            />
          </div>
        )}

        <div>
          <Label htmlFor="opponent">{isTournament ? "Torneo / squadre coinvolte" : "Squadra avversaria"}</Label>
          <Input
            id="opponent"
            name="opponent"
            defaultValue={match?.opponent}
            placeholder={isTournament ? "Es. Triangolare con Latisana e Concordia" : "Es. Pallavolo Udine"}
            required
          />
          {isTournament && (
            <FieldHint>
              Scrivi il nome del torneo o le squadre coinvolte: verrà mostrato così com&apos;è, senza anteporre
              &quot;vs&quot;.
            </FieldHint>
          )}
        </div>

        <div>
          <Label>Casa o trasferta</Label>
          <RadioSegment
            name="isHome"
            defaultValue={match ? (match.isHome ? "home" : "away") : "home"}
            options={[
              { value: "home", label: "Casa" },
              { value: "away", label: "Trasferta" },
            ]}
          />
        </div>

        <div className="space-y-2">
          <Toggle
            name="isFriendly"
            label="Amichevole"
            description="Non di campionato: non conta nel bilancio stagione."
            defaultChecked={match?.isFriendly ?? false}
          />
          <Toggle
            name="isTournament"
            label="Torneo"
            description="Più squadre coinvolte, es. un triangolare."
            checked={isTournament}
            onChange={(e) => setIsTournament(e.target.checked)}
          />
        </div>
      </FormSection>

      <FormSection title="Quando e dove">
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
          <Label htmlFor="matchDate">Data e ora</Label>
          <Input id="matchDate" name="matchDate" type="datetime-local" defaultValue={match?.matchDate} required />
        </div>

        <div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div>
              <Label htmlFor="meetingTime">Ora ritrovo</Label>
              <Input id="meetingTime" name="meetingTime" type="time" defaultValue={match?.meetingTime ?? ""} />
            </div>
            <div>
              <Label htmlFor="meetingLocation">Luogo ritrovo</Label>
              <Input
                id="meetingLocation"
                name="meetingLocation"
                defaultValue={match?.meetingLocation ?? ""}
                placeholder="Se diverso dal luogo della partita"
              />
            </div>
          </div>
          <FieldHint>Facoltativi: lasciali vuoti se il ritrovo coincide con orario e luogo della partita.</FieldHint>
        </div>
      </FormSection>

      {isPastMatch && isTournament && (
        <FormSection title="Risultati" description="Una partita per ogni avversaria affrontata.">
          <TournamentGamesEditor
            games={tournamentGames}
            onChange={setTournamentGames}
            hiddenFieldName="tournamentGames"
            title="Risultati del torneo"
            hint="Lascia in bianco i set non giocati, o l'intera partita se non conosci ancora il risultato: set vinti e persi vengono calcolati automaticamente."
          />
        </FormSection>
      )}

      {isPastMatch && !isTournament && (
        <FormSection
          title="Risultato finale"
          description="Punti dei singoli set; quelli non giocati restano vuoti. Set vinti e persi si calcolano da soli."
        >
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface-muted p-3 sm:p-4">
            <div className="grid min-w-[19rem] grid-cols-[5.5rem_repeat(5,minmax(0,1fr))] items-center gap-1.5">
              <span />
              {Array.from({ length: MAX_SETS }, (_, i) => (
                <span key={i} className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Set {i + 1}
                </span>
              ))}
              <span className="text-sm font-semibold text-foreground">Lignano</span>
              {Array.from({ length: MAX_SETS }, (_, i) => (
                <Input
                  key={`us-${i}`}
                  type="number"
                  name="setUs"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  defaultValue={match?.setScores?.[i]?.us ?? ""}
                  className="tabular px-1 text-center font-semibold"
                  aria-label={`Punti Lignano, set ${i + 1}`}
                />
              ))}
              <span className="text-sm font-semibold text-muted-foreground">Avversaria</span>
              {Array.from({ length: MAX_SETS }, (_, i) => (
                <Input
                  key={`them-${i}`}
                  type="number"
                  name="setThem"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  defaultValue={match?.setScores?.[i]?.them ?? ""}
                  className="tabular px-1 text-center"
                  aria-label={`Punti avversario, set ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </FormSection>
      )}

      <FormSection title="Altro">
        <div>
          <Label htmlFor="notes">Note (opzionale)</Label>
          <Textarea id="notes" name="notes" defaultValue={match?.notes ?? ""} placeholder="Es. Portare la seconda maglia…" />
        </div>
        <Toggle name="notify" label="Invia notifica push" description="A chi segue il calendario." defaultChecked />
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
