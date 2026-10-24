import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { addPlayer, addRally, endSet, newScoutData, opponentPlayer } from "@/lib/scout/actions";
import { buildScoutPdf } from "@/lib/pdf/scoutPdf";
import { PdfReport } from "@/lib/pdf/report";
import { isSetOver, setTarget } from "@/lib/scout/derive";
import { SCOUT_HOWS, type ScoutData, type ScoutHow, type ScoutSide } from "@/lib/scout/types";
import type { Match } from "@/lib/types";

/** Il PDF del tabellino: si genera davvero (font, stemma e grafico compresi) con partite di ogni forma. */

const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();
const isPdf = (bytes: Uint8Array) => Buffer.from(bytes.slice(0, 5)).toString("latin1") === "%PDF-";

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    team: "u14u15",
    category: "U15",
    opponent: "Pallavolo Degano",
    isHome: true,
    location: "Palestra Comunale, Lignano Sabbiadoro",
    matchDate: "2026-10-17T18:00",
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

/** Generatore pseudo-casuale con seme fisso: stesse partite a ogni esecuzione. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ERRORS: ScoutHow[] = SCOUT_HOWS.filter((how) => !["attack", "block", "ace"].includes(how));

/** Una partita giocata fino in fondo: `usPlayers` giocatrici nostre e `oppPlayers` avversarie. */
function playedMatch({
  seed = 1,
  usNames = ["Giulia Bianchi", "Sara Rossi", "Anna Verdi"],
  oppPlayers = 6,
  pUs = 0.55,
  format = "bo5",
}: { seed?: number; usNames?: string[]; oppPlayers?: number; pUs?: number; format?: "bo5" | "bo3" } = {}): ScoutData {
  const next = random(seed);
  let data = newScoutData({ us: [], opp: [] }, { format });
  usNames.forEach((name, i) => {
    data = addPlayer(data, "us", { id: `a${i}`, name, number: String(i + 1), libero: i === 0 });
  });
  for (let n = 1; n <= oppPlayers; n++) data = addPlayer(data, "opp", opponentPlayer(String(n)));

  let at = Date.UTC(2026, 9, 17, 16, 0, 0);
  let id = 0;
  const wonSets = { us: 0, opp: 0 };
  const needed = format === "bo5" ? 3 : 2;
  const pick = <T,>(list: T[]) => list[Math.floor(next() * list.length)];

  while (wonSets.us < needed && wonSets.opp < needed) {
    const setNumber = wonSets.us + wonSets.opp + 1;
    const target = setTarget(data.settings, setNumber);
    const score = { us: 0, opp: 0 };
    while (!isSetOver(score, target)) {
      const winner: ScoutSide = next() < pUs ? "us" : "opp";
      const roll = next();
      const scorer = roll < 0.7;
      const actor: ScoutSide = scorer ? winner : winner === "us" ? "opp" : "us";
      const how: ScoutHow = !scorer ? pick(ERRORS) : roll < 0.45 ? "attack" : roll < 0.6 ? "block" : "ace";
      const roster = data.roster[actor];
      const player = roster.length > 0 && next() < 0.9 && how !== "rotationFault" && how !== "sanction" ? pick(roster).id : null;
      const others = data.roster[actor === "us" ? "opp" : "us"];
      const victim = how === "block" && others.length > 0 && next() < 0.6 ? pick(others).id : null;
      at += 25_000;
      data = addRally(data, { actor, how, player, victim }, at, `r${++id}`);
      score[winner] += 1;
    }
    wonSets[score.us > score.opp ? "us" : "opp"] += 1;
    at += 60_000;
    data = endSet(data, setNumber % 2 === 1 ? "opp" : "us", at, `s${++id}`);
  }
  return data;
}

test("tabellino PDF: la prima pagina è il tabellino ufficiale in verticale, poi le analisi in orizzontale", async () => {
  const bytes = await buildScoutPdf({ match: match(), scout: playedMatch(), set: null, generatedAt: new Date(Date.UTC(2026, 9, 18, 10, 0, 0)) });
  expect(isPdf(bytes)).toBe(true);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
  // Il tabellino: A4 verticale. Le analisi: A4 orizzontale.
  const first = doc.getPage(0).getSize();
  expect(first.width).toBeCloseTo(595.28, 1);
  expect(first.height).toBeCloseTo(841.89, 1);
  const second = doc.getPage(1).getSize();
  expect(second.width).toBeGreaterThan(second.height);
  expect(doc.getTitle()).toBe("Tabellino vs Pallavolo Degano");
});

