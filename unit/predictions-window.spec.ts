import { expect, test } from "@playwright/test";
import {
  PREDICTION_GRACE_LABEL,
  PREDICTION_GRACE_MINUTES,
  arePredictionsClosed,
  canPredict,
  hasPredictionOpened,
  isMatchLocked,
  predictionClosingLabel,
  predictionClosingTime,
} from "@/lib/predictions";
import type { Match } from "@/lib/types";

/** Finestra dei pronostici: si apre il giorno della partita e si chiude 10
 * minuti dopo il suo inizio (o prima, se il risultato è già stato inserito). */

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

test.describe("apertura: dal giorno della partita", () => {
  test("il giorno prima è ancora chiuso, dal giorno stesso è aperto", () => {
    expect(hasPredictionOpened("2026-10-10T18:00", "2026-10-09")).toBe(false);
    expect(hasPredictionOpened("2026-10-10T18:00", "2026-10-10")).toBe(true);
    expect(hasPredictionOpened("2026-10-10T18:00", "2026-10-11")).toBe(true);
  });

  test("canPredict: non prima del giorno, sì dal mattino, non dopo 10 minuti dall'inizio", () => {
    const m = match();
    const dayStart = new Date("2026-10-10T00:00").getTime();
    expect(canPredict(m, dayStart - MIN)).toBe(false);
    expect(canPredict(m, dayStart + MIN)).toBe(true);
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
    expect(predictionClosingLabel("2026-10-10T18:00")).toBe("alle 18:10");
  });

  test("dopo mezzanotte lo dice", () => {
    expect(predictionClosingTime("2026-10-10T23:55")).toEqual({ time: "00:05", nextDay: true });
    expect(predictionClosingLabel("2026-10-10T23:55")).toBe("alle 00:05 (dopo mezzanotte)");
    // Una partita alle 23:30 ora si chiude prima di mezzanotte.
    expect(predictionClosingTime("2026-10-10T23:30")).toEqual({ time: "23:40", nextDay: false });
  });
});
