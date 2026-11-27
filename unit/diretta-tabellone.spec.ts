import { expect, test } from "@playwright/test";
import {
  BOARD_HIDDEN_POLL_MS,
  BOARD_IDLE_POLL_MS,
  BOARD_LIVE_POLL_MS,
  BOARD_PREGAME_POLL_MS,
  BOARD_CLOCK_SLACK_MS,
  BOARD_TIMEOUT_LINGER_MS,
  boardPollDelay,
  boardSetLabel,
  boardTimeoutSeconds,
  nextBoardTimeout,
  visibleBoardTimeout,
} from "@/lib/diretta/tabellone";
import { TIMEOUT_MS } from "@/lib/timeoutClock";
import type { PublicLiveScore } from "@/lib/types";

/** Il tabellone per la palestra: quando rilegge, il titolo del set e il conto del time-out dall'ora in cui lo Scout l'ha segnato. */

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

const run = (side: "home" | "away", at: number, id = "to-1") => ({ timeoutRun: { side, at, id } });

test("il conto del time-out parte dall'ora dello Scout: 30 secondi, poi resta un po' a zero e sparisce", () => {
  // Lo Scout l'ha segnato a 10 s; il tabellone lo vede un secondo e mezzo dopo: mancano 29 secondi, non 30.
  const started = nextBoardTimeout(score(10, 12, { timeouts: { home: 1, away: 0 }, ...run("home", 10_000) }), null, 11_500);
  expect(started).toEqual({ id: "to-1", side: "home", endsAt: 10_000 + TIMEOUT_MS });
  expect(boardTimeoutSeconds(started!, 11_500)).toBe(29);
  // Le letture seguenti dello stesso time-out tengono il conto.
  expect(nextBoardTimeout(score(10, 12, run("home", 10_000)), started, 20_000)).toBe(started);
  // Finito il conto resta ancora un po' a zero, poi sparisce.
  expect(boardTimeoutSeconds(started!, started!.endsAt + 1)).toBe(0);
  expect(visibleBoardTimeout(started, started!.endsAt + BOARD_TIMEOUT_LINGER_MS - 1)).toBe(started);
  expect(visibleBoardTimeout(started, started!.endsAt + BOARD_TIMEOUT_LINGER_MS)).toBeNull();
});

test("time-out: il primo punto e il time-out insieme, tabellone aperto a time-out cominciato, ripresa del gioco, tolto, partita finita", () => {
  // Il primo punto e il time-out arrivano nella stessa lettura (prima c'era lo 0-0 «non iniziata»): il conto c'è.
  expect(nextBoardTimeout(score(0, 1, { timeouts: { home: 0, away: 1 }, ...run("away", 5_000) }), null, 6_000)?.side).toBe("away");
  // Tabellone aperto (o rete tornata) 20 secondi dopo il time-out: restano 10 secondi, non 30.
  const late = nextBoardTimeout(score(3, 3, run("away", 5_000)), null, 25_000);
  expect(boardTimeoutSeconds(late!, 25_000)).toBe(10);
  // Un time-out finito da un pezzo (gioco fermo, nessun punto dopo) non si mostra.
  expect(visibleBoardTimeout(nextBoardTimeout(score(3, 3, run("away", 5_000)), null, 120_000), 120_000)).toBeNull();
  // Ripreso il gioco (un punto) o tolto nello Scout: la lettura non porta più il time-out e il conto sparisce.
  expect(nextBoardTimeout(score(4, 3), late, 26_000)).toBeNull();
  // Un time-out nuovo (l'altra squadra) prende il posto del primo.
  expect(nextBoardTimeout(score(3, 3, run("home", 24_000, "to-2")), late, 25_000)).toEqual({ id: "to-2", side: "home", endsAt: 24_000 + TIMEOUT_MS });
  // A partita finita niente.
  expect(nextBoardTimeout(score(0, 0, { finished: true, ...run("away", 5_000) }), late, 6_000)).toBeNull();
});

test("orologio dello Scout avanti rispetto al tablet: il conto parte da quando il tabellone vede il time-out", () => {
  const ahead = nextBoardTimeout(score(8, 8, run("home", 100_000)), null, 100_000 - BOARD_CLOCK_SLACK_MS - 1_000);
  expect(ahead?.endsAt).toBe(100_000 - BOARD_CLOCK_SLACK_MS - 1_000 + TIMEOUT_MS);
  // Un poco avanti (meno del margine): si tiene l'ora dello Scout, e il conto non va mai sopra 30.
  const slightly = nextBoardTimeout(score(8, 8, run("home", 100_000)), null, 98_000);
  expect(slightly?.endsAt).toBe(100_000 + TIMEOUT_MS);
  expect(boardTimeoutSeconds(slightly!, 98_000)).toBe(30);
});
