import { appliesToAthlete } from "@/lib/availability/rules";
import { answerWhen } from "@/lib/availability/format";
import type { MatchAvailability as MatchAvailabilityRow } from "@/lib/availability/types";
import type { Athlete, Match } from "@/lib/types";
import { AvailabilityBoard, type BoardAnswer } from "./AvailabilityBoard";

/**
 * «Chi viene» di una partita: prepara per la lavagna le atlete attive che la riguardano (squadra e categoria) e la risposta di
 * ognuna. Solo area tecnici, mai sul sito pubblico.
 */
export function MatchAvailability({
  match,
  rows,
  athletes,
  familyLinksHref,
}: {
  match: Match;
  rows: MatchAvailabilityRow[];
  /** Le atlete della squadra della partita. */
  athletes: Athlete[];
  familyLinksHref: string | null;
}) {
  const eligible = athletes
    .filter((athlete) => athlete.isActive && appliesToAthlete(match, athlete))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "it"));
  const ids = new Set(eligible.map((athlete) => athlete.id));
  const answers: Record<string, BoardAnswer> = {};
  for (const row of rows) {
    if (!ids.has(row.athleteId)) continue;
    answers[row.athleteId] = { status: row.status, reason: row.reason, note: row.note, by: row.answeredBy, when: answerWhen(row.updatedAt) };
  }

  return (
    <AvailabilityBoard
      matchId={match.id}
      athletes={eligible.map((athlete) => ({ id: athlete.id, name: athlete.fullName, calledUp: match.calledUpAthleteIds.includes(athlete.id) }))}
      answers={answers}
      familyLinksHref={familyLinksHref}
    />
  );
}