test("tabellino PDF: con rose normali il tabellino sta in una pagina; con rose lunghissime continua su una seconda", async () => {
  const portrait = async (bytes: Uint8Array) => {
    const doc = await PDFDocument.load(bytes);
    return doc.getPages().filter((page) => page.getWidth() < page.getHeight()).length;
  };
  const twelve = Array.from({ length: 12 }, (_, i) => `Atleta ${i + 1} Cognome`);
  expect(await portrait(await buildScoutPdf({ match: match(), scout: playedMatch({ seed: 4, usNames: twelve, oppPlayers: 12 }), set: null }))).toBe(1);
  const forty = Array.from({ length: 40 }, (_, i) => `Atleta ${i + 1} Cognome`);
  expect(await portrait(await buildScoutPdf({ match: match(), scout: playedMatch({ seed: 4, usNames: forty, oppPlayers: 30 }), set: null }))).toBe(2);
});

test("tabellino PDF: un solo set, o un set che non esiste (allora tutta la partita)", async () => {
  const scout = playedMatch({ seed: 5 });
  const full = await pageCount(await buildScoutPdf({ match: match(), scout, set: null }));
  const one = await buildScoutPdf({ match: match(), scout, set: 2 });
  expect(isPdf(one)).toBe(true);
  expect(await pageCount(one)).toBeLessThanOrEqual(full);
  const missing = await buildScoutPdf({ match: match(), scout, set: 9 });
  expect(await pageCount(missing)).toBe(full);
});

test("tabellino PDF: nomi con accenti, lettere strane ed emoji non rompono il documento", async () => {
  const names = ["Łukasza Đorđević", "María-José Ñandú", "Zoë 🏐 Çelik", "A", "Un nome molto molto lungo che non entra in nessuna colonna della tabella Bianchi-Rossi-Verdi"];
  const scout = playedMatch({ seed: 9, usNames: names });
  const bytes = await buildScoutPdf({
    match: match({ opponent: "Pol. Città di Ĺubľana «Ñ» 🏐", location: "Palestra “Ćirić”, Šibenik" }),
    scout,
    set: null,
  });
  expect(isPdf(bytes)).toBe(true);
  expect(await pageCount(bytes)).toBeGreaterThanOrEqual(3);
});

test("tabellino PDF: una rosa numerosa va a capo sulle pagine senza perdere righe", async () => {
  const names = Array.from({ length: 30 }, (_, i) => `Atleta ${i + 1} Cognome`);
  const scout = playedMatch({ seed: 3, usNames: names, oppPlayers: 25 });
  const bytes = await buildScoutPdf({ match: match(), scout, set: null });
  expect(isPdf(bytes)).toBe(true);
  expect(await pageCount(bytes)).toBeGreaterThanOrEqual(4);
});

test("tabellino PDF: partita a 3 set, in corso, senza giocatrici indicate, e con una sola azione", async () => {
  const short = playedMatch({ seed: 2, format: "bo3", usNames: [], oppPlayers: 0 });
  expect(isPdf(await buildScoutPdf({ match: match(), scout: short, set: null }))).toBe(true);

  let live = newScoutData({ us: [], opp: [] });
  live = addRally(live, { actor: "us", how: "ace", player: null }, Date.UTC(2026, 9, 17, 16, 0, 0), "r1");
  const bytes = await buildScoutPdf({ match: match({ category: null, isFriendly: true }), scout: live, set: null });
  expect(isPdf(bytes)).toBe(true);
  expect(await pageCount(bytes)).toBeGreaterThanOrEqual(1);

  // Anche senza nessun punto (la rotta non lo permette, ma il documento si costruisce lo stesso).
  expect(isPdf(await buildScoutPdf({ match: match(), scout: newScoutData({ us: [], opp: [] }), set: null }))).toBe(true);
});

test("PDF generico: una tabella che sta in una pagina intera non si spezza, un titolo non resta solo", async () => {
  const report = await PdfReport.create({ title: "Prova", orientation: "landscape" });
  const columns = [
    { header: "Nome", weight: 3 },
    { header: "Valore", weight: 1, align: "center" as const },
  ];
  const rows = Array.from({ length: 12 }, (_, i) => [`Riga ${i + 1}`, String(i)]);
  const height = report.tableHeight(columns, rows);
  expect(height).toBeGreaterThan(12 * 14);

  // Due tabelle da 12 righe in orizzontale non ci stanno nella stessa pagina: la seconda comincia in una nuova.
  report.heading("Prima");
  report.table(columns, rows, { keepTogether: true });
  const before = report.pageCount;
  report.requireSpace(24 + height);
  report.heading("Seconda");
  report.table(columns, rows, { keepTogether: true });
  expect(report.pageCount).toBe(before + 1);

  report.pageBreak();
  expect(report.pageCount).toBe(before + 2);
  expect(isPdf(await report.finish())).toBe(true);
});
