import { expect, test } from "@playwright/test";
import { matchesToEvents } from "@/lib/calendar";
import { CATEGORY_LABELS, CATEGORY_RGB, CATEGORY_SHORT, CATEGORY_SOLID, parseCategoryFilter } from "@/lib/category";
import { buildICSCalendar, buildICSSingleEvent, eventFullTitle, eventTitle } from "@/lib/ics";
import { buildMatchesPdf, categoryCell, categoryTone, dateCell } from "@/lib/pdf/matchesPdf";
import type { Match } from "@/lib/types";

/** Under 14 e Under 15 si distinguono ovunque: stessa sigla e stessi due colori nelle pagine, nel calendario del telefono
 * (.ics) e nei PDF. Qui si proteggono le regole; l'aspetto si guarda a occhio. */

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: Math.random().toString(36).slice(2),
    team: "u14u15",
    category: "U15",
    opponent: "Degano",
    isHome: true,
    location: "Palestra Comunale",
    matchDate: "2026-11-20T18:00",
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
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

test.describe("categorie: sigle, colori e filtro", () => {
  test("ogni categoria ha sigla, colore pieno per le pagine e colore per i PDF", () => {
    expect(CATEGORY_SHORT).toEqual({ U14: "U14", U15: "U15" });
    expect(Object.keys(CATEGORY_SOLID).sort()).toEqual(["U14", "U15"]);
    expect(CATEGORY_SOLID.U14).not.toBe(CATEGORY_SOLID.U15);
    expect(CATEGORY_RGB.U14).not.toEqual(CATEGORY_RGB.U15);
    expect(CATEGORY_LABELS).toEqual({ U14: "Under 14", U15: "Under 15" });
  });

  test("il filtro ?cat= accetta solo U14 e U15, il resto è «tutte»", () => {
    expect(parseCategoryFilter("U14")).toBe("U14");
    expect(parseCategoryFilter("U15")).toBe("U15");
    for (const odd of [undefined, null, "", "u14", "U16", "all", "boh"]) expect(parseCategoryFilter(odd)).toBe("all");
  });
});

test.describe("calendario del telefono (.ics)", () => {
  test("il titolo di una partita ha la categoria davanti, così due categorie con la stessa avversaria non sono uguali", () => {
    const [u14, u15] = matchesToEvents([match({ category: "U14" }), match({ category: "U15" })]);
    expect(eventFullTitle(u14)).toBe("U14 · vs Degano");
    expect(eventFullTitle(u15)).toBe("U15 · vs Degano");
    // Il titolo semplice (quello della pagina, dove l'etichetta sta accanto) non cambia.
    expect(eventTitle(u14)).toBe("vs Degano");

    const ics = buildICSCalendar([u14, u15], "Volley Lignano");
    expect(ics).toContain("SUMMARY:U14 · vs Degano");
    expect(ics).toContain("SUMMARY:U15 · vs Degano");
  });

  test("un torneo tiene il suo nome, con la categoria davanti", () => {
    const [event] = matchesToEvents([match({ category: "U14", isTournament: true, opponent: "Triangolare con Latisana" })]);
    expect(eventFullTitle(event)).toBe("U14 · Triangolare con Latisana");
  });

  test("l'evento singolo ha il suo nome con la categoria", () => {
    const [event] = matchesToEvents([match({ category: "U15" })]);
    expect(buildICSSingleEvent(event)).toContain("X-WR-CALNAME:U15 · vs Degano");
  });
});

test.describe("PDF delle partite", () => {
  test("la categoria è un riquadro pieno con la sigla, nel colore della categoria; la riga ha la barra dello stesso colore", () => {
    const u14 = match({ category: "U14" });
    const u15 = match({ category: "U15" });
    expect(categoryCell(u14)).toEqual({ text: "U14", tone: "u14", pill: true });
    expect(categoryCell(u15)).toEqual({ text: "U15", tone: "u15", pill: true });
    expect(dateCell(u14).bar).toBe("u14");
    expect(dateCell(u15).bar).toBe("u15");
    expect(dateCell(u14).bold).toBe(true);
    expect(categoryTone(null)).toBeUndefined();
  });

  test("una partita senza categoria non rompe il documento (nessun riquadro, nessuna barra)", async () => {
    const noCategory = match({ category: null });
    expect(categoryCell(noCategory).pill).toBeUndefined();
    expect(dateCell(noCategory).bar).toBeUndefined();
    const bytes = await buildMatchesPdf({ matches: [noCategory, match({ category: "U14" })], audience: "staff", category: null });
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });

  test("tutte le categorie, o una sola con l'etichetta nell'intestazione: il PDF si genera", async () => {
    const matches = [match({ category: "U14" }), match({ category: "U15", matchDate: "2026-11-21T16:00" })];
    for (const category of [null, "U14", "U15"] as const) {
      const bytes = await buildMatchesPdf({ matches, audience: "public", category, today: "2026-11-01" });
      expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    }
  });
});
