import { expect, test } from "@playwright/test";
import {
  DEFAULT_REPORTING_RULES,
  autoDeadline,
  effectiveDeadline,
  isLocalDateTime,
  isPlainMatchReporting,
  normalizeParentText,
  parentBlockMessage,
  parentClosedNote,
  parseMatchReporting,
  parseReportingRules,
  reminderMessage,
  reportingState,
  rulesFromInput,
  rulesSummary,
  serializeMatchReporting,
  serializeReportingRules,
  type MatchReporting,
  type ReportingRules,
} from "@/lib/availability/reporting";
import { canParentChange, matchesForAthlete } from "@/lib/availability/rules";
import type { Match } from "@/lib/types";

/** Fino a quando i genitori possono segnalare: regole generali e scelte a mano partita per partita. */

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    team: "u14u15",
    category: "U14",
    opponent: "Pol. Codroipo",
    isHome: true,
    location: "Palestra",
    matchDate: "2026-11-21T18:00",
    isFriendly: false,
    isTournament: false,
    meetingTime: null,
    meetingLocation: null,
    notes: null,
    calledUpAthleteIds: [],
    setScores: null,
    resultSetsWon: null,
    resultSetsLost: null,
    tournamentGames: null,
    createdBy: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

const rules = (overrides: Partial<ReportingRules> = {}): ReportingRules => ({ ...DEFAULT_REPORTING_RULES, ...overrides });
const setting = (overrides: Partial<MatchReporting> = {}): MatchReporting => ({
  matchId: "m1",
  closesAt: null,
  hidden: false,
  message: null,
  updatedAt: "2026-11-01T10:00:00.000Z",
  updatedBy: "Marco",
  ...overrides,
});

const saturday = match();

test.describe("la scadenza delle regole", () => {
  test("di serie 5 giorni prima, alla stessa ora della partita", () => {
    expect(autoDeadline(saturday)).toBe("2026-11-16T18:00");
    expect(autoDeadline(saturday, rules())).toBe("2026-11-16T18:00");
  });

  test("altri giorni e un'ora fissa", () => {
    expect(autoDeadline(saturday, rules({ daysBefore: 2 }))).toBe("2026-11-19T18:00");
    expect(autoDeadline(saturday, rules({ daysBefore: 2, closingTime: "21:00" }))).toBe("2026-11-19T21:00");
    expect(autoDeadline(match({ matchDate: "2026-12-02T18:00" }), rules({ daysBefore: 3, closingTime: "08:30" }))).toBe("2026-11-29T08:30");
  });

  test("0 giorni = fino all'inizio; mai oltre l'inizio, nemmeno con un'ora fissa più tarda", () => {
    expect(autoDeadline(saturday, rules({ daysBefore: 0 }))).toBe("2026-11-21T18:00");
    expect(autoDeadline(saturday, rules({ daysBefore: 0, closingTime: "21:00" }))).toBe("2026-11-21T18:00");
    expect(autoDeadline(saturday, rules({ daysBefore: 0, closingTime: "12:00" }))).toBe("2026-11-21T12:00");
  });

  test("in una frase per lo staff", () => {
    expect(rulesSummary(rules())).toBe("5 giorni prima, alla stessa ora della partita");
    expect(rulesSummary(rules({ daysBefore: 1, closingTime: "21:00" }))).toBe("1 giorno prima, alle 21:00");
    expect(rulesSummary(rules({ daysBefore: 0 }))).toBe("all'inizio della partita");
    expect(rulesSummary(rules({ daysBefore: 0, closingTime: "12:00" }))).toBe("il giorno della partita alle 12:00 (al più tardi all'inizio)");
  });
});

