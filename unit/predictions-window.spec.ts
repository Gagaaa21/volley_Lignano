import { expect, test } from "@playwright/test";
import {
  PREDICTION_GRACE_LABEL,
  PREDICTION_GRACE_MINUTES,
  arePredictionsClosed,
  canPredict,
  computeLeaderboard,
  computeMatchResults,
  isMatchLocked,
  predictedOutcome,
  predictionClosingLabel,
  predictionClosingSoon,
  predictionClosingTime,
  rankPositions,
  scoreSets,
} from "@/lib/predictions";
import type { Match, MatchPrediction, SetScore } from "@/lib/types";

/** Finestra dei pronostici: sempre aperti, da quando la partita è in calendario, fino a 10 minuti dopo il suo inizio (o
 * prima, se il risultato è già stato inserito). E come si contano e si mostrano i punti. */

const MIN = 60_000;

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    team: "u14u15",
    category: "U15",
    opponent: "Degano",
    isHome: true,
    location: "Palestra",
    matchDate: "2026-10-10T18:00",
    isFriendly: false,
    isTournament: false,
    meetingTime: null,
    meetingLocation: null,
    notes: null,
    calledUpAthleteIds: [],
    setScores: null,
    resultSetsWon: null,
    resultSetsLost: null,
    tournamentGames: null,
    createdBy: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

/** Istante "minuti dall'inizio" della partita, nello stesso fuso in cui è letta. */
function at(m: Match, minutesFromStart: number): number {
  return new Date(m.matchDate).getTime() + minutesFromStart * MIN;
}

test.describe("chiusura: 10 minuti dopo l'inizio", () => {
  test("la finestra dopo l'inizio è di 10 minuti, e le frasi lo dicono così", () => {
    expect(PREDICTION_GRACE_MINUTES).toBe(10);
    expect(PREDICTION_GRACE_LABEL).toBe("10 minuti");
  });

  test("prima dell'inizio è aperto", () => {
    const m = match();
    expect(isMatchLocked(m.matchDate, at(m, -120))).toBe(false);
    expect(isMatchLocked(m.matchDate, at(m, -1))).toBe(false);
  });

  test("all'inizio e nei 10 minuti successivi è ancora aperto", () => {
    const m = match();
    expect(isMatchLocked(m.matchDate, at(m, 0))).toBe(false);
    expect(isMatchLocked(m.matchDate, at(m, 5))).toBe(false);
    expect(isMatchLocked(m.matchDate, at(m, 9))).toBe(false);
  });

  test("10 minuti dopo l'inizio si chiude (prima restava aperto un'ora)", () => {
    const m = match();
    expect(isMatchLocked(m.matchDate, at(m, 10))).toBe(true);
    expect(isMatchLocked(m.matchDate, at(m, 11))).toBe(true);
    expect(isMatchLocked(m.matchDate, at(m, 30))).toBe(true);
    expect(isMatchLocked(m.matchDate, at(m, 24 * 60))).toBe(true);
  });
});

test.describe("chiusura anticipata col risultato", () => {
  const withResult = match({ setScores: [{ us: 25, them: 20 }, { us: 25, them: 18 }, { us: 25, them: 15 }] });

  test("con il risultato già inserito è chiuso anche dentro i 10 minuti di tolleranza", () => {
    expect(arePredictionsClosed(withResult, at(withResult, 5))).toBe(true);
    expect(canPredict(withResult, at(withResult, 5))).toBe(false);
  });

  test("senza risultato resta aperto dentro i 10 minuti", () => {
    const m = match();
    expect(arePredictionsClosed(m, at(m, 5))).toBe(false);
    expect(canPredict(m, at(m, 5))).toBe(true);
  });

  test("un torneo con almeno una gara giocata è chiuso, uno senza parziali no", () => {
    const played = match({
      isTournament: true,
      tournamentGames: [{ id: "g1", opponent: "A", setScores: [{ us: 25, them: 10 }] }],
    });
    const empty = match({ isTournament: true, tournamentGames: [{ id: "g1", opponent: "A", setScores: [] }] });
    expect(arePredictionsClosed(played, at(played, 5))).toBe(true);
    expect(arePredictionsClosed(empty, at(empty, 5))).toBe(false);
  });
});

test.describe("apertura: sempre, fino a 10 minuti dopo l'inizio", () => {
  test("si pronostica anche settimane prima, la sera prima e fino a 10 minuti dopo l'inizio", () => {
    const m = match();
    expect(canPredict(m, at(m, -60 * 24 * 30))).toBe(true); // un mese prima
    expect(canPredict(m, at(m, -60 * 24))).toBe(true); // il giorno prima
    expect(canPredict(m, at(m, 9))).toBe(true);
    expect(canPredict(m, at(m, 10))).toBe(false);
  });

  test("una partita a tarda sera resta aperta oltre mezzanotte, fino a 10 minuti dopo l'inizio", () => {
    const late = match({ matchDate: "2026-10-10T23:55" });
    expect(canPredict(late, at(late, 7))).toBe(true); // 00:02 del giorno dopo
    expect(canPredict(late, at(late, 10))).toBe(false); // 00:05
  });
});

