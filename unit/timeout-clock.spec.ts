import { expect, test } from "@playwright/test";
import {
  TIMEOUT_LINGER_MS,
  TIMEOUT_MS,
  fractionLeft,
  formatClock,
  isTimeoutForgotten,
  secondsLeft,
  startTimeoutRun,
  timeoutPhase,
} from "@/lib/timeoutClock";
import { TIMEOUT_SECONDS } from "@/lib/volleyRules";

/** Il conto alla rovescia dei time-out nel Live score: 30 secondi, con i conti fatti sull'ora che passa. */

const T0 = 1_700_000_000_000;

test.describe("conto alla rovescia del time-out", () => {
  test("dura 30 secondi, come da regolamento", () => {
    expect(TIMEOUT_SECONDS).toBe(30);
    expect(TIMEOUT_MS).toBe(30_000);
    const run = startTimeoutRun("A", 1, 12, T0);
    expect(run).toEqual({ team: "A", nth: 1, startedAt: T0, endsAt: T0 + 30_000, points: 12 });
  });

  test("scende un secondo alla volta, arrotondando per eccesso, e si ferma a zero", () => {
    const run = startTimeoutRun("B", 2, 0, T0);
    expect(secondsLeft(run, T0)).toBe(30);
    expect(secondsLeft(run, T0 + 1)).toBe(30); // appena partito si vede ancora 30
    expect(secondsLeft(run, T0 + 999)).toBe(30);
    expect(secondsLeft(run, T0 + 1000)).toBe(29);
    expect(secondsLeft(run, T0 + 29_000)).toBe(1);
    expect(secondsLeft(run, T0 + 29_999)).toBe(1);
    expect(secondsLeft(run, T0 + 30_000)).toBe(0);
    expect(secondsLeft(run, T0 + 90_000)).toBe(0); // mai sotto zero, anche a pagina rimasta in secondo piano
  });

  test("la barra scende da 1 a 0", () => {
    const run = startTimeoutRun("A", 1, 0, T0);
    expect(fractionLeft(run, T0)).toBe(1);
    expect(fractionLeft(run, T0 + 15_000)).toBeCloseTo(0.5, 5);
    expect(fractionLeft(run, T0 + 30_000)).toBe(0);
    expect(fractionLeft(run, T0 + 99_000)).toBe(0);
    expect(fractionLeft(run, T0 - 5_000)).toBe(1);
  });

  test("le fasi: in corso, ultimi 10 secondi, finito", () => {
    const run = startTimeoutRun("A", 1, 0, T0);
    expect(timeoutPhase(run, T0)).toBe("running");
    expect(timeoutPhase(run, T0 + 19_000)).toBe("running"); // restano 11
    expect(timeoutPhase(run, T0 + 20_000)).toBe("warning"); // restano 10
    expect(timeoutPhase(run, T0 + 29_999)).toBe("warning");
    expect(timeoutPhase(run, T0 + 30_000)).toBe("over");
  });

  test("a tempo scaduto il riquadro resta ancora un poco, poi si può chiudere da solo", () => {
    const run = startTimeoutRun("A", 1, 0, T0);
    expect(isTimeoutForgotten(run, T0 + 30_000)).toBe(false);
    expect(isTimeoutForgotten(run, T0 + 30_000 + TIMEOUT_LINGER_MS - 1)).toBe(false);
    expect(isTimeoutForgotten(run, T0 + 30_000 + TIMEOUT_LINGER_MS)).toBe(true);
  });

  test("si scrive come sul tabellone: minuti e secondi", () => {
    expect(formatClock(30)).toBe("0:30");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-3)).toBe("0:00");
    expect(formatClock(75)).toBe("1:15");
  });
});
