import { expect, test } from "@playwright/test";
import {
  LOGIN_LOCK_MS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  loginLockedFor,
  loginLockedMessage,
  NO_LOGIN_FAILURES,
  parseLoginFailures,
  recordLoginFailure,
} from "@/lib/auth/loginThrottle";

const T0 = 1_800_000_000_000;

test.describe("Freno ai tentativi di accesso", () => {
  test("qualche password sbagliata non blocca niente", () => {
    let state = NO_LOGIN_FAILURES;
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) state = recordLoginFailure(state, T0 + i * 1000);
    expect(state.count).toBe(LOGIN_MAX_FAILURES - 1);
    expect(loginLockedFor(state, T0 + 10_000)).toBe(0);
  });

  test("all'ultimo tentativo concesso l'account si blocca per un po', poi si riparte da zero", () => {
    let state = NO_LOGIN_FAILURES;
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) state = recordLoginFailure(state, T0 + i * 1000);
    const last = T0 + (LOGIN_MAX_FAILURES - 1) * 1000;
    expect(state.lockedUntil).toBe(last + LOGIN_LOCK_MS);
    expect(loginLockedFor(state, last + 60_000)).toBe(LOGIN_LOCK_MS - 60_000);
    expect(loginLockedFor(state, last + LOGIN_LOCK_MS)).toBe(0);
    // Finito il blocco, un nuovo errore ricomincia il conto (non riblocca subito).
    const after = recordLoginFailure(state, last + LOGIN_LOCK_MS + 1);
    expect(after).toEqual({ count: 1, firstAt: last + LOGIN_LOCK_MS + 1, lockedUntil: 0 });
  });

  test("errori lontani nel tempo non si sommano", () => {
    let state = recordLoginFailure(NO_LOGIN_FAILURES, T0);
    state = recordLoginFailure(state, T0 + 1000);
    state = recordLoginFailure(state, T0 + LOGIN_WINDOW_MS + 5000);
    expect(state.count).toBe(1);
  });

  test("lo stato salvato si rilegge, e uno rovinato vale «nessun errore»", () => {
    const state = recordLoginFailure(NO_LOGIN_FAILURES, T0);
    expect(parseLoginFailures(JSON.stringify(state))).toEqual(state);
    expect(parseLoginFailures(null)).toEqual(NO_LOGIN_FAILURES);
    expect(parseLoginFailures("non json")).toEqual(NO_LOGIN_FAILURES);
    expect(parseLoginFailures('{"count":-3,"firstAt":"x"}')).toEqual(NO_LOGIN_FAILURES);
  });

  test("il messaggio dice i minuti, almeno uno", () => {
    expect(loginLockedMessage(15 * 60_000)).toContain("15 minuti");
    expect(loginLockedMessage(20_000)).toContain("1 minuto");
  });
});
