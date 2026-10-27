import { appliesToAthlete, isAbsence } from "@/lib/availability/rules";
import { answerWhen } from "@/lib/availability/format";
import type { MatchAvailability as MatchAvailabilityRow } from "@/lib/availability/types";
import type { Athlete, Match } from "@/lib/types";
import { AvailabilityBoard, type BoardAbsence } from "./AvailabilityBoard";

/**
 * Le assenze di una partita: prepara per il riquadro le atlete attive che la riguardano (squadra e categoria) e l'assenza di chi
 * non ci sarà. Solo area tecnici, mai sul sito pubblico.
 */
export function MatchAvailability({
  match,
  rows,
  athletes,
  staffNames,
  myName,
}: {
  match: Match;
  rows: MatchAvailabilityRow[];
  /** Le atlete della squadra della partita. */
  athletes: Athlete[];
  /** I nomi degli account dello staff (per id), per dire chi ha scritto un'assenza. */
  staffNames: ReadonlyMap<string, string>;
  myName: string;
}) {
  const eligible = athletes
    .filter((athlete) => athlete.isActive && appliesToAthlete(match, athlete))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "it"));
  const ids = new Set(eligible.map((athlete) => athlete.id));
  const absences: Record<string, BoardAbsence> = {};
  for (const row of rows) {
    if (!ids.has(row.athleteId) || !isAbsence(row)) continue;
    absences[row.athleteId] = {
      reason: row.reason,
      note: row.note,
      by: row.answeredBy,
      byName: row.updatedBy ? (staffNames.get(row.updatedBy) ?? null) : null,
      when: answerWhen(row.updatedAt),
    };
  }

  return (
    <AvailabilityBoard
      matchId={match.id}
      athletes={eligible.map((athlete) => ({ id: athlete.id, name: athlete.fullName, calledUp: match.calledUpAthleteIds.includes(athlete.id) }))}
      absences={absences}
      myName={myName}
    />
  );
}
