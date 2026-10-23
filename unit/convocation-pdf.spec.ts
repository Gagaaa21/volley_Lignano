import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import {
  MAX_CONVOCATION_IDS,
  buildConvocationPdf,
  convocationPdfContent,
  resolveConvocatedIds,
  sortConvocated,
} from "@/lib/pdf/convocationPdf";
import type { Match } from "@/lib/types";

/**
 * Le convocazioni in PDF: cosa finisce nel foglio (la partita, il ritrovo, chi è convocata con il numero di maglia) e, soprattutto,
 * cosa non ci finisce mai. Il documento si genera valido anche con nomi insoliti e senza nessuna convocata.
 */

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    team: "u14u15",
    category: "U14",
    opponent: "Degano",
    isHome: true,
    location: "Palestra di Lignano",
    matchDate: "2026-11-21T18:00",
    isFriendly: false,
    isTournament: false,
    meetingTime: "16:30",
    meetingLocation: "Piazzale della chiesa",
    notes: "Nota interna: non va nel foglio",
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

const athlete = (id: string, fullName: string, jerseyNumber: number | null) => ({ id, fullName, jerseyNumber });

test.describe("convocazioni in PDF: l'elenco", () => {
  test("prima chi ha il numero, in ordine di numero; poi le altre in ordine alfabetico", () => {
    const sorted = sortConvocated([
      { number: null, name: "Zoe Neri" },
      { number: 10, name: "Bea Rossi" },
      { number: null, name: "Anna Verdi" },
      { number: 2, name: "Carla Bianchi" },
      { number: 10, name: "Alba Gallo" },
    ]);
    expect(sorted.map((row) => `${row.number ?? "-"} ${row.name}`)).toEqual(["2 Carla Bianchi", "10 Alba Gallo", "10 Bea Rossi", "- Anna Verdi", "- Zoe Neri"]);
  });

  test("l'ordine non dipende da come arrivano, né si cambia l'elenco di partenza", () => {
    const input = [athlete("1", "Zoe", null), athlete("2", "Anna", 7)];
    const before = JSON.stringify(input);
    const content = convocationPdfContent({ match: match(), athletes: input });
    expect(content.rows.map((row) => row.name)).toEqual(["Anna", "Zoe"]);
    expect(JSON.stringify(input)).toBe(before);
  });

  test("la colonna dei numeri c'è solo se almeno un'atleta ne ha uno", () => {
    expect(convocationPdfContent({ match: match(), athletes: [athlete("1", "Anna", null)] }).withNumbers).toBe(false);
    expect(convocationPdfContent({ match: match(), athletes: [athlete("1", "Anna", null), athlete("2", "Bea", 0)] }).withNumbers).toBe(true);
    expect(convocationPdfContent({ match: match(), athletes: [] }).withNumbers).toBe(false);
  });

  test("di ogni convocata ci sono solo numero e nome: mai altro dell'atleta", () => {
    const content = convocationPdfContent({
      match: match(),
      athletes: [{ id: "segreto-1", fullName: "Anna Bianchi", jerseyNumber: 7, notes: "visita medica", isActive: true } as never],
    });
    expect(content.rows).toEqual([{ number: 7, name: "Anna Bianchi" }]);
    expect(JSON.stringify(content)).not.toContain("segreto-1");
    expect(JSON.stringify(content)).not.toContain("visita medica");
  });

  test("il totale al singolare e al plurale", () => {
    expect(convocationPdfContent({ match: match(), athletes: [] }).total).toBe("0 convocate");
    expect(convocationPdfContent({ match: match(), athletes: [athlete("1", "Anna", null)] }).total).toBe("1 convocata");
    expect(convocationPdfContent({ match: match(), athletes: [athlete("1", "A", null), athlete("2", "B", null)] }).total).toBe("2 convocate");
  });
});

