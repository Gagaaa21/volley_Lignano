import { expect, test } from "@playwright/test";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import {
  absentByMatch,
  absentLabel,
  appliesToAthlete,
  canParentChange,
  canUseFamilyLink,
  describeAbsence,
  isAbsence,
  isReportingOpen,
  matchesForAthlete,
  normalizeAbsence,
  normalizeNote,
  parseReason,
  reportingDeadline,
} from "@/lib/availability/rules";
import { familyLinkMessage, whatsappShareUrl } from "@/lib/availability/share";
import { FAMILY_TOKEN_LENGTH, familyLinkPath, isFamilyToken, newFamilyToken } from "@/lib/availability/token";
import { MAX_NOTE_LENGTH, REPORT_CLOSES_DAYS_BEFORE } from "@/lib/availability/types";
import { whatsappPhone } from "@/lib/trips/phone";
import type { Match } from "@/lib/types";

/**
 * Link personali dei genitori e assenze alle partite: il codice (lungo, casuale, mai indovinabile), quali partite si vedono,
 * fino a quando si può segnalare (5 giorni prima), come si scrive e si legge un'assenza, come si contano e i messaggi per WhatsApp.
 */

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    team: "u14u15",
    category: "U14",
    opponent: "Degano",
    isHome: false,
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
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

test.describe("il codice del link", () => {
  test("è di 32 caratteri adatti a un indirizzo e ogni volta diverso", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const token = newFamilyToken();
      expect(token).toHaveLength(FAMILY_TOKEN_LENGTH);
      expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      seen.add(token);
    }
    expect(seen.size).toBe(300);
  });

  test("si riconosce la forma di un codice: tutto il resto si scarta senza interrogare il database", () => {
    expect(isFamilyToken(newFamilyToken())).toBe(true);
    expect(isFamilyToken("a".repeat(32))).toBe(true);
    expect(isFamilyToken("a".repeat(31))).toBe(false);
    expect(isFamilyToken("a".repeat(33))).toBe(false);
    expect(isFamilyToken(`${"a".repeat(31)}+`)).toBe(false);
    expect(isFamilyToken(`${"a".repeat(31)}/`)).toBe(false);
    expect(isFamilyToken(`${"a".repeat(31)} `)).toBe(false);
    expect(isFamilyToken("../../admin/atlete/aaaaaaaaaaaaaaaaaa")).toBe(false);
    expect(isFamilyToken("")).toBe(false);
    expect(isFamilyToken(undefined)).toBe(false);
    expect(isFamilyToken(12345678901234567890123456789012)).toBe(false);
  });

  test("il percorso della pagina del genitore", () => {
    expect(familyLinkPath("abc")).toBe("/disponibilita/abc");
  });
});

test.describe("l'assenza: motivo e nota", () => {
  test("il motivo è solo uno di quelli previsti", () => {
    expect(parseReason("malata")).toBe("malata");
    expect(parseReason("famiglia")).toBe("famiglia");
    expect(parseReason("altro")).toBe("altro");
    for (const wrong of ["Malata", "", " malata", "scuola", "__proto__", undefined, null, 3]) expect(parseReason(wrong)).toBeNull();
  });

  test("la nota si ripulisce: spazi e a capo in uno, senza caratteri di controllo, al massimo 120 caratteri", () => {
    expect(normalizeNote("  mal   di\n\ngola\t ")).toBe("mal di gola");
    expect(normalizeNote("a\u0000b\u0007c")).toBe("a b c");
    expect(normalizeNote("x".repeat(500))).toHaveLength(MAX_NOTE_LENGTH);
    expect(normalizeNote(`${"x".repeat(119)}   altro`)).toBe("x".repeat(119));
    expect(normalizeNote("   ")).toBeNull();
    expect(normalizeNote("")).toBeNull();
    expect(normalizeNote(undefined)).toBeNull();
    expect(normalizeNote(42)).toBeNull();
  });

  test("si scrive sempre e solo un'assenza: motivo previsto o nessuno, nota ripulita", () => {
    expect(normalizeAbsence({ reason: "malata", note: "  mal   di gola " })).toEqual({ status: "absent", reason: "malata", note: "mal di gola" });
    // Un motivo inventato o una nota vuota non passano: resta «Non ci sarà» e basta.
    expect(normalizeAbsence({ reason: "scuola", note: "   " })).toEqual({ status: "absent", reason: null, note: null });
    expect(normalizeAbsence({})).toEqual({ status: "absent", reason: null, note: null });
    expect(normalizeAbsence({ note: "x".repeat(500) }).note).toHaveLength(MAX_NOTE_LENGTH);
  });

  test("contano solo le assenze: le righe «present» di una versione di prova no", () => {
    expect(isAbsence({ status: "absent" })).toBe(true);
    expect(isAbsence({ status: "present" })).toBe(false);
  });

  test("lo staff legge l'assenza in una riga", () => {
    expect(describeAbsence({ reason: null, note: null })).toBe("Non ci sarà");
    expect(describeAbsence({ reason: "malata", note: "mal di gola" })).toBe("Non ci sarà · Malata o infortunata · mal di gola");
    expect(describeAbsence({ reason: "famiglia", note: null })).toBe("Non ci sarà · Impegno di famiglia");
    expect(describeAbsence({ reason: null, note: "torniamo domenica" })).toBe("Non ci sarà · torniamo domenica");
  });
});

