"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { BellOff, BellRing, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldError, FieldHint, FormActions, FormSection, RadioSegment, Toggle } from "@/components/ui/Field";
import { TimeField } from "@/components/ui/TimeField";
import { CATEGORY_LABELS } from "@/lib/category";
import { clockTimeMinusMinutes, parseClockTime } from "@/lib/clockTime";
import { matchChangeNotice, newMatchNotice, type MatchNotice } from "@/lib/matchNotices";
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

type MatchFacts = Parameters<typeof newMatchNotice>[0];

/** I dettagli come sono scritti adesso nel modulo, per l'anteprima della notifica. */
function readFacts(form: HTMLFormElement, team: TrainingTeam, overrides: Partial<MatchFacts> = {}): MatchFacts & { notify: boolean } {
  const data = new FormData(form);
  const text = (name: string) => data.get(name)?.toString().trim() ?? "";
  const meeting = parseClockTime(text("meetingTime"));
  const category = text("category");
  return {
    team,
    category: team === "u14u15" && (category === "U14" || category === "U15") ? category : null,
    opponent: text("opponent"),
    isHome: data.get("isHome") !== "away",
    isFriendly: data.get("isFriendly") === "on",
    isTournament: data.get("isTournament") === "on",
    location: text("location"),
    matchDate: text("matchDate"),
    meetingTime: meeting.ok ? meeting.value : text("meetingTime") || null,
    meetingLocation: text("meetingLocation") || null,
    notes: text("notes") || null,
    ...overrides,
    notify: data.get("notify") === "on",
  };
}

/** Sotto «Avvisa chi segue il calendario»: la notifica che partirà, o perché non ne parte nessuna. */
function NoticePreview({ notice, notify, editing }: { notice: MatchNotice | null; notify: boolean; editing: boolean }) {
  if (!notify) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground" data-match-notice-preview="off">
        <BellOff className="h-4 w-4 shrink-0" />
        Nessuna notifica: l&apos;avviso è spento.
      </p>
    );
  }
  if (!notice) {
    return (
      <p className="flex items-start gap-2 text-[13px] text-muted-foreground" data-match-notice-preview="none">
        <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
        {editing
          ? "Nessuna notifica: finora non hai cambiato niente che interessi alle famiglie (data, orario, luogo, ritrovo, nota…)."
          : "La notifica dirà chi gioca, quando e dove: compila avversaria, luogo, data e ora."}
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary-soft/50 px-3.5 py-2.5" data-match-notice-preview="on">
      <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 text-[13px] leading-snug">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Partirà questa notifica</p>
        <p className="mt-0.5 font-semibold text-foreground" data-match-notice-title>
          {notice.title}
        </p>
        <p className="text-muted-foreground" data-match-notice-body>
          {notice.body}
        </p>
      </div>
    </div>
  );
}

/** Orari di ritrovo che si propongono con un tocco, contati dall'ora della partita. */
const MEETING_OFFSETS = [
  { label: "1 ora", minutes: 60 },
  { label: "45 min", minutes: 45 },
  { label: "30 min", minutes: 30 },
];

