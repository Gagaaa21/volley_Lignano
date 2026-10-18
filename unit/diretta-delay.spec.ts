import { expect, test } from "@playwright/test";
import { clampDelaySeconds, takeDue, type Reading } from "@/lib/diretta/delay";
import type { PublicLiveScore } from "@/lib/types";

/** Il ritardo del punteggio sulla pagina /diretta: le letture si mostrano dopo N secondi, in ordine. */

const live = (score: number): PublicLiveScore => ({
  team: "u14u15",
  category: "U15",
  home: { name: "Volley Lignano", color: "#1c5bae", score, sets: 0 },
  away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 },
  serving: "home",
  sets: [],
  timeouts: { home: 0, away: 0 },
  finished: false,
  updatedAt: "2026-10-18T09:00:00.000Z",
});

const T = 1_000_000;
const queue: Reading[] = [
  { at: T, live: live(1) },
  { at: T + 5_000, live: live(2) },
  { at: T + 10_000, live: live(3) },
  { at: T + 12_000, live: null },
];

test.describe("coda del ritardo", () => {
  test("niente prima del ritardo, poi le letture una dopo l'altra, in ordine", () => {
    expect(takeDue(queue, T + 14_999, 15_000)).toEqual({ due: [], rest: queue });
    const first = takeDue(queue, T + 15_000, 15_000);
    expect(first.due.map((r) => r.live?.home.score)).toEqual([1]);
    expect(first.rest).toHaveLength(3);
    const later = takeDue(first.rest, T + 26_000, 15_000);
    expect(later.due.map((r) => r.live?.home.score)).toEqual([2, 3]);
    expect(later.rest).toHaveLength(1);
  });

  test("anche «nessuna partita» aspetta il suo turno, e una coda vuota resta vuota", () => {
    const end = takeDue(queue, T + 60_000, 15_000);
    expect(end.due).toHaveLength(4);
    expect(end.due[3].live).toBeNull();
    expect(end.rest).toEqual([]);
    expect(takeDue([], T, 15_000)).toEqual({ due: [], rest: [] });
  });

  test("con il ritardo che cala le letture in coda diventano subito dovute", () => {
    expect(takeDue(queue, T + 11_000, 15_000).due).toHaveLength(0);
    expect(takeDue(queue, T + 11_000, 5_000).due.map((r) => r.live?.home.score)).toEqual([1, 2]);
    expect(takeDue(queue, T + 11_000, 0).due).toHaveLength(3);
  });

  test("il ritardo da un valore qualunque: da 0 a 60, intero, 0 se non è un numero", () => {
    expect(clampDelaySeconds(15)).toBe(15);
    expect(clampDelaySeconds("20")).toBe(20);
    expect(clampDelaySeconds(12.6)).toBe(13);
    expect(clampDelaySeconds(-5)).toBe(0);
    expect(clampDelaySeconds(500)).toBe(60);
    for (const value of ["tanto", undefined, null, NaN, {}]) expect(clampDelaySeconds(value)).toBe(0);
  });
});