test.describe("orario di chiusura mostrato", () => {
  test("10 minuti dopo l'inizio", () => {
    expect(predictionClosingTime("2026-10-10T18:00")).toEqual({ time: "18:10", nextDay: false });
    expect(predictionClosingTime("2026-10-10T20:55")).toEqual({ time: "21:05", nextDay: false });
    // Una partita alle 23:30 si chiude prima di mezzanotte, una alle 23:55 dopo.
    expect(predictionClosingTime("2026-10-10T23:30")).toEqual({ time: "23:40", nextDay: false });
    expect(predictionClosingTime("2026-10-10T23:55")).toEqual({ time: "00:05", nextDay: true });
  });

  test("con il giorno: oggi, domani, oppure la data", () => {
    const now = new Date("2026-10-10T09:00").getTime();
    expect(predictionClosingLabel("2026-10-10T18:00", now)).toBe("oggi alle 18:10");
    expect(predictionClosingLabel("2026-10-11T11:00", now)).toBe("domani alle 11:10");
    expect(predictionClosingLabel("2026-10-10T23:55", now)).toBe("domani alle 00:05");
    expect(predictionClosingLabel("2026-10-17T15:30", now)).toBe("sab 17 ott alle 15:40");
  });

  test("«si chiude presto» nelle ultime 24 ore, non prima e non dopo", () => {
    const m = match();
    expect(predictionClosingSoon(m.matchDate, at(m, -60 * 25))).toBe(false);
    expect(predictionClosingSoon(m.matchDate, at(m, -60 * 23))).toBe(true);
    expect(predictionClosingSoon(m.matchDate, at(m, 5))).toBe(true);
    expect(predictionClosingSoon(m.matchDate, at(m, 10))).toBe(false);
  });
});

test.describe("punti: per partita, in classifica e a pari merito", () => {
  const sets = (...pairs: [number, number][]): SetScore[] => pairs.map(([us, them]) => ({ us, them }));
  const prediction = (staffId: string, matchId: string, setScores: SetScore[]): MatchPrediction =>
    ({ id: `${staffId}-${matchId}`, matchId, staffId, setScores, tournamentGames: null }) as MatchPrediction;

  test("il risultato previsto si conta dai set: 3–1, 0–3", () => {
    expect(predictedOutcome(sets([25, 20], [20, 25], [25, 18], [25, 22]))).toEqual({ won: 3, lost: 1 });
    expect(predictedOutcome(sets([20, 25], [18, 25], [22, 25]))).toEqual({ won: 0, lost: 3 });
  });

  test("in una partita: un punto per set al più vicino, con esatti e vincitori indovinati; prima chi ha più punti", () => {
    const m = match({ setScores: sets([25, 20], [22, 25], [25, 18], [25, 23]), resultSetsWon: 3, resultSetsLost: 1 });
    const results = computeMatchResults(m, [
      prediction("anna", "m1", sets([25, 20], [25, 22], [25, 15])), // esatto il 1°, vince il 3°
      prediction("bea", "m1", sets([25, 21], [23, 25], [20, 25], [25, 20])), // più vicina nel 2° e nel 4°
    ])!;
    const scores = scoreSets(results);
    expect(scores.map((s) => [s.staffId, s.points, s.exact, s.judged])).toEqual([
      ["anna", 2, 1, 3],
      ["bea", 2, 0, 4],
    ]);
    expect(rankPositions(scores)).toEqual([1, 1]);
  });

  test("la classifica somma le partite, conta in quante si è pronosticato e a pari punti la posizione è la stessa", () => {
    const m1 = match({ id: "m1", setScores: sets([25, 20], [25, 20], [25, 20]), resultSetsWon: 3, resultSetsLost: 0 });
    const m2 = match({ id: "m2", setScores: sets([20, 25], [20, 25], [20, 25]), resultSetsWon: 0, resultSetsLost: 3 });
    const byMatch = new Map<string, MatchPrediction[]>([
      ["m1", [prediction("anna", "m1", sets([25, 20], [25, 20], [25, 20])), prediction("bea", "m1", sets([25, 10], [25, 10], [25, 10]))]],
      ["m2", [prediction("bea", "m2", sets([20, 25], [20, 25], [20, 25])), prediction("carla", "m2", sets([25, 10], [25, 10], [25, 10]))]],
    ]);
    const board = computeLeaderboard([m1, m2], byMatch);
    // A pari punti ed esatti viene prima chi ha indovinato più vincitori di set (bea: anche i tre della prima partita).
    expect(board.map((e) => [e.staffId, e.points, e.exact, e.rightWinner, e.matches])).toEqual([
      ["bea", 3, 3, 6, 2],
      ["anna", 3, 3, 3, 1],
      ["carla", 0, 0, 0, 1],
    ]);
    expect(rankPositions(board)).toEqual([1, 1, 3]);
  });
});
