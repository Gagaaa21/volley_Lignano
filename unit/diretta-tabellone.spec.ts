import { expect, test } from "@playwright/test";
import {
  BOARD_HIDDEN_POLL_MS,
  BOARD_IDLE_POLL_MS,
  BOARD_LIVE_POLL_MS,
  BOARD_PREGAME_POLL_MS,
  BOARD_TIMEOUT_LINGER_MS,
  BOARD_TIMEOUT_MAX_GAP_MS,
  boardPollDelay,
  boardSetLabel,
  nextBoardTimeout,
} from "@/lib/diretta/tabellone";
import { TIMEOUT_MS } from "@/lib/timeoutClock";
import type { PublicLiveScore } from "@/lib/types";

/** Il tabellone per la palestra: quando rilegge, il titolo del set e il conto del time-out ricavato dal numero di time-out. */

function score(home: number, away: number, overrides: Partial<PublicLiveScore> = {}): PublicLiveScore {
  return {
    team: "u14u15",
    category: "U15",
    home: { name: "Volley Lignano", color: "#1c5bae", score: home, sets: 0 },
    away: { name: "Degano", color: "#e11d48", score: away, sets: 0 },
    serving: "home",
    sets: [],
    timeouts: { home: 0, away: 0 },
    finished: false,
    updatedAt: "2026-11-28T17:00:00.000Z",
    ...overrides,
  };
}

test("rilegge ogni secondo mentre si gioca, ogni 3 prima del via, ogni 10 senza partita o a partita finita, piano a schermo spento", () => {
  expect(boardPollDelay(score(3, 2), false)).toBe(BOARD_LIVE_POLL_MS);
  expect(BOARD_LIVE_POLL_MS).toBe(1_000);
  expect(boardPollDelay(score(0, 0, { notStarted: true }), false)).toBe(BOARD_PREGAME_POLL_MS);
  expect(boardPollDelay(null, false)).toBe(BOARD_IDLE_POLL_MS);
  expect(boardPollDelay(score(0, 0, { finished: true }), false)).toBe(BOARD_IDLE_POLL_MS);
  expect(boardPollDelay(score(3, 2), true)).toBe(BOARD_HIDDEN_POLL_MS);
});

test("il titolo: il set in corso, il tie-break, prima del via e a fine partita", () => {
  expect(boardSetLabel(score(3, 2))).toBe("1° set");
  expect(boardSetLabel(score(3, 2, { sets: [{ home: 25, away: 20 }] }))).toBe("2° set");
  expect(boardSetLabel(score(3, 2, { sets: [{ home: 25, away: 20 }, { home: 18, away: 25 }], setRules: { target: 15, deciding: true } }))).toBe("Tie-break");
  expect(boardSetLabel(score(0, 0, { notStarted: true }))).toBe("Si comincia");
  expect(boardSetLabel(score(0, 0, { finished: true }))).toBe("Finale");
});

test("il time-out parte quando il numero sale e dura 30 secondi; chiude se riprende il gioco", () => {
  const before = score(10, 12);
  const during = score(10, 12, { timeouts: { home: 1, away: 0 } });
  const started = nextBoardTimeout(before, during, null, 1_000);
  expect(started).toEqual({ side: "home", endsAt: 1_000 + TIMEOUT_MS, sets: 0, points: 22 });
  // Le letture seguenti, con lo stesso numero, lo tengono.
  expect(nextBoardTimeout(during, during, started, 20_000)).toBe(started);
  // Un punto: il gioco è ripreso.
  expect(nextBoardTimeout(during, score(11, 12, { timeouts: { home: 1, away: 0 } }), started, 25_000)).toBeNull();
  // Finito il conto resta ancora un po', poi si chiude da solo.
  expect(nextBoardTimeout(during, during, started, started!.endsAt + BOARD_TIMEOUT_LINGER_MS - 1)).toBe(started);
  expect(nextBoardTimeout(during, during, started, started!.endsAt + BOARD_TIMEOUT_LINGER_MS)).toBeNull();
});

test("time-out: dell'avversaria, tolto nello Scout, già segnato alla prima lettura, set nuovo, partita finita", () => {
  const away = nextBoardTimeout(score(5, 5), score(5, 5, { timeouts: { home: 0, away: 1 } }), null, 0);
  expect(away?.side).toBe("away");
  // Tolto nello Scout (annulla): il conto si chiude.
  expect(nextBoardTimeout(score(5, 5, { timeouts: { home: 0, away: 1 } }), score(5, 5), away, 2_000)).toBeNull();
  // Alla prima lettura un time-out già segnato non fa partire il conto: non si sa da quanto dura.
  expect(nextBoardTimeout(null, score(5, 5, { timeouts: { home: 1, away: 0 } }), null, 0)).toBeNull();
  // Nel set nuovo i time-out ripartono da zero: nessun conto.
  expect(nextBoardTimeout(score(24, 20, { timeouts: { home: 2, away: 1 } }), score(0, 0, { sets: [{ home: 25, away: 20 }] }), null, 0)).toBeNull();
  // Prima del via o a partita finita: niente.
  expect(nextBoardTimeout(score(0, 0, { notStarted: true }), score(0, 0, { notStarted: true, timeouts: { home: 1, away: 0 } }), null, 0)).toBeNull();
  expect(nextBoardTimeout(score(24, 20), score(0, 0, { finished: true }), away, 0)).toBeNull();
});

test("dopo un buco nelle letture (rete persa, schermo spento) un time-out già cominciato non fa partire il conto da 30", () => {
  const before = score(10, 12);
  const during = score(10, 12, { timeouts: { home: 1, away: 0 } });
  // Letture regolari (1–2 secondi): il conto parte.
  expect(nextBoardTimeout(before, during, null, 10_000, 8_000)?.side).toBe("home");
  expect(nextBoardTimeout(before, during, null, 10_000, 10_000 - BOARD_TIMEOUT_MAX_GAP_MS)?.side).toBe("home");
  // Dopo un buco più lungo il time-out può essere cominciato da un pezzo: niente conto.
  expect(nextBoardTimeout(before, during, null, 30_000, 10_000)).toBeNull();
});
