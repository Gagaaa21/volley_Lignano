import { expect, test } from "@playwright/test";
import { expandTrainings } from "@/lib/calendar";
import type { TrainingRule } from "@/lib/types";

const rule = (over: Partial<TrainingRule>): TrainingRule =>
  ({
    id: "r1",
    title: "Allenamento",
    location: "Palestra",
    repeat: "weekly",
    weekdays: [5],
    startTime: "18:00",
    endTime: "19:30",
    startDate: "2026-11-01",
    endDate: "2026-11-20",
    notes: null,
    isActive: true,
    team: "u14u15",
    isTournament: false,
    color: "green",
    excludedDates: [],
    occurrenceOverrides: [],
    createdBy: null,
    createdAt: "2026-11-01",
    updatedAt: "2026-11-01",
    ...over,
  }) as TrainingRule;

test.describe("Calendario: si confrontano giorni, non ore", () => {
  test("l'ultimo giorno di una serie c'è anche se l'intervallo parte da «adesso» (le 15:00)", () => {
    const now = new Date(2026, 10, 5, 15, 0);
    const end = new Date(2026, 11, 31, 15, 0);
    const dates = expandTrainings([rule({})], now, end).map((e) => e.date);
    expect(dates).toEqual(["2026-11-06", "2026-11-13", "2026-11-20"]);
  });

  test("un allenamento singolo di oggi c'è anche se l'intervallo parte da adesso", () => {
    const now = new Date(2026, 10, 5, 15, 0);
    const once = rule({ id: "r2", repeat: "once", weekdays: [], startDate: "2026-11-05", endDate: "2026-11-05" });
    expect(expandTrainings([once], now, new Date(2026, 10, 30)).map((e) => e.date)).toEqual(["2026-11-05"]);
  });

  test("un intervallo di oltre un anno arriva fino in fondo", () => {
    const long = rule({ startDate: "2025-09-01", endDate: null });
    const dates = expandTrainings([long], new Date(2025, 8, 1), new Date(2026, 11, 4)).map((e) => e.date);
    expect(dates.at(-1)).toBe("2026-12-04");
  });
});
