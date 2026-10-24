import type { Match, MatchInput } from "./types";

/** I campi salvabili di una partita già salvata: si parte da qui per cambiarne solo una parte (risultato, convocazioni…). */
export function matchToInput(match: Match): MatchInput {
  return {
    team: match.team,
    category: match.category,
    opponent: match.opponent,
    isHome: match.isHome,
    isFriendly: match.isFriendly,
    isTournament: match.isTournament,
    location: match.location,
    matchDate: match.matchDate,
    meetingTime: match.meetingTime,
    meetingLocation: match.meetingLocation,
    notes: match.notes,
    calledUpAthleteIds: match.calledUpAthleteIds,
    setScores: match.setScores,
    resultSetsWon: match.resultSetsWon,
    resultSetsLost: match.resultSetsLost,
    tournamentGames: match.tournamentGames,
  };
}
