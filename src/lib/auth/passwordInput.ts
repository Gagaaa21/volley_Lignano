/**
 * Le password scritte a mano, soprattutto sul telefono: la tastiera aggiunge da sola uno spazio dopo una parola suggerita
 * (o lo lascia all'inizio) e il risultato non si vede. Regole pure, senza dipendenze, provate in unit/password-input.spec.ts.
 */

/** Una password nuova (temporanea o scelta da chi accede) si salva senza spazi all'inizio e alla fine. */
export function cleanNewPassword(raw: FormDataEntryValue | null | undefined): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Le versioni da provare all'accesso: prima com'è scritta, poi senza gli spazi ai lati. La seconda serve a chi ha la password
 * salvata prima di questa regola (le password nuove non hanno spazi ai lati) e a chi ne scrive uno senza accorgersene.
 */
export function loginPasswordCandidates(typed: string): string[] {
  const trimmed = typed.trim();
  return trimmed && trimmed !== typed ? [typed, trimmed] : [typed];
}

/** Il nome utente cercato «così com'è» in un ILIKE di Postgres: `_` e `%` (e `\`) non fanno da jolly. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