test.describe("convocazioni in PDF: chi finisce nel foglio", () => {
  const saved = ["s1", "s2"];

  test("senza selezione sono le convocate salvate; con la selezione, quella (anche vuota)", () => {
    expect([...resolveConvocatedIds(null, saved)]).toEqual(["s1", "s2"]);
    expect([...resolveConvocatedIds("a,b,c", saved)]).toEqual(["a", "b", "c"]);
    expect([...resolveConvocatedIds("", saved)]).toEqual([]);
  });

  test("quello che non è un identificativo si scarta, i doppioni contano una volta", () => {
    expect([...resolveConvocatedIds("ok-1,../etc/passwd,a b,,<script>,ok-1,x".concat(",", "y".repeat(65)), saved)]).toEqual(["ok-1", "x"]);
    expect([...resolveConvocatedIds("550e8400-e29b-41d4-a716-446655440000", saved)]).toEqual(["550e8400-e29b-41d4-a716-446655440000"]);
  });

  test("se ne leggono al massimo cento", () => {
    const many = Array.from({ length: 250 }, (_, i) => `id${i}`).join(",");
    expect(resolveConvocatedIds(many, saved).size).toBe(MAX_CONVOCATION_IDS);
  });
});

test.describe("convocazioni in PDF: la partita", () => {
  test("data, ora e dove si gioca, con casa o trasferta; il ritrovo se c'è", () => {
    const home = convocationPdfContent({ match: match(), athletes: [] });
    expect(home.title).toBe("Convocazioni vs Degano");
    expect(home.when).toBe("21 novembre 2026 · ore 18:00 · Casa");
    expect(home.place).toBe("Palestra di Lignano");
    expect(home.meeting).toBe("ore 16:30 · Piazzale della chiesa");

    const away = convocationPdfContent({ match: match({ isHome: false, meetingTime: null, meetingLocation: "Piazzale" }), athletes: [] });
    expect(away.when).toBe("21 novembre 2026 · ore 18:00 · Trasferta");
    expect(away.meeting).toBe("Piazzale");
    expect(convocationPdfContent({ match: match({ meetingTime: "17:00", meetingLocation: null }), athletes: [] }).meeting).toBe("ore 17:00");
    expect(convocationPdfContent({ match: match({ meetingTime: null, meetingLocation: null }), athletes: [] }).meeting).toBeNull();
  });

  test("amichevole e torneo si dicono; un torneo non ha «vs»", () => {
    expect(convocationPdfContent({ match: match({ isFriendly: true }), athletes: [] }).when).toMatch(/Casa · Amichevole$/);
    const tournament = convocationPdfContent({ match: match({ isTournament: true, opponent: "Torneo di Natale" }), athletes: [] });
    expect(tournament.when).toMatch(/Casa · Torneo$/);
    expect(tournament.title).toBe("Convocazioni Torneo di Natale");
  });

  test("niente note, formazioni, segnalazioni né telefoni: le note della partita non passano", () => {
    const content = JSON.stringify(convocationPdfContent({ match: match(), athletes: [athlete("1", "Anna Bianchi", 7)] }));
    expect(content).not.toContain("Nota interna");
    expect(content).not.toMatch(/formazion|non disponibil|telefono|tel:/i);
  });
});

test.describe("convocazioni in PDF: il documento", () => {
  test("si genera valido, con il titolo giusto e almeno una pagina", async () => {
    const bytes = await buildConvocationPdf({
      match: match(),
      athletes: [athlete("1", "Anna Bianchi", 7), athlete("2", "Bea Rossi", 11), athlete("3", "Carla Verdi", null)],
      generatedAt: new Date("2026-11-10T10:00:00Z"),
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe("Convocazioni vs Degano");
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  test("regge nomi insoliti, nessun numero, nessuna convocata e tante convocate", async () => {
    const odd = await buildConvocationPdf({
      match: match({ opponent: "Società «Città» & C. – ‘Ünïcode’ ★", location: "Palestra “Nuova” – via O'Hara" }),
      athletes: [athlete("1", "Zoë D’Angelo-Ñuñez ★", null), athlete("2", "L’uomo che non c’è 日本語", null)],
    });
    expect((await PDFDocument.load(odd)).getPageCount()).toBeGreaterThanOrEqual(1);

    const none = await buildConvocationPdf({ match: match({ meetingTime: null, meetingLocation: null }), athletes: [] });
    expect((await PDFDocument.load(none)).getPageCount()).toBe(1);

    const many = await buildConvocationPdf({
      match: match(),
      athletes: Array.from({ length: 90 }, (_, i) => athlete(`a${i}`, `Atleta numero ${String(i).padStart(2, "0")}`, i % 3 === 0 ? i : null)),
    });
    expect((await PDFDocument.load(many)).getPageCount()).toBeGreaterThan(1);
  });
});
