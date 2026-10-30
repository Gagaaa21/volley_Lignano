import { expect, test } from "@playwright/test";
import { clampDelaySeconds, nextOffset, readingTime, stampOf, takeDue, type Reading } from "@/lib/diretta/delay";
import type { PublicLiveScore } from "@/lib/types";

/** Il ritardo del punteggio sulla pagina /diretta: le letture si mostrano dopo N secondi, in ordine. */

const live = (score: number, updatedAt = "2026-10-18T09:00:00.000Z"): PublicLiveScore => ({
  team: "u14u15",
  category: "U15",
  home: { name: "Volley Lignano", color: "#1c5bae", score, sets: 0 },
  away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 },
  serving: "home",
  sets: [],
  timeouts: { home: 0, away: 0 },
  finished: false,
  updatedAt,
});

const T = 1_000_000;
const queue: Reading[] = [
  { at: T, stamp: null, live: live(1) },
  { at: T + 5_000, stamp: null, live: live(2) },
  { at: T + 10_000, stamp: null, live: live(3) },
  { at: T + 12_000, stamp: null, live: null },
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

  test("il ritardo si conta dall'istante del punto: la copia della CDN arrivata tardi non fa ballare il punteggio", () => {
    // L'orologio di chi guarda è 1 ora avanti (non conta): ogni lettura arriva da 0,5 a 7 secondi dopo il salvataggio.
    const SKEW = 3_600_000;
    const saved = [0, 4_000, 9_000];
    const travel = [500, 7_000, 2_000];
    let offset: number | null = null;
    const readings: Reading[] = saved.map((at, i) => {
      const reading: Reading = { at: T + SKEW + at + travel[i], stamp: T + at, live: live(i + 1, new Date(T + at).toISOString()) };
      offset = nextOffset(offset, reading);
      return reading;
    });
    // Lo scarto è il più piccolo visto: l'ora avanti più il viaggio più breve.
    expect(offset).toBe(SKEW + 500);
    // Ogni punto si mostra 15 secondi (più il viaggio più breve) dopo essere stato salvato, comunque sia arrivato.
    expect(readings.map((reading) => readingTime(reading, offset) - SKEW - T)).toEqual([500, 4_500, 9_500]);
    expect(takeDue(readings, T + SKEW + 4_000 + 500 + 15_000 - 1, 15_000, offset).due.map((r) => r.live?.home.score)).toEqual([1]);
    expect(takeDue(readings, T + SKEW + 4_000 + 500 + 15_000, 15_000, offset).due.map((r) => r.live?.home.score)).toEqual([1, 2]);
  });

  test("una lettura vecchia (chi apre a partita avviata) non sposta i punti dopo; senza ora si conta dall'arrivo", () => {
    // La prima lettura è di 40 secondi fa: lo scarto parte grande, la prima lettura fresca lo abbassa.
    let offset = nextOffset(null, { at: T, stamp: T - 40_000, live: live(5) });
    expect(offset).toBe(40_000);
    offset = nextOffset(offset, { at: T + 2_600, stamp: T + 2_000, live: live(6) });
    expect(offset).toBe(600);
    // «Nessuna partita» non ha ora: lo scarto non cambia e il ritardo si conta dall'arrivo.
    const none: Reading = { at: T + 9_000, stamp: null, live: null };
    expect(nextOffset(offset, none)).toBe(600);
    expect(readingTime(none, offset)).toBe(T + 9_000);
    // Senza scarto (ancora nessuna lettura con l'ora) si conta dall'arrivo anche per le altre.
    expect(readingTime({ at: T, stamp: T - 1_000, live: live(1) }, null)).toBe(T);
  });

  test("l'ora del salvataggio dalla lettura: null se non c'è partita o la data non si legge", () => {
    expect(stampOf(live(1, "2026-10-18T09:00:00.000Z"))).toBe(Date.parse("2026-10-18T09:00:00.000Z"));
    expect(stampOf(live(1, "ieri"))).toBeNull();
    expect(stampOf(null)).toBeNull();
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
