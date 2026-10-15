import { expect, test } from "@playwright/test";
import { clockTimeMinusMinutes, parseClockTime } from "@/lib/clockTime";

/** L'ora di ritrovo si scrive a mano (anche sul telefono, senza selettore): ogni modo ragionevole diventa «HH:MM»,
 * il vuoto è «nessuna ora» e il resto è un errore, mai un orario indovinato. */

test.describe("parseClockTime", () => {
  const good: [string, string][] = [
    ["17:30", "17:30"],
    ["7:05", "07:05"],
    ["17.30", "17:30"],
    ["17,30", "17:30"],
    ["17h30", "17:30"],
    ["1730", "17:30"],
    ["930", "09:30"],
    ["0930", "09:30"],
    ["17", "17:00"],
    ["9", "09:00"],
    ["17:", "17:00"],
    ["  17 : 30 ", "17:30"],
    ["ore 17:30", "17:30"],
    ["17:30:00", "17:30"],
    ["00:00", "00:00"],
    ["23:59", "23:59"],
  ];
  for (const [input, expected] of good) {
    test(`«${input}» → ${expected}`, () => {
      expect(parseClockTime(input)).toEqual({ ok: true, value: expected });
    });
  }

  test("vuoto o solo spazi = nessuna ora", () => {
    expect(parseClockTime("")).toEqual({ ok: true, value: null });
    expect(parseClockTime("   ")).toEqual({ ok: true, value: null });
    expect(parseClockTime(null)).toEqual({ ok: true, value: null });
    expect(parseClockTime(undefined)).toEqual({ ok: true, value: null });
  });

  for (const input of ["24:00", "17:60", "25", "99:99", "abc", "17:3", "17:30:", "12345", "1:2:3", "17-30", "-1"]) {
    test(`«${input}» non è un'ora`, () => {
      expect(parseClockTime(input)).toEqual({ ok: false });
    });
  }
});

test.describe("clockTimeMinusMinutes", () => {
  test("toglie minuti restando nello stesso giorno", () => {
    expect(clockTimeMinusMinutes("18:00", 45)).toBe("17:15");
    expect(clockTimeMinusMinutes("18:00", 60)).toBe("17:00");
    expect(clockTimeMinusMinutes("09:10", 30)).toBe("08:40");
    expect(clockTimeMinusMinutes("00:30", 30)).toBe("00:00");
  });
  test("prima di mezzanotte o con un'ora non valida non propone niente", () => {
    expect(clockTimeMinusMinutes("00:20", 30)).toBeNull();
    expect(clockTimeMinusMinutes("", 30)).toBeNull();
    expect(clockTimeMinusMinutes("boh", 30)).toBeNull();
  });
});