test.describe("fino a quando il genitore può segnalare", () => {
  const saturday = match({ matchDate: "2026-11-21T18:00" });

  test("5 giorni prima della partita, alla stessa ora: partita sabato alle 18 → fino a lunedì alle 18", () => {
    expect(REPORT_CLOSES_DAYS_BEFORE).toBe(5);
    expect(reportingDeadline(saturday)).toBe("2026-11-16T18:00");
    expect(reportingDeadline(match({ matchDate: "2026-11-22T09:30" }))).toBe("2026-11-17T09:30");
  });

  test("si conta sul calendario: cambio di mese, d'anno, anni bisestili e ora legale non spostano niente", () => {
    expect(reportingDeadline(match({ matchDate: "2026-12-03T18:00" }))).toBe("2026-11-28T18:00");
    expect(reportingDeadline(match({ matchDate: "2027-01-02T10:00" }))).toBe("2026-12-28T10:00");
    expect(reportingDeadline(match({ matchDate: "2028-03-03T17:00" }))).toBe("2028-02-27T17:00");
    expect(reportingDeadline(match({ matchDate: "2027-03-03T17:00" }))).toBe("2027-02-26T17:00");
    // Il 29 marzo 2026 si passa all'ora legale, il 25 ottobre 2026 si torna a quella solare: l'ora resta la stessa.
    expect(reportingDeadline(match({ matchDate: "2026-03-31T18:00" }))).toBe("2026-03-26T18:00");
    expect(reportingDeadline(match({ matchDate: "2026-10-28T20:30" }))).toBe("2026-10-23T20:30");
    // Senza ora (non dovrebbe succedere) si chiude a mezzanotte.
    expect(reportingDeadline(match({ matchDate: "2026-11-21" }))).toBe("2026-11-16T00:00");
  });

  test("aperte fino a un minuto prima della scadenza, chiuse da lì in poi (anche il giorno della partita)", () => {
    expect(isReportingOpen(saturday, "2026-11-01T10:00")).toBe(true);
    expect(isReportingOpen(saturday, "2026-11-16T00:00")).toBe(true);
    expect(isReportingOpen(saturday, "2026-11-16T17:59")).toBe(true);
    expect(isReportingOpen(saturday, "2026-11-16T18:00")).toBe(false);
    expect(isReportingOpen(saturday, "2026-11-17T09:00")).toBe(false);
    expect(isReportingOpen(saturday, "2026-11-21T08:30")).toBe(false);
    expect(isReportingOpen(saturday, "2026-11-22T09:00")).toBe(false);
  });

  test("il genitore segnala o toglie un'assenza (anche se l'ha scritta l'allenatore) solo finché sono aperte", () => {
    expect(canParentChange(saturday, "2026-11-10T12:00")).toEqual({ ok: true });
    expect(canParentChange(saturday, "2026-11-16T17:59")).toEqual({ ok: true });

    const closed = canParentChange(saturday, "2026-11-16T18:00");
    expect(closed.ok).toBe(false);
    if (!closed.ok) {
      expect(closed.error).toMatch(/chiuse/);
      expect(closed.error).toMatch(/5 giorni prima/);
      expect(closed.error).toMatch(/scrivi all'allenatore/);
    }
  });

  test("il link funziona solo per un'atleta attiva di U14/U15", () => {
    expect(canUseFamilyLink({ team: "u14u15", isActive: true })).toBe(true);
    expect(canUseFamilyLink({ team: "u14u15", isActive: false })).toBe(false);
    expect(canUseFamilyLink({ team: "minivolley", isActive: true })).toBe(false);
  });
});

test.describe("le partite che vede il genitore", () => {
  const athlete = { team: "u14u15", category: "U14" } as const;

  test("una partita riguarda l'atleta se è della sua squadra e categoria (o se manca la categoria)", () => {
    expect(appliesToAthlete(match({ category: "U14" }), athlete)).toBe(true);
    expect(appliesToAthlete(match({ category: "U15" }), athlete)).toBe(false);
    expect(appliesToAthlete(match({ category: null }), athlete)).toBe(true);
    expect(appliesToAthlete(match({ category: "U15" }), { team: "u14u15", category: null })).toBe(true);
    expect(appliesToAthlete(match({ team: "minivolley", category: null }), athlete)).toBe(false);
  });

  test("da oggi in poi, non giocate, della sua categoria, dalla più vicina; quelle a meno di 5 giorni si vedono ma sono chiuse", () => {
    const now = "2026-11-10T15:00";
    const list = matchesForAthlete(
      athlete,
      [
        match({ id: "later", matchDate: "2026-11-28T16:00" }),
        match({ id: "past", matchDate: "2026-11-09T18:00" }),
        match({ id: "started", matchDate: "2026-11-10T11:00" }),
        match({ id: "tonight", matchDate: "2026-11-10T20:00" }),
        match({ id: "other-category", category: "U15", matchDate: "2026-11-15T16:00" }),
        match({ id: "played", matchDate: "2026-11-12T16:00", setScores: [{ us: 25, them: 20 }], resultSetsWon: 3, resultSetsLost: 0 }),
        match({ id: "no-category", category: null, matchDate: "2026-11-14T10:00" }),
        match({ id: "soon", matchDate: "2026-11-11T18:00" }),
        // Fra 5 giorni esatti chiude adesso; un'ora dopo è ancora aperta.
        match({ id: "edge-closed", matchDate: "2026-11-15T15:00" }),
        match({ id: "edge-open", matchDate: "2026-11-15T16:00" }),
      ],
      now,
    );
    expect(list.map((entry) => entry.match.id)).toEqual(["started", "tonight", "soon", "no-category", "edge-closed", "edge-open", "later"]);
    expect(list.map((entry) => entry.open)).toEqual([false, false, false, false, false, true, true]);
  });

  test("al massimo le prime dodici", () => {
    const many = Array.from({ length: 20 }, (_, i) => match({ id: `m${i}`, matchDate: `2026-12-${String(i + 1).padStart(2, "0")}T18:00` }));
    expect(matchesForAthlete(athlete, many, "2026-11-01T09:00")).toHaveLength(12);
    expect(matchesForAthlete(athlete, many, "2026-11-01T09:00", 3).map((entry) => entry.match.id)).toEqual(["m0", "m1", "m2"]);
  });

  test("senza partite non c'è niente da mostrare", () => {
    expect(matchesForAthlete(athlete, [], "2026-11-01T09:00")).toEqual([]);
  });
});

test.describe("contare le assenze", () => {
  test("le assenti si contano partita per partita; le vecchie righe «present» non contano", () => {
    const counts = absentByMatch([
      { matchId: "a", status: "absent" },
      { matchId: "b", status: "absent" },
      { matchId: "a", status: "absent" },
      { matchId: "a", status: "present" },
      { matchId: "c", status: "present" },
    ]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
    expect(counts.get("c")).toBeUndefined();
    expect(absentByMatch([]).size).toBe(0);
  });

  test("la scritta per l'elenco partite e la dashboard", () => {
    expect(absentLabel(1)).toBe("1 non c'è");
    expect(absentLabel(2)).toBe("2 non ci sono");
    expect(absentLabel(11)).toBe("11 non ci sono");
  });
});

test.describe("WhatsApp", () => {
  test("il numero si porta nella forma di wa.me: solo cifre con il prefisso, italiano se manca", () => {
    expect(whatsappPhone("333 1234567")).toBe("393331234567");
    expect(whatsappPhone("+39 340 7654321")).toBe("393407654321");
    expect(whatsappPhone("0039 340 7654321")).toBe("393407654321");
    expect(whatsappPhone("39 340 7654321")).toBe("393407654321");
    expect(whatsappPhone("391 2345678")).toBe("393912345678");
    expect(whatsappPhone("+44 7700 900123")).toBe("447700900123");
    expect(whatsappPhone("0432 123456")).toBe("390432123456");
    expect(whatsappPhone("non è un numero")).toBeNull();
    expect(whatsappPhone("123")).toBeNull();
  });

  test("il messaggio contiene il nome, il link, fino a quando si può avvisare e l'invito a non condividerlo", () => {
    const text = familyLinkMessage("Anna Bianchi", "https://esempio.it/disponibilita/abc");
    expect(text).toContain("Anna Bianchi");
    expect(text).toMatch(/non può esserci/);
    expect(text).toMatch(/5 giorni prima/);
    expect(text).toContain("https://esempio.it/disponibilita/abc");
    expect(text).toMatch(/non condividerlo/);
  });

  test("apre la chat del genitore se c'è un numero valido, altrimenti la scelta della chat", () => {
    const text = "Ciao & ciao: https://esempio.it/x?y=1";
    expect(whatsappShareUrl("333 1234567", text)).toBe(`https://wa.me/393331234567?text=${encodeURIComponent(text)}`);
    expect(whatsappShareUrl(null, text)).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`);
    expect(whatsappShareUrl("abc", text)).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`);
  });
});

test("tabelle mancanti: si riconosce l'errore di Postgres e di Supabase, non altri", () => {
  expect(isAvailabilityTableMissing(new Error('relation "public.athlete_family_links" does not exist'))).toBe(true);
  expect(isAvailabilityTableMissing(new Error("Could not find the table 'public.match_availability' in the schema cache"))).toBe(true);
  expect(isAvailabilityTableMissing("42P01: match_availability")).toBe(true);
  expect(isAvailabilityTableMissing(new Error('relation "public.match_trips" does not exist'))).toBe(false);
  expect(isAvailabilityTableMissing(new Error("duplicate key value violates unique constraint athlete_family_links_token_key"))).toBe(false);
  expect(isAvailabilityTableMissing(undefined)).toBe(false);
});