test.describe("le scelte a mano per una partita", () => {
  test("una scadenza scelta vale al posto di quella delle regole, ma mai oltre l'inizio (anche se la partita viene anticipata)", () => {
    expect(effectiveDeadline(saturday, rules(), setting({ closesAt: "2026-11-19T20:00" }))).toBe("2026-11-19T20:00");
    expect(effectiveDeadline(saturday, rules(), setting({ closesAt: "2026-11-25T20:00" }))).toBe("2026-11-21T18:00");
    expect(effectiveDeadline(match({ matchDate: "2026-11-18T17:00" }), rules(), setting({ closesAt: "2026-11-19T20:00" }))).toBe("2026-11-18T17:00");
    expect(effectiveDeadline(saturday, rules(), null)).toBe("2026-11-16T18:00");
  });

  test("aperte fino alla scadenza, chiuse da lì; chi le chiude a mano o ne sceglie la scadenza si vede", () => {
    expect(reportingState(saturday, "2026-11-10T09:00", rules())).toEqual({ kind: "open", deadline: "2026-11-16T18:00", manual: false });
    expect(reportingState(saturday, "2026-11-16T18:00", rules())).toEqual({ kind: "closed", deadline: "2026-11-16T18:00", manual: false });
    // «Chiudi adesso»: la scadenza diventa adesso.
    expect(reportingState(saturday, "2026-11-10T09:00", rules(), setting({ closesAt: "2026-11-10T09:00" }))).toEqual({
      kind: "closed",
      deadline: "2026-11-10T09:00",
      manual: true,
    });
    // «Riapri fino all'inizio»: anche dentro i 5 giorni.
    expect(reportingState(saturday, "2026-11-20T12:00", rules(), setting({ closesAt: "2026-11-21T18:00" }))).toEqual({
      kind: "open",
      deadline: "2026-11-21T18:00",
      manual: true,
    });
  });

  test("prima la scelta di non chiedere ai genitori, poi la pausa, poi la scadenza", () => {
    expect(reportingState(saturday, "2026-11-10T09:00", rules({ paused: true }), setting({ hidden: true }))).toEqual({ kind: "hidden" });
    expect(reportingState(saturday, "2026-11-10T09:00", rules({ paused: true }), setting({ closesAt: "2026-11-21T18:00" }))).toEqual({ kind: "paused" });
  });

  test("una scelta che non cambia niente non serve tenerla", () => {
    expect(isPlainMatchReporting(setting())).toBe(true);
    expect(isPlainMatchReporting(setting({ hidden: true }))).toBe(false);
    expect(isPlainMatchReporting(setting({ message: "Si parte in pullman" }))).toBe(false);
    expect(isPlainMatchReporting(setting({ closesAt: "2026-11-19T20:00" }))).toBe(false);
  });
});