export function MatchForm({ match, team = "u14u15" }: { match?: Match; team?: TrainingTeam }) {
  const [state, formAction] = useActionState(saveMatchAction, initialState);
  // Dopo un errore i campi tornano com'erano stati scritti (React altrimenti li riporterebbe ai valori salvati).
  const values = state.values;
  const [isTournament, setIsTournament] = useState(match?.isTournament ?? false);
  const [matchDate, setMatchDate] = useState(match?.matchDate ?? "");
  const [meetingTime, setMeetingTime] = useState(match?.meetingTime ?? "");
  const effectiveTeam = match?.team ?? team;
  const formRef = useRef<HTMLFormElement>(null);
  // I dettagli come sono scritti adesso (null finché non si tocca niente): servono all'anteprima della notifica.
  const [facts, setFacts] = useState<(MatchFacts & { notify: boolean }) | null>(null);
  const refresh = (overrides: Partial<MatchFacts> = {}) => {
    if (formRef.current) setFacts(readFacts(formRef.current, effectiveTeam, overrides));
  };
  const notify = facts ? facts.notify : (values?.notify ?? true);
  const notice: MatchNotice | null = match
    ? facts
      ? matchChangeNotice(match, facts)
      : null
    : facts && facts.opponent && facts.location && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(facts.matchDate)
      ? newMatchNotice(facts)
      : null;
  const meetingSuggestions = MEETING_OFFSETS.flatMap(({ label, minutes }) => {
    const time = clockTimeMinusMinutes(matchDate.slice(11, 16), minutes);
    return time ? [{ label, time }] : [];
  });

  return (
    <form action={formAction} noValidate ref={formRef} onChange={() => refresh()}>
      {match && <input type="hidden" name="id" value={match.id} />}
      <input type="hidden" name="team" value={effectiveTeam} />

      <FormSection title="Partita" description="Chi gioca, contro chi e dove.">
        {effectiveTeam === "u14u15" && (
          <div>
            <Label>Categoria</Label>
            <RadioSegment
              name="category"
              defaultValue={(values?.category || match?.category || "U15") as "U14" | "U15"}
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
            defaultValue={values?.opponent ?? match?.opponent}
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
            defaultValue={(values ? values.isHome : (match?.isHome ?? true)) ? "home" : "away"}
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
            defaultChecked={values?.isFriendly ?? match?.isFriendly ?? false}
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
            defaultValue={values?.location ?? match?.location}
            placeholder="Es. Palestra Comunale, Lignano Sabbiadoro"
            required
          />
        </div>

        <div>
          <Label htmlFor="matchDate">Data e ora</Label>
          <Input
            id="matchDate"
            name="matchDate"
            type="datetime-local"
            defaultValue={values?.matchDate ?? match?.matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            required
          />
        </div>

        <div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div>
              <Label htmlFor="meetingTime">Ora ritrovo</Label>
              <TimeField
                id="meetingTime"
                name="meetingTime"
                value={meetingTime}
                onChange={(value) => {
                  setMeetingTime(value);
                  refresh({ meetingTime: value || null });
                }}
                clearLabel="Togli l'ora di ritrovo"
              />
            </div>
            <div>
              <Label htmlFor="meetingLocation">Luogo ritrovo</Label>
              <Input
                id="meetingLocation"
                name="meetingLocation"
                defaultValue={values?.meetingLocation ?? match?.meetingLocation ?? ""}
                placeholder="Se diverso dal luogo della partita"
              />
            </div>
          </div>
          {meetingSuggestions.length > 0 && (
            <div className="mt-3" data-meeting-suggestions>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Ritrovo prima della partita</p>
              <div className="flex flex-wrap gap-1.5">
                {meetingSuggestions.map(({ label, time }) => (
                  <Button
                    key={time}
                    type="button"
                    size="xs"
                    variant={meetingTime === time ? "soft" : "outline"}
                    aria-pressed={meetingTime === time}
                    onClick={() => {
                      setMeetingTime(time);
                      refresh({ meetingTime: time });
                    }}
                    data-meeting-suggestion={time}
                    className="gap-1 px-2"
                  >
                    {label} · <span className="tabular">{time}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          <FieldHint>
            Facoltativi: lasciali vuoti se il ritrovo coincide con orario e luogo della partita. L&apos;ora si scrive (1730 diventa
            17:30) e con la X si toglie.
          </FieldHint>
        </div>
      </FormSection>

      <FormSection title="Altro">
        <div>
          <Label htmlFor="notes">Note (opzionale)</Label>
          <Textarea id="notes" name="notes" defaultValue={values?.notes ?? match?.notes ?? ""} placeholder="Es. Portare la seconda maglia…" />
        </div>
        <div className="space-y-2.5" data-match-notify>
          <Toggle
            name="notify"
            label="Avvisa chi segue il calendario"
            description="Con una notifica che dice che cosa è cambiato: parte solo se cambia qualcosa che interessa alle famiglie."
            defaultChecked={values?.notify ?? true}
          />
          <NoticePreview notice={notice} notify={notify} editing={Boolean(match)} />
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
