import { expect, test } from "@playwright/test";
import { expandTrainings, occurrenceSchedule } from "@/lib/calendar";
import type { TrainingRule } from "@/lib/types";

// Martedì e venerdì 19:00–21:00 al Palazzetto.
function rule(overrides: Partial<TrainingRule> = {}): TrainingRule {
  return {
    id: "r1",
    title: "Allenamento U14",
    location: "Palazzetto",
    repeat: "weekly",
    weekdays: [2, 5],
    startTime: "19:00",
    endTime: "21:00",
    startDate: "2026-09-01",
    endDate: null,
    notes: null,
    isActive: true,
    team: "u14u15",
    isTournament: false,
    color: "amber",
    excludedDates: [],
    occurrenceOverrides: [],
    createdBy: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const MOVED = { date: "2026-10-09", startTime: "17:30", endTime: "19:30", location: "Palestra delle Medie" };
const range = (from: string, to: string) => [new Date(`${from}T00:00:00`), new Date(`${to}T00:00:00`)] as const;

test.describe("allenamento cambiato per un solo giorno", () => {
  test("solo quella data ha orario e luogo nuovi, le altre restano come sempre", () => {
    const events = expandTrainings([rule({ occurrenceOverrides: [MOVED] })], ...range("2026-10-06", "2026-10-13"));
    expect(
      events.map((e) => (e.kind === "training" ? [e.date, e.startTime, e.endTime, e.location, Boolean(e.usual)] : [])),
    ).toEqual([
      ["2026-10-06", "19:00", "21:00", "Palazzetto", false],
      ["2026-10-09", "17:30", "19:30", "Palestra delle Medie", true],
      ["2026-10-13", "19:00", "21:00", "Palazzetto", false],
    ]);
    const moved = events[1];
    expect(moved.kind === "training" && moved.usual).toEqual({
      startTime: "19:00",
      endTime: "21:00",
      location: "Palazzetto",
    });
  });

  test("una data saltata resta saltata anche se era stata cambiata", () => {
    const events = expandTrainings(
      [rule({ occurrenceOverrides: [MOVED], excludedDates: ["2026-10-09"] })],
      ...range("2026-10-09", "2026-10-09"),
    );
    expect(events).toHaveLength(0);
  });

  test("senza variazioni (anche dati vecchi senza il campo) tutto come prima", () => {
    const legacy = { ...rule(), occurrenceOverrides: undefined } as unknown as TrainingRule;
    expect(occurrenceSchedule(legacy, "2026-10-09")).toEqual({
      startTime: "19:00",
      endTime: "21:00",
      location: "Palazzetto",
      usual: null,
    });
  });

  test("luogo lasciato vuoto: si tiene quello di sempre", () => {
    const schedule = occurrenceSchedule(rule({ occurrenceOverrides: [{ ...MOVED, location: " " }] }), "2026-10-09");
    expect(schedule.location).toBe("Palazzetto");
    expect(schedule.startTime).toBe("17:30");
  });

  test("un allenamento singolo non usa le variazioni: si modifica direttamente", () => {
    const once = rule({ repeat: "once", weekdays: [], startDate: "2026-10-09", occurrenceOverrides: [MOVED] });
    expect(occurrenceSchedule(once, "2026-10-09").usual).toBeNull();
  });
});
