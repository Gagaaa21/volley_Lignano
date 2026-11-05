import { expect, test } from "@playwright/test";
import { summarizeAttendance } from "@/lib/attendanceSummary";
import {
  athleteJoinDate,
  isAttendanceSessionCounted,
  isMinivolleyDateRelevant,
  MINIVOLLEY_ATTENDANCE_START,
} from "@/lib/minivolleyAttendance";
import type { Athlete, AttendanceSession } from "@/lib/types";

const athlete = (id: string, createdAt: string): Athlete => ({
  id,
  fullName: `Bimba ${id}`,
  team: "minivolley",
  category: null,
  group: "lignano",
  jerseyNumber: null,
  isActive: true,
  notes: null,
  createdBy: null,
  createdAt,
  updatedAt: createdAt,
});
const session = (date: string, present: string[]): AttendanceSession =>
  ({
    id: date,
    trainingRuleId: "r",
    team: "minivolley",
    sessionDate: date,
    title: "Allenamento",
    location: "Palestra",
    records: Object.fromEntries(present.map((id) => [id, "present"])),
    createdBy: null,
    createdAt: date,
    updatedAt: date,
  }) as AttendanceSession;

test.describe("Presenze Minivolley", () => {
  test("i registri salvati restano visibili anche nei giorni dopo (dal primo giorno dell'anagrafica)", () => {
    expect(isAttendanceSessionCounted("minivolley", "2026-10-05")).toBe(true);
    expect(isAttendanceSessionCounted("minivolley", MINIVOLLEY_ATTENDANCE_START)).toBe(true);
    // I registri con i nomi liberi, di prima dell'anagrafica, no.
    expect(isAttendanceSessionCounted("minivolley", "2026-09-25")).toBe(false);
    expect(isAttendanceSessionCounted("u14u15", "2025-01-01")).toBe(true);
  });

  test("da registrare: per il Minivolley solo da oggi in avanti", () => {
    expect(isMinivolleyDateRelevant("minivolley", "2026-11-04", "2026-11-05")).toBe(false);
    expect(isMinivolleyDateRelevant("minivolley", "2026-11-05", "2026-11-05")).toBe(true);
    expect(isMinivolleyDateRelevant("u14u15", "2026-11-04", "2026-11-05")).toBe(true);
  });

  test("la percentuale conta gli allenamenti da quando la bimba è in anagrafica", () => {
    const sessions = [session("2026-10-05", ["a"]), session("2026-10-12", ["a"]), session("2026-11-02", ["a", "b"]), session("2026-11-04", ["b"])];
    const [a, b] = summarizeAttendance([athlete("a", "2026-10-01T10:00:00Z"), athlete("b", "2026-11-01T10:00:00Z")], sessions, true);
    expect([a.present, a.total, a.pct]).toEqual([3, 4, 75]);
    // Entrata il 1° novembre: due allenamenti, presente a entrambi.
    expect([b.present, b.total, b.pct]).toEqual([2, 2, 100]);
  });

  test("data di ingresso letta dall'anagrafica", () => {
    expect(athleteJoinDate("2026-11-01T10:00:00Z")).toBe("2026-11-01");
    expect(athleteJoinDate("")).toBeNull();
    expect(athleteJoinDate(undefined)).toBeNull();
  });
});
