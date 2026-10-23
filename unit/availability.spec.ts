import { expect, test } from "@playwright/test";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import {
  appliesToAthlete,
  canParentChange,
  canUseFamilyLink,
  countByMatch,
  describeUnavailability,
  isReportingOpen,
  matchesForAthlete,
  normalizeNote,
  parseReason,
} from "@/lib/availability/rules";
import { familyLinkMessage, whatsappShareUrl } from "@/lib/availability/share";
import { FAMILY_TOKEN_LENGTH, familyLinkPath, isFamilyToken, newFamilyToken } from "@/lib/availability/token";
import { MAX_NOTE_LENGTH } from "@/lib/availability/types";
import { whatsappPhone } from "@/lib/trips/phone";
import type { Match } from "@/lib/types";

/**
 * Link personali dei genitori e non disponibilità: il codice (lungo, casuale, mai indovinabile), quali partite si vedono, fino
 * a quando si può cambiare, cosa può toccare il genitore e cosa no, e i messaggi per WhatsApp.
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

test.describe("motivo e nota", () => {
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

  test("lo staff legge motivo e nota in una riga", () => {
    expect(describeUnavailability({ reason: "malata", note: "mal di gola" })).toBe("Malata o infortunata · mal di gola");
    expect(describeUnavailability({ reason: "famiglia", note: null })).toBe("Impegno di famiglia");
    expect(describeUnavailability({ reason: null, note: "torniamo domenica" })).toBe("torniamo domenica");
    expect(describeUnavailability({ reason: null, note: null })).toBe("Nessun motivo indicato");
  });
});

test.describe("quando il genitore può cambiare", () => {
  const saturday = match({ matchDate: "2026-11-21T18:00" });

  test("fino all'inizio della partita: anche il giorno stesso, la mattina, se la figlia sta male", () => {
    expect(isReportingOpen(saturday, "2026-11-14T10:00")).toBe(true);
    expect(isReportingOpen(saturday, "2026-11-20T23:59")).toBe(true);
    expect(isReportingOpen(saturday, "2026-11-21T00:00")).toBe(true);
    expect(isReportingOpen(saturday, "2026-11-21T08:30")).toBe(true);
    expect(isReportingOpen(saturday, "2026-11-21T17:59")).toBe(true);
    // Dall'ora della partita in poi non più.
    expect(isReportingOpen(saturday, "2026-11-21T18:00")).toBe(false);
    expect(isReportingOpen(saturday, "2026-11-21T20:00")).toBe(false);
    expect(isReportingOpen(saturday, "2026-11-22T09:00")).toBe(false);
  });

  test("il genitore cambia anche una segnalazione dello staff: conta solo che la partita non sia cominciata", () => {
    expect(canParentChange(saturday, "2026-11-20T12:00")).toEqual({ ok: true });
    expect(canParentChange(saturday, "2026-11-21T09:15")).toEqual({ ok: true });

    const started = canParentChange(saturday, "2026-11-21T18:00");
    expect(started.ok).toBe(false);
    if (!started.ok) expect(started.error).toMatch(/già cominciata/);
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

  test("da oggi in poi, non giocate, della sua categoria, dalla più vicina; quelle già cominciate si vedono ma sono chiuse", () => {
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
      ],
      now,
    );
    expect(list.map((entry) => entry.match.id)).toEqual(["started", "tonight", "soon", "no-category", "later"]);
    // Quella di stasera, non ancora cominciata, si può ancora cambiare; quella delle 11 no.
    expect(list.map((entry) => entry.open)).toEqual([false, true, true, true, true]);
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

test("le segnalazioni si contano partita per partita", () => {
  const counts = countByMatch([{ matchId: "a" }, { matchId: "b" }, { matchId: "a" }]);
  expect(counts.get("a")).toBe(2);
  expect(counts.get("b")).toBe(1);
  expect(counts.get("c")).toBeUndefined();
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

  test("il messaggio contiene il nome, il link e l'invito a non condividerlo", () => {
    const text = familyLinkMessage("Anna Bianchi", "https://esempio.it/disponibilita/abc");
    expect(text).toContain("Anna Bianchi");
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
  expect(isAvailabilityTableMissing(new Error("Could not find the table 'public.match_unavailability' in the schema cache"))).toBe(true);
  expect(isAvailabilityTableMissing("42P01: match_unavailability")).toBe(true);
  expect(isAvailabilityTableMissing(new Error('relation "public.match_trips" does not exist'))).toBe(false);
  expect(isAvailabilityTableMissing(new Error("duplicate key value violates unique constraint athlete_family_links_token_key"))).toBe(false);
  expect(isAvailabilityTableMissing(undefined)).toBe(false);
});
