/**
 * Freno ai tentativi di accesso sbagliati: dopo LOGIN_MAX_FAILURES password sbagliate in LOGIN_WINDOW_MS per lo stesso account,
 * l'account non accetta altre password per LOGIN_LOCK_MS (nemmeno quella giusta). Chi prova a indovinare una password deve così
 * andare piano, mentre a un allenatore che sbaglia qualche volta non cambia niente. Lo stato sta tra le impostazioni
 * (app_settings), una chiave per account: si conta solo per gli account che esistono. Regole pure, provate in
 * unit/login-throttle.spec.ts.
 */

export const LOGIN_MAX_FAILURES = 8;
export const LOGIN_WINDOW_MS = 15 * 60_000;
export const LOGIN_LOCK_MS = 15 * 60_000;

export type LoginFailures = { count: number; firstAt: number; lockedUntil: number };

export const NO_LOGIN_FAILURES: LoginFailures = { count: 0, firstAt: 0, lockedUntil: 0 };

export function loginFailuresKey(staffId: string): string {
  return `login_failures:${staffId}`;
}

export function parseLoginFailures(raw: string | null): LoginFailures {
  if (!raw) return NO_LOGIN_FAILURES;
  try {
    const value = JSON.parse(raw) as Partial<LoginFailures>;
    const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0);
    return { count: num(value.count), firstAt: num(value.firstAt), lockedUntil: num(value.lockedUntil) };
  } catch {
    return NO_LOGIN_FAILURES;
  }
}

/** Quanto manca alla fine del blocco (0 = si può provare). */
export function loginLockedFor(state: LoginFailures, now: number): number {
  return Math.max(0, state.lockedUntil - now);
}

/** Un tentativo sbagliato in più: la finestra riparte se è passata, all'ultimo tentativo concesso scatta il blocco. */
export function recordLoginFailure(state: LoginFailures, now: number): LoginFailures {
  const fresh = state.count === 0 || now - state.firstAt > LOGIN_WINDOW_MS || (state.lockedUntil > 0 && now >= state.lockedUntil);
  const count = fresh ? 1 : state.count + 1;
  const firstAt = fresh ? now : state.firstAt;
  return { count, firstAt, lockedUntil: count >= LOGIN_MAX_FAILURES ? now + LOGIN_LOCK_MS : 0 };
}

/** Il messaggio del blocco, in minuti interi (almeno 1). */
export function loginLockedMessage(waitMs: number): string {
  const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
  return `Troppi tentativi sbagliati: per sicurezza l'account è bloccato per ${minutes} ${minutes === 1 ? "minuto" : "minuti"}. Riprova dopo.`;
}