test.describe("cosa vede e cosa può fare il genitore", () => {
  test("il perché di una partita chiusa, per ogni caso", () => {
    const r = rules();
    expect(parentBlockMessage({ kind: "open", deadline: "x", manual: false }, r)).toBeNull();
    expect(parentBlockMessage({ kind: "closed", deadline: "x", manual: false }, r)).toBe(
      "Le segnalazioni per questa partita sono chiuse: si possono fare fino a 5 giorni prima. Per avvisare, scrivi all'allenatore.",
    );
    expect(parentBlockMessage({ kind: "closed", deadline: "x", manual: false }, rules({ daysBefore: 0 }))).toBe(
      "Le segnalazioni per questa partita sono chiuse: si possono fare fino all'inizio della partita. Per avvisare, scrivi all'allenatore.",
    );
    expect(parentBlockMessage({ kind: "closed", deadline: "x", manual: false }, rules({ daysBefore: 1 }))).toMatch(/fino a 1 giorno prima\./);
    expect(parentBlockMessage({ kind: "closed", deadline: "x", manual: true }, r)).toMatch(/chiuse dall'allenatore/);
    expect(parentBlockMessage({ kind: "paused" }, r)).toMatch(/sospese/);
    expect(parentBlockMessage({ kind: "hidden" }, r)).toMatch(/non si segnalano dal link/);
    for (const kind of ["closed", "paused", "hidden"] as const) {
      const state = kind === "closed" ? { kind, deadline: "x", manual: false } : { kind };
      expect(parentBlockMessage(state, r)).toMatch(/scrivi all'allenatore/);
    }
  });

  test("la riga sotto una partita chiusa", () => {
    expect(parentClosedNote({ kind: "closed", deadline: "x", manual: false }, rules())).toBe(
      "Segnalazioni chiuse (5 giorni prima della partita): per avvisare, scrivi all'allenatore.",
    );
    expect(parentClosedNote({ kind: "closed", deadline: "x", manual: false }, rules({ daysBefore: 1 }))).toMatch(/1 giorno prima/);
    expect(parentClosedNote({ kind: "closed", deadline: "x", manual: true }, rules())).toMatch(/chiuse dall'allenatore/);
    expect(parentClosedNote({ kind: "paused" }, rules())).toMatch(/sospese/);
    expect(parentClosedNote({ kind: "open", deadline: "x", manual: false }, rules())).toBeNull();
  });

  test("le azioni del genitore seguono le stesse regole", () => {
    expect(canParentChange(saturday, "2026-11-10T12:00", rules())).toEqual({ ok: true });
    expect(canParentChange(saturday, "2026-11-10T12:00", rules(), setting({ closesAt: "2026-11-10T09:00" })).ok).toBe(false);
    expect(canParentChange(saturday, "2026-11-20T12:00", rules(), setting({ closesAt: "2026-11-21T18:00" }))).toEqual({ ok: true });
    expect(canParentChange(saturday, "2026-11-10T12:00", rules({ paused: true })).ok).toBe(false);
    expect(canParentChange(saturday, "2026-11-10T12:00", rules(), setting({ hidden: true })).ok).toBe(false);
    expect(canParentChange(saturday, "2026-11-18T12:00", rules({ daysBefore: 2 }))).toEqual({ ok: true });
  });

  test("dal link non si vedono le partite per cui non si chiede niente; le altre portano la loro scelta", () => {
    const athlete = { team: "u14u15", category: "U14" } as const;
    const hidden = match({ id: "hidden", matchDate: "2026-11-22T18:00" });
    const closedByHand = match({ id: "closed", matchDate: "2026-11-28T18:00" });
    const list = matchesForAthlete(athlete, [saturday, hidden, closedByHand], "2026-11-10T09:00", 12, {
      rules: rules(),
      matches: new Map([
        ["hidden", setting({ matchId: "hidden", hidden: true })],
        ["closed", setting({ matchId: "closed", closesAt: "2026-11-09T20:00", message: "Pullman alle 15" })],
      ]),
    });
    expect(list.map((entry) => entry.match.id)).toEqual(["m1", "closed"]);
    expect(list.map((entry) => entry.open)).toEqual([true, false]);
    expect(list[1].state).toEqual({ kind: "closed", deadline: "2026-11-09T20:00", manual: true });
    expect(list[1].setting?.message).toBe("Pullman alle 15");
  });
});

test.describe("lettura e scrittura nell'archivio", () => {
  test("le regole si rileggono uguali; quello che non torna lascia il valore di serie", () => {
    const saved = rules({ daysBefore: 3, closingTime: "21:00", paused: true, notice: "Torneo a Natale", updatedAt: "2026-11-01T10:00:00Z", updatedBy: "Marco" });
    expect(parseReportingRules(serializeReportingRules(saved))).toEqual(saved);
    expect(parseReportingRules(null)).toEqual(DEFAULT_REPORTING_RULES);
    expect(parseReportingRules("non è json")).toEqual(DEFAULT_REPORTING_RULES);
    expect(parseReportingRules(JSON.stringify({ daysBefore: 40, closingTime: "25:00", paused: "sì", notice: 3 }))).toEqual(DEFAULT_REPORTING_RULES);
    expect(parseReportingRules(JSON.stringify({ daysBefore: 2.5 })).daysBefore).toBe(5);
  });

  test("la scelta di una partita si rilegge uguale; una data sbagliata non vale", () => {
    const saved = setting({ closesAt: "2026-11-19T20:00", hidden: true, message: "Si parte alle 15" });
    expect(parseMatchReporting("m1", serializeMatchReporting(saved))).toEqual(saved);
    expect(parseMatchReporting("m1", JSON.stringify({ closesAt: "2026-02-31T10:00" }))?.closesAt).toBeNull();
    expect(parseMatchReporting("m1", null)).toBeNull();
    expect(parseMatchReporting("m1", "[1,2]")).toBeNull();
  });

  test("date e ore vere, testi puliti", () => {
    expect(isLocalDateTime("2026-11-19T20:00")).toBe(true);
    expect(isLocalDateTime("2026-02-29T20:00")).toBe(false);
    expect(isLocalDateTime("2028-02-29T20:00")).toBe(true);
    expect(isLocalDateTime("2026-11-19T24:00")).toBe(false);
    expect(isLocalDateTime("2026-11-19 20:00")).toBe(false);
    expect(normalizeParentText("  Si   parte\nalle 15\u0007 ", 200)).toBe("Si parte alle 15");
    expect(normalizeParentText("   ", 200)).toBeNull();
    expect(normalizeParentText("x".repeat(250), 200)).toHaveLength(200);
  });
});

test.describe("le regole come le scrive lo staff", () => {
  test("giorni da 0 a 14, ora della partita o fissa, pausa e avviso", () => {
    expect(rulesFromInput({ daysBefore: "3", closingMode: "fixed", closingTime: "21:00", paused: "on", notice: " Ultima giornata " })).toEqual({
      ok: true,
      rules: { daysBefore: 3, closingTime: "21:00", paused: true, notice: "Ultima giornata" },
    });
    expect(rulesFromInput({ daysBefore: "0", closingMode: "match", closingTime: "21:00", paused: null, notice: "" })).toEqual({
      ok: true,
      rules: { daysBefore: 0, closingTime: null, paused: false, notice: null },
    });
  });

  test("valori sbagliati: un errore chiaro", () => {
    expect(rulesFromInput({ daysBefore: "15", closingMode: "match", closingTime: "", paused: null, notice: "" })).toEqual({
      ok: false,
      error: "I giorni prima della partita vanno da 0 a 14.",
    });
    expect(rulesFromInput({ daysBefore: "tre", closingMode: "match", closingTime: "", paused: null, notice: "" }).ok).toBe(false);
    expect(rulesFromInput({ daysBefore: "2", closingMode: "fixed", closingTime: "9", paused: null, notice: "" })).toEqual({
      ok: false,
      error: "Scrivi l'ora di chiusura così: 21:00.",
    });
  });
});

test("il promemoria per il gruppo: partite e scadenze, mai nomi né link", () => {
  const text = reminderMessage([
    { when: "sab 21 nov, 18:00", title: "U14 vs Pol. Codroipo", deadline: "lun 16 nov, 18:00" },
    { when: "sab 28 nov, 17:00", title: "U15 @ Udine", deadline: "lun 23 nov, 17:00" },
  ]);
  expect(text).toBe(
    [
      "Promemoria assenze: se una ragazza non potrà esserci a una di queste partite, segnatelo dal vostro link personale entro la scadenza.",
      "• sab 21 nov, 18:00 · U14 vs Pol. Codroipo: entro lun 16 nov, 18:00",
      "• sab 28 nov, 17:00 · U15 @ Udine: entro lun 23 nov, 17:00",
      "Chi ci sarà non deve fare niente. Non trovate più il link? Chiedetelo all'allenatore.",
    ].join("\n"),
  );
  expect(text).not.toMatch(/disponibilita\//);
  expect(reminderMessage([])).toBeNull();
});
