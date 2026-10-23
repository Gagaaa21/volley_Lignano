import { CalendarX2 } from "lucide-react";
import { describeUnavailability, appliesToAthlete } from "@/lib/availability/rules";
import {
  UNAVAILABILITY_REASONS,
  UNAVAILABILITY_REASON_LABELS,
  MAX_NOTE_LENGTH,
  type MatchUnavailability,
} from "@/lib/availability/types";
import { formatDateTime } from "@/lib/format";
import type { Athlete, Match } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import { AvailabilityRow } from "./AvailabilityRow";
import { setStaffUnavailabilityAction } from "./availability-actions";

/**
 * Chi non può esserci a questa partita: le segnalazioni dei genitori (dal link personale) e quelle inserite dallo staff. Ognuna si
 * modifica o si toglie (anche se l'ha scritta il genitore: vale l'ultima modifica, e si vede di chi è). Non tolgono nessuna dalle
 * convocate da sole: se è già convocata lo dice, e decide lo staff. Solo area tecnici, mai sul sito pubblico.
 */
export function MatchAvailability({
  match,
  rows,
  athletes,
}: {
  match: Match;
  rows: MatchUnavailability[];
  /** Le atlete attive della squadra della partita. */
  athletes: Athlete[];
}) {
  const nameOf = (athleteId: string) => athletes.find((athlete) => athlete.id === athleteId)?.fullName ?? "Atleta non più in elenco";
  const reported = new Set(rows.map((row) => row.athleteId));
  const candidates = athletes.filter((athlete) => appliesToAthlete(match, athlete) && !reported.has(athlete.id));
  const sorted = [...rows].sort((a, b) => nameOf(a.athleteId).localeCompare(nameOf(b.athleteId), "it"));

  return (
    <Card className="mb-6" data-match-availability>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <span className="icon-chip h-10 w-10 shrink-0">
            <CalendarX2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <CardTitle>Disponibilità</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Chi non può esserci: lo segnalano i genitori dal loro link, o lo scrivi tu. Puoi modificare o togliere ogni segnalazione.
            </p>
          </div>
        </div>
        <Badge tone={rows.length > 0 ? "warning" : "neutral"} data-availability-count>
          {rows.length === 0 ? "Nessuna segnalazione" : rows.length === 1 ? "1 non disponibile" : `${rows.length} non disponibili`}
        </Badge>
      </CardHeader>
      <CardBody className="space-y-5">
        {sorted.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border" data-availability-list>
            {sorted.map((row) => (
              <AvailabilityRow
                // Dopo ogni modifica la riga riparte chiusa e con i valori nuovi.
                key={`${row.athleteId}-${row.reportedAt}`}
                matchId={match.id}
                athleteId={row.athleteId}
                name={nameOf(row.athleteId)}
                calledUp={match.calledUpAthleteIds.includes(row.athleteId)}
                description={describeUnavailability(row)}
                attribution={`Ultima modifica ${row.reportedBy === "parent" ? "del genitore" : "dello staff"} · ${formatDateTime(row.reportedAt)}`}
                reason={row.reason}
                note={row.note}
              />
            ))}
          </ul>
        )}

        {candidates.length > 0 && (
          <form action={setStaffUnavailabilityAction} className="space-y-3 rounded-xl bg-surface-muted px-4 py-4" data-availability-add>
            <input type="hidden" name="matchId" value={match.id} />
            <p className="text-sm font-semibold text-foreground">Segna tu una non disponibilità</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`avail-athlete-${match.id}`}>Atleta</Label>
                <Select id={`avail-athlete-${match.id}`} name="athleteId" defaultValue="" required>
                  <option value="" disabled>
                    Scegli l&apos;atleta
                  </option>
                  {candidates.map((athlete) => (
                    <option key={athlete.id} value={athlete.id}>
                      {athlete.fullName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`avail-reason-${match.id}`}>Motivo</Label>
                <Select id={`avail-reason-${match.id}`} name="reason" defaultValue="">
                  <option value="">Non indicato</option>
                  {UNAVAILABILITY_REASONS.map((key) => (
                    <option key={key} value={key}>
                      {UNAVAILABILITY_REASON_LABELS[key]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor={`avail-note-${match.id}`}>Nota (facoltativa)</Label>
              <Input id={`avail-note-${match.id}`} name="note" maxLength={MAX_NOTE_LENGTH} autoComplete="off" placeholder="Es. ha avvisato in chat" />
            </div>
            <Button type="submit" size="sm" data-availability-submit>
              <CalendarX2 className="h-4 w-4" />
              Segna non disponibile
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
