import { expect, test } from "@playwright/test";
import {
  buildAthleteSessions,
  formatDelta,
  formatMeasure,
  latestReading,
  readingAt,
} from "@/lib/physicalTestOverview";
import { groupSquatJumpSessions, parseMeasure, squatJumpFieldName } from "@/lib/physicalTestFields";
import type { PhysicalTest } from "@/lib/types";

let counter = 0;
function row(testName: string, value: string, date: string): PhysicalTest {
  counter++;
  return {
    id: `t${counter}`,
    athleteId: "a1",
    team: "u14u15",
    testName,
    value,
    date,
    notes: null,
    createdBy: null,
    createdAt: `2026-01-01T00:00:${String(counter).padStart(2, "0")}.000Z`,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const TESTS: PhysicalTest[] = [
  row("Peso (kg)", "50,5", "2026-03-10"),
  row(squatJumpFieldName(1, "altezza"), "40", "2026-03-10"),
  row(squatJumpFieldName(2, "altezza"), "44", "2026-03-10"),
  row(squatJumpFieldName(1, "forza"), "900", "2026-03-10"),
  row("Sit and reach", "7", "2026-03-10"),
  // Seconda sessione: solo il peso; un'altra con solo un salto.
  row("Peso (kg)", "51", "2026-03-20"),
  row(squatJumpFieldName(1, "altezza"), "46", "2026-04-02"),
  row("Lunghezza gamba a 90° (cm)", "non misurata", "2026-04-02"),
];

test.describe("test fisici in forma di tabella", () => {
  test("numeri anche con la virgola; il testo non è un numero", () => {
    expect(parseMeasure("50,5")).toBe(50.5);
    expect(parseMeasure(" 7 ")).toBe(7);
    expect(parseMeasure("")).toBeNull();
    expect(parseMeasure(null)).toBeNull();
    expect(parseMeasure("alta")).toBeNull();
  });

  test("media dei salti: un valore mancante non conta come zero", () => {
    const [session] = groupSquatJumpSessions([
      row(squatJumpFieldName(1, "altezza"), "40", "2026-03-10"),
      row(squatJumpFieldName(2, "altezza"), "44", "2026-03-10"),
      row(squatJumpFieldName(1, "forza"), "900", "2026-03-10"),
      row(squatJumpFieldName(2, "forza"), "", "2026-03-10"),
    ]);
    expect(session.meanAltezza).toBe(42);
    expect(session.meanForza).toBe(900);
    expect(session.meanTempo).toBeNull();
  });

  test("una sessione per giorno, dalla più recente: misure, medie dei salti e altri dati", () => {
    const sessions = buildAthleteSessions(TESTS);
    expect(sessions.map((s) => s.date)).toEqual(["2026-04-02", "2026-03-20", "2026-03-10"]);

    const first = sessions[2];
    expect(first.values).toEqual({ peso: 50.5, sjAltezza: 42, sjForza: 900 });
    expect(first.others).toEqual([{ name: "Sit and reach", value: "7" }]);

    // Un dato noto scritto a parole non è perso: resta tra gli altri dati.
    expect(sessions[0].values).toEqual({ sjAltezza: 46 });
    expect(sessions[0].others).toEqual([{ name: "Lunghezza gamba a 90° (cm)", value: "non misurata" }]);
  });

  test("ultimo valore di ogni misura, anche se presa in giorni diversi, con il precedente", () => {
    const sessions = buildAthleteSessions(TESTS);
    expect(latestReading(sessions, "peso")).toEqual({ value: 51, date: "2026-03-20", previous: 50.5 });
    expect(latestReading(sessions, "sjAltezza")).toEqual({ value: 46, date: "2026-04-02", previous: 42 });
    expect(latestReading(sessions, "sjForza")).toEqual({ value: 900, date: "2026-03-10", previous: null });
    expect(latestReading(sessions, "gamba90")).toBeNull();
  });

  test("il valore di una sessione precisa, confrontato con la misura precedente", () => {
    const sessions = buildAthleteSessions(TESTS);
    expect(readingAt(sessions, 2, "peso")).toEqual({ value: 50.5, date: "2026-03-10", previous: null });
    expect(readingAt(sessions, 1, "peso")).toEqual({ value: 51, date: "2026-03-20", previous: 50.5 });
    // Quel giorno il peso non c'è.
    expect(readingAt(sessions, 0, "peso")).toBeNull();
  });

  test("formato: virgola italiana, variazione con segno, niente variazione se invariato", () => {
    expect(formatMeasure(42)).toBe("42");
    expect(formatMeasure(42.46)).toBe("42,5");
    expect(formatDelta(51, 50.5)).toBe("+0,5");
    expect(formatDelta(48, 50.5)).toBe("−2,5");
    expect(formatDelta(50.52, 50.5)).toBeNull();
  });
});
