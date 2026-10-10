import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { summarizeAttendance } from "@/lib/attendanceSummary";
import { buildAttendancePdf } from "@/lib/pdf/attendancePdf";
import { buildMatchesPdf } from "@/lib/pdf/matchesPdf";
import { buildPhysicalTestsPdf } from "@/lib/pdf/physicalTestsPdf";
import { PdfReport, pdfFilename } from "@/lib/pdf/report";
import { parseTableParams, tableParamsToSearch, buildOverviewAthletes } from "@/lib/physicalTestTable";
import type { Athlete, AttendanceSession, Match, PhysicalTest } from "@/lib/types";

/** I PDF «da stampare»: si generano davvero (font e stemma compresi) e si
 * controlla che siano file validi, con le pagine giuste e senza errori anche
 * con nomi insoliti. L'aspetto si guarda a occhio, qui si proteggono le regole. */

async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}
const isPdf = (bytes: Uint8Array) => Buffer.from(bytes.slice(0, 5)).toString("latin1") === "%PDF-";

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

function athlete(id: string, fullName: string, overrides: Partial<Athlete> = {}): Athlete {
  return {
    id,
    fullName,
    team: "u14u15",
    category: "U14",
    group: null,
    isActive: true,
    notes: null,
    createdBy: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

test.describe("base dei PDF", () => {
  test("un documento vuoto è un PDF valido di una pagina, con orientamento a scelta", async () => {
    const portrait = await PdfReport.create({ title: "Prova" });
    const bytes = await portrait.finish();
    expect(isPdf(bytes)).toBe(true);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(height).toBeGreaterThan(width);

    const landscape = await PdfReport.create({ title: "Prova", orientation: "landscape" });
    const size = (await PDFDocument.load(await landscape.finish())).getPage(0).getSize();
    expect(size.width).toBeGreaterThan(size.height);
  });

  test("una tabella lunga va a capo sulle pagine seguenti", async () => {
    const report = await PdfReport.create({ title: "Lunga" });
    report.table(
      [{ header: "N", weight: 1 }, { header: "Testo", weight: 4 }],
      Array.from({ length: 120 }, (_, i) => [String(i + 1), `Riga numero ${i + 1}`]),
    );
    const bytes = await report.finish();
    expect(await pageCount(bytes)).toBeGreaterThan(2);
  });

  test("una cella con testo lunghissimo o una parola più larga della colonna non rompe il documento", async () => {
    const report = await PdfReport.create({ title: "Celle" });
    report.table(
      [{ header: "A", weight: 1 }, { header: "B", weight: 1 }],
      [["x".repeat(400), "parola ".repeat(300)]],
    );
    expect(isPdf(await report.finish())).toBe(true);
  });

  test("caratteri che il font non ha (lettere dell'est, simboli, emoji) non fanno fallire il PDF", async () => {
    const report = await PdfReport.create({ title: "Nomi ✓ strani" });
    report.table(
      [{ header: "Nome", weight: 1 }],
      [["Đurđević Łukasz Ørsted"], ["Maria • Rossi → Bianchi €"], ["Sofia 🏐"], ["Zoë Müller-Çelik"]],
    );
    expect(isPdf(await report.finish())).toBe(true);
  });

  test("nome file sicuro", () => {
    expect(pdfFilename("Calendario partite Under 15 · Volley Lignano")).toBe("calendario-partite-under-15-volley-lignano.pdf");
    expect(pdfFilename("")).toBe("documento.pdf");
  });
});

test.describe("PDF delle partite", () => {
  const all: Match[] = [
    match({ matchDate: "2026-11-20T18:00", opponent: "Faedis", meetingTime: "17:00", meetingLocation: "Parcheggio" }),
    match({ matchDate: "2026-11-27T20:30", category: "U14", opponent: "Đurđević", isHome: false, notes: "Divise bianche" }),
    match({ matchDate: "2026-12-29T14:00", isTournament: true, opponent: "Triangolare di Natale" }),
    match({
      matchDate: "2026-10-18T11:00",
      opponent: "Itas",
      setScores: [{ us: 25, them: 20 }, { us: 25, them: 18 }, { us: 25, them: 15 }],
      resultSetsWon: 3,
      resultSetsLost: 0,
    }),
    match({ matchDate: "2026-10-04T11:00", isFriendly: true, opponent: "Amichevole Udine" }),
    match({
      matchDate: "2026-09-27T10:00",
      isTournament: true,
      opponent: "Torneo di settembre",
      tournamentGames: [{ id: "g", opponent: "Cividale", setScores: [{ us: 25, them: 10 }, { us: 25, them: 12 }] }],
    }),
  ];

  test("pubblico e staff producono un PDF valido, con tutte le categorie o con una sola", async () => {
    for (const audience of ["public", "staff"] as const) {
      for (const category of [null, "U14", "U15"] as const) {
        const bytes = await buildMatchesPdf({ matches: all, audience, category, today: "2026-11-01" });
        expect(isPdf(bytes), `${audience} ${category}`).toBe(true);
        expect(await pageCount(bytes)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("senza partite il documento c'è lo stesso (con i messaggi «nessuna partita»)", async () => {
    const bytes = await buildMatchesPdf({ matches: [], audience: "public", category: null });
    expect(isPdf(bytes)).toBe(true);
  });

  test("molte partite occupano più pagine", async () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      match({ matchDate: `2027-0${1 + (i % 5)}-${String(1 + (i % 27)).padStart(2, "0")}T18:00`, opponent: `Squadra ${i}` }),
    );
    const bytes = await buildMatchesPdf({ matches: many, audience: "public", category: null, today: "2026-11-01" });
    expect(await pageCount(bytes)).toBeGreaterThan(2);
  });
});

test.describe("riepilogo presenze", () => {
  const athletes = [
    athlete("a", "Anna Rossi"),
    athlete("b", "Bianca Verdi"),
    athlete("c", "Carla Neri", { isActive: false }),
  ];
  const session = (id: string, records: AttendanceSession["records"]): AttendanceSession => ({
    id,
    trainingRuleId: "t",
    team: "u14u15",
    sessionDate: "2026-10-01",
    title: "Allenamento",
    location: "Palestra",
    records,
    createdBy: null,
    createdAt: "",
    updatedAt: "",
  });
  const sessions = [
    session("1", { a: "present", b: "excused" }),
    session("2", { a: "present", b: "present" }),
    session("3", { a: "unexcused", b: "present" }),
    session("4", { a: "present" }),
  ];

  test("percentuale sulle sedute in cui l'atleta era nel registro", () => {
    const rows = summarizeAttendance(athletes, sessions, false);
    const anna = rows.find((r) => r.athlete.id === "a")!;
    const bianca = rows.find((r) => r.athlete.id === "b")!;
    expect(anna).toMatchObject({ total: 4, present: 3, unexcused: 1, excused: 0, pct: 75 });
    expect(bianca).toMatchObject({ total: 3, present: 2, excused: 1, unexcused: 0, pct: 67 });
    expect(rows.find((r) => r.athlete.id === "c")).toMatchObject({ total: 0, pct: null });
  });

  test("Minivolley: il totale sono tutte le sedute registrate, non solo quelle in cui c'è una voce", () => {
    const rows = summarizeAttendance(athletes, sessions, true);
    expect(rows.find((r) => r.athlete.id === "b")).toMatchObject({ total: 4, present: 3, pct: 75 });
  });

  test("il PDF si genera per U14/U15 e per il Minivolley, anche senza nessuna seduta", async () => {
    expect(isPdf(await buildAttendancePdf({ team: "u14u15", athletes, sessions }))).toBe(true);
    expect(isPdf(await buildAttendancePdf({ team: "minivolley", athletes, sessions }))).toBe(true);
    expect(isPdf(await buildAttendancePdf({ team: "u14u15", athletes: [], sessions: [] }))).toBe(true);
  });
});

test.describe("riepilogo test fisici", () => {
  const athletes = [athlete("a", "Anna Rossi"), athlete("b", "Bianca Verdi", { category: "U15" }), athlete("c", "Carla Neri")];
  const test1 = (athleteId: string, testName: string, value: string, date: string, n: number): PhysicalTest => ({
    id: `${athleteId}-${testName}-${date}`,
    athleteId,
    team: "u14u15",
    testName,
    value,
    date,
    notes: null,
    createdBy: null,
    createdAt: `2026-10-0${n}T10:00:00Z`,
    updatedAt: "",
  });
  const tests = [
    test1("a", "Peso (kg)", "48,5", "2026-10-01", 1),
    test1("a", "Peso (kg)", "49", "2026-10-08", 2),
    test1("b", "Peso (kg)", "52", "2026-10-08", 3),
    test1("b", "Sit and reach", "12 cm", "2026-10-08", 4),
  ];
  const overview = buildOverviewAthletes(tests, athletes);

  test("ogni vista produce un PDF valido in orizzontale", async () => {
    for (const query of ["view=ultimo", "view=giorno&day=2026-10-08", "view=tutte", "view=ultimo&empty=1", "view=giorno"]) {
      const bytes = await buildPhysicalTestsPdf({ team: "u14u15", athletes: overview, params: parseTableParams(new URLSearchParams(query)) });
      expect(isPdf(bytes), query).toBe(true);
      const size = (await PDFDocument.load(bytes)).getPage(0).getSize();
      expect(size.width).toBeGreaterThan(size.height);
    }
  });

  test("filtri senza risultati: il PDF c'è lo stesso", async () => {
    const params = parseTableParams(new URLSearchParams("view=ultimo&q=nessuna"));
    expect(isPdf(await buildPhysicalTestsPdf({ team: "u14u15", athletes: overview, params }))).toBe(true);
  });

  test("i parametri dell'indirizzo sono controllati: uno sbagliato torna al predefinito", () => {
    const bad = parseTableParams(new URLSearchParams("view=boh&day=ieri&sort=hack&dir=su&q=" + "x".repeat(500)));
    expect(bad.view).toBe("ultimo");
    expect(bad.day).toBe("");
    expect(bad.sort).toEqual({ column: "name", direction: "asc" });
    expect(bad.query.length).toBe(80);
  });

  test("lo stato della tabella a schermo si trasforma in indirizzo e torna uguale", () => {
    const params = parseTableParams(new URLSearchParams("view=giorno&day=2026-10-08&q=ann&label=Under%2014&empty=1&sort=sjAltezza&dir=asc"));
    expect(params).toMatchObject({ view: "giorno", day: "2026-10-08", query: "ann", label: "Under 14", includeEmpty: true });
    expect(params.sort).toEqual({ column: "sjAltezza", direction: "asc" });
    const again = parseTableParams(new URLSearchParams(tableParamsToSearch(params)));
    expect(again).toEqual(params);
  });
});
