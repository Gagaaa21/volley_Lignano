import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { buildScoutPdf } from "@/lib/pdf/scoutPdf";
import { autoServePlayer, benchOf, benchOptions, COURT_ROWS, courtSpots, jerseyLabel, lineupSummary, lineupWrittenThisSet, receptionCourt, reentryOfPlayer, servePlayerWasAuto, setLineupPending, substitutionWarningFor } from "@/lib/scout/court";
import type { Match } from "@/lib/types";
import {
  addPlayer,
  addRally,
  addTouch,
  endSet,
  newScoutData,
  opponentPlayer,
  removePlayer,
  scoutReducer,
  setLineup,
  substitute,
  undoLast,
  updatePlayer,
  updateRally,
  usedPlayerIds,
  type LineupInput,
} from "@/lib/scout/actions";
import { currentServer, deriveScout, type ScoutCourt } from "@/lib/scout/derive";
import { receptionOpen } from "@/lib/scout/phases";
import { canDo, isBlockHow, isServeHow } from "@/lib/scout/rules";
import { scoutDataSchema } from "@/lib/scout/schema";
import type { ScoutData, ScoutHow, ScoutSide } from "@/lib/scout/types";

/**
 * Scout con la formazione in campo (facoltativa): chi gioca in ogni posizione,
 * la libero, le rotazioni quando si conquista la battuta e i cambi: le stesse
 * regole del Live score, ricavate dagli eventi.
 */

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);
const MIN = 60_000;

const ids = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"];

function roster(): ScoutData {
  let data = newScoutData({ us: [], opp: [] }, { firstServer: "us" });
  ids.forEach((id, i) => {
    data = addPlayer(data, "us", { id, name: `Atleta ${i + 1}`, number: String(i + 1), libero: false });
  });
  data = addPlayer(data, "us", { id: "ul", name: "Libera", number: "20", libero: true });
  for (let n = 1; n <= 8; n++) data = addPlayer(data, "opp", opponentPlayer(String(n)));
  return data;
}

/** u1…u6 nelle posizioni 1…6; le centrali sono u3 (posizione 3) e u6 (posizione 6). */
const OURS: LineupInput = {
  positions: ["u1", "u2", "u3", "u4", "u5", "u6"],
  libero: "ul",
  hosts: ["u3", "u6"],
};
const THEIRS: LineupInput = {
  positions: ["opp-1", "opp-2", "opp-3", "opp-4", "opp-5", "opp-6"],
  libero: null,
  hosts: [null, null],
};

let seq = 0;
const id = () => `e${++seq}`;
const at = (data: ScoutData) => T0 + data.events.length * MIN;

function withLineups(data: ScoutData): ScoutData {
  return setLineup(setLineup(data, "us", OURS, at(data), id()), "opp", THEIRS, T0, id());
}

function point(data: ScoutData, winner: ScoutSide, how: ScoutHow = "attack"): ScoutData {
  // Punto di chi fa un attacco vincente: l'attore è chi vince.
  return addRally(data, { actor: winner, how, player: null, victim: null }, at(data), id());
}

test.describe("formazione in campo", () => {
  test("senza formazione non c'è nessun campo da seguire", () => {
    const view = deriveScout(point(roster(), "us"));
    expect(view.court).toEqual({ us: null, opp: null });
    expect(view.rallies[0].court).toEqual({ us: null, opp: null });
  });

  test("la formazione di partenza è la rotazione 1, con la libero già dentro per la centrale in seconda linea", () => {
    const view = deriveScout(withLineups(roster()));
    expect(view.court.us).toMatchObject({
      positions: ["u1", "u2", "u3", "u4", "u5", "u6"],
      rotation: 1,
      libero: "ul",
      // Batte noi: u1 in posizione 1 (non è una centrale). u6 è centrale in seconda linea: entra la libero.
      liberoFor: "u6",
    });
    expect(view.court.us?.onCourt).toEqual(["u1", "u2", "u3", "u4", "u5", "ul"]);
    expect(view.court.opp?.onCourt).toEqual(["opp-1", "opp-2", "opp-3", "opp-4", "opp-5", "opp-6"]);
  });

  test("chi batte è in posizione 1: lo si ricava dalla formazione di chi ha la battuta", () => {
    const view = deriveScout(withLineups(roster()));
    expect(currentServer(view)).toBe("us");
    expect(view.court.us?.positions[0]).toBe("u1");
    // A battere per primi sono loro: il loro battitore è opp-1.
    const theirs = deriveScout(withLineups({ ...roster(), settings: { ...roster().settings, firstServer: "opp" } }));
    expect(currentServer(theirs)).toBe("opp");
    expect(theirs.court.opp?.positions[0]).toBe("opp-1");
  });

  test("chi conquista la battuta ruota, chi la tiene no", () => {
    let data = withLineups(roster());
    data = point(data, "us"); // batte noi e fa punto: nessuna rotazione
    let view = deriveScout(data);
    expect(view.court.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(view.court.us?.rotation).toBe(1);

    data = point(data, "opp"); // loro conquistano la battuta: ruotano loro
    view = deriveScout(data);
    expect(view.court.opp?.positions).toEqual(["opp-2", "opp-3", "opp-4", "opp-5", "opp-6", "opp-1"]);
    expect(view.court.opp?.rotation).toBe(2);
    expect(view.court.us?.rotation).toBe(1);

    data = point(data, "us"); // riconquistiamo la battuta: ruotiamo noi
    view = deriveScout(data);
    expect(view.court.us?.positions).toEqual(["u2", "u3", "u4", "u5", "u6", "u1"]);
    expect(view.court.us?.rotation).toBe(2);
  });

  test("ogni scambio ricorda chi era in campo quando è cominciato", () => {
    let data = withLineups(roster());
    data = point(data, "opp");
    data = point(data, "opp");
    const [first, second] = deriveScout(data).rallies;
    expect(first.court.opp?.positions[0]).toBe("opp-1");
    // Dopo il punto a loro hanno conquistato la battuta e sono ruotati: batte opp-2.
    expect(second.court.opp?.positions[0]).toBe("opp-2");
    expect(first.court.us?.rotation).toBe(1);
  });

  test("la libero esce quando la centrale ruota a rete e rientra per l'altra", () => {
    let data = withLineups(roster());
    // La libero sta per u6 (posizione 6). Riconquistiamo la battuta due volte: u6 va in 5, poi in 4 (a rete).
    data = point(data, "opp"); // perdiamo la battuta
    data = point(data, "us"); // ruotiamo: u6 in 5
    data = point(data, "opp");
    data = point(data, "us"); // ruotiamo ancora: u6 in 4, a rete
    const view = deriveScout(data);
    expect(view.court.us?.positions[3]).toBe("u6");
    // In seconda linea c'è ora u3 (centrale) in posizione 1 che batte: nessuna libero.
    expect(view.court.us?.positions[0]).toBe("u3");
    expect(view.court.us?.liberoFor).toBeNull();
    expect(view.court.us?.onCourt).toEqual(["u3", "u4", "u5", "u6", "u1", "u2"]);
  });

  test("il set dopo riparte dalla formazione di partenza, con la libero ricalcolata", () => {
    let data = withLineups(roster());
    for (let i = 0; i < 24; i++) data = point(data, i % 3 === 0 ? "opp" : "us");
    // Portiamo il set a un risultato qualunque e chiudiamolo: non serve il 25.
    data = endSet(data, "opp", at(data), id());
    const view = deriveScout(data);
    expect(view.current?.n).toBe(2);
    expect(view.court.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(view.court.us?.rotation).toBe(1);
    expect(view.court.opp?.positions).toEqual(["opp-1", "opp-2", "opp-3", "opp-4", "opp-5", "opp-6"]);
    // Batte loro: noi riceviamo, quindi anche la centrale in posizione 6 resta sostituita dalla libero.
    expect(view.court.us?.liberoFor).toBe("u6");
    // E la formazione di partenza del 1° set è quella ricordata.
    expect(view.sets[0].lineups.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
  });

  test("una nuova formazione prima del primo scambio del set è la nuova partenza", () => {
    let data = withLineups(roster());
    data = point(data, "us");
    data = endSet(data, "opp", at(data), id());
    const changed: LineupInput = { ...OURS, positions: ["u2", "u1", "u3", "u4", "u5", "u6"] };
    data = setLineup(data, "us", changed, at(data), id());
    data = point(data, "us");
    data = point(data, "opp");
    const view = deriveScout(data);
    expect(view.sets[1].lineups.us?.positions).toEqual(["u2", "u1", "u3", "u4", "u5", "u6"]);
  });

  test("scrivere di nuovo la formazione subito dopo la sostituisce, non la accumula", () => {
    let data = withLineups(roster());
    const before = data.events.length;
    data = setLineup(data, "opp", { ...THEIRS, positions: ["opp-2", "opp-1", "opp-3", "opp-4", "opp-5", "opp-6"] }, at(data), id());
    expect(data.events.length).toBe(before);
    expect(deriveScout(data).court.opp?.positions[0]).toBe("opp-2");
    // Dopo un punto invece resta nel registro come correzione.
    data = point(data, "us");
    const withPoint = data.events.length;
    data = setLineup(data, "opp", THEIRS, at(data), id());
    expect(data.events.length).toBe(withPoint + 1);
  });

  test("giocatrici che non sono in rosa o ripetute non entrano nella formazione", () => {
    const data = setLineup(roster(), "us", { positions: ["u1", "u1", "zzz", "u4", "u5", "u6"], libero: "u4", hosts: ["u9", "u5"] }, T0, id());
    const event = data.events[0];
    expect(event.type === "lineup" && event.positions).toEqual(["u1", null, null, "u4", "u5", "u6"]);
    // La libero non può essere anche in campo tra le sei; una sostituita deve stare tra le sei.
    expect(event.type === "lineup" && event.libero).toBeNull();
    expect(event.type === "lineup" && event.hosts).toEqual([null, "u5"]);
  });
});

test.describe("ace e battuta sbagliata a chi batte", () => {
  test("solo ace e battuta sbagliata sono sempre di chi batte", () => {
    expect(isServeHow("ace")).toBe(true);
    expect(isServeHow("serveError")).toBe(true);
    for (const how of ["attack", "block", "receptionError", "attackError", "rotationFault"] as const) expect(isServeHow(how)).toBe(false);
  });

  test("con la formazione vanno da soli a chi è in posizione 1 della squadra che batte, per noi e per loro", () => {
    let data = withLineups(roster());
    let view = deriveScout(data);
    expect(currentServer(view)).toBe("us");
    expect(autoServePlayer("ace", "us", currentServer(view), view.court.us)).toBe("u1");
    expect(autoServePlayer("serveError", "us", currentServer(view), view.court.us)).toBe("u1");
    // Poi batte loro (hanno conquistato la battuta e ruotato): la loro posizione 1 adesso è la n. 2.
    data = point(data, "opp");
    view = deriveScout(data);
    expect(autoServePlayer("ace", "opp", currentServer(view), view.court.opp)).toBe("opp-2");
    expect(autoServePlayer("serveError", "opp", currentServer(view), view.court.opp)).toBe("opp-2");
  });

  test("altrimenti si chiede «chi?» come sempre: senza formazione, per chi non batte o per altri modi di fare punto", () => {
    const view = deriveScout(withLineups(roster()));
    // Battiamo noi: un «ace loro» non torna, e si chiede.
    expect(autoServePlayer("ace", "opp", "us", view.court.opp)).toBeUndefined();
    expect(autoServePlayer("serveError", "opp", "us", view.court.opp)).toBeUndefined();
    expect(autoServePlayer("attack", "us", "us", view.court.us)).toBeUndefined();
    expect(autoServePlayer("ace", "us", "us", null)).toBeUndefined();
    expect(autoServePlayer("ace", "us", null, view.court.us)).toBeUndefined();
    // Una posizione 1 vuota: non si sa chi batte.
    const empty = deriveScout(setLineup(roster(), "us", { ...OURS, positions: [null, "u2", "u3", "u4", "u5", "u6"] }, T0, id()));
    expect(autoServePlayer("ace", "us", "us", empty.court.us)).toBeUndefined();
  });

  test("«Cambia» c'è per un ace o una battuta sbagliata di chi batteva, con la formazione; cambia la giocatrice, non il punteggio", () => {
    let data = withLineups(roster());
    data = addRally(data, { actor: "us", how: "ace", player: "u1" }, at(data), "ace1");
    let rally = deriveScout(data).rallies[0];
    expect(servePlayerWasAuto(rally)).toBe(true);

    // Non era la n. 1 ma la n. 2 (la rotazione era sbagliata): cambia solo chi, il punto resta nostro.
    data = updateRally(data, "ace1", { actor: "us", how: "ace", player: "u2" });
    rally = deriveScout(data).rallies[0];
    expect(rally.player).toBe("u2");
    expect(rally.score).toEqual({ us: 1, opp: 0 });

    // Battuta sbagliata nostra: punto loro, «Cambia» c'è.
    data = addRally(data, { actor: "us", how: "serveError", player: "u1" }, at(data), "err1");
    expect(servePlayerWasAuto(deriveScout(data).rallies[1])).toBe(true);
    // Altri modi, o senza formazione, o un ace di chi non batteva (scelto a mano): niente «Cambia».
    data = point(data, "opp", "attack");
    expect(servePlayerWasAuto(deriveScout(data).rallies[2])).toBe(false);
    const noLineup = addRally(roster(), { actor: "us", how: "ace", player: "u1" }, T0, "ace2");
    expect(servePlayerWasAuto(deriveScout(noLineup).rallies[0])).toBe(false);
    const wrongSide = addRally(withLineups(roster()), { actor: "opp", how: "ace", player: "opp-1" }, T0, "ace3");
    expect(servePlayerWasAuto(deriveScout(wrongSide).rallies[0])).toBe(false);
  });

  test("un ace chiuso da un tocco (livello Completo) non ha «Cambia»: chi batte si sceglie prima del voto", () => {
    let data = withLineups(roster());
    data = addTouch(data, { side: "us", skill: "serve", player: "u1", grade: "#" }, at(data), "t1");
    const rally = deriveScout(data).rallies[0];
    expect(rally.how).toBe("ace");
    expect(servePlayerWasAuto(rally)).toBe(false);
  });
});

test.describe("il campo del «chi?»", () => {
  const spotsOf = (rows: ReturnType<typeof courtSpots>) => rows.map((row) => row.map((spot) => `${spot.position}:${spot.player?.id ?? "-"}`));

  test("due file da tre come si vedono dalla propria metà: davanti 4-3-2, dietro 5-6-1", () => {
    expect(COURT_ROWS).toEqual([
      [4, 3, 2],
      [5, 6, 1],
    ]);
    const data = withLineups(roster());
    const court = deriveScout(data).court.us as ScoutCourt;
    const rows = courtSpots(court, data.roster.us, data.roster.us);
    // u6 è la centrale in seconda linea: al suo posto gioca la libero.
    expect(spotsOf(rows)).toEqual([
      ["4:u4", "3:u3", "2:u2"],
      ["5:u5", "6:ul", "1:u1"],
    ]);
    expect(rows[0].every((spot) => !spot.back)).toBe(true);
    expect(rows[1].every((spot) => spot.back)).toBe(true);
    expect(rows.flat().filter((spot) => spot.libero).map((spot) => spot.position)).toEqual([6]);
    expect(rows.flat().every((spot) => spot.pickable)).toBe(true);
  });

  test("la libero non può murare: c'è sul campo ma non si sceglie", () => {
    expect(isBlockHow("block")).toBe(true);
    expect(isBlockHow("blockError")).toBe(true);
    expect(isBlockHow("attack")).toBe(false);
    expect(isBlockHow("serveError")).toBe(false);
    expect(canDo("block", true)).toBe(false);
    expect(canDo("blockError", true)).toBe(false);
    expect(canDo("attack", true)).toBe(true);

    const data = withLineups(roster());
    const court = deriveScout(data).court.us as ScoutCourt;
    const eligible = data.roster.us.filter((player) => canDo("block", player.libero));
    const rows = courtSpots(court, data.roster.us, eligible);
    const libero = rows.flat().find((spot) => spot.libero);
    expect(libero).toMatchObject({ position: 6, pickable: false });
    expect(libero?.player?.id).toBe("ul");
    expect(rows.flat().filter((spot) => !spot.pickable)).toHaveLength(1);
    // Lo stesso per la panchina: la libero non si propone (e comunque è già in campo).
    expect(benchOptions(eligible, court).map((player) => player.id)).toEqual(["u6", "u7", "u8"]);
  });

  test("dopo una rotazione ognuna è al suo posto nuovo", () => {
    let data = withLineups(roster());
    data = point(data, "opp"); // loro conquistano la battuta
    data = point(data, "us"); // la riconquistiamo: ruotiamo noi
    const court = deriveScout(data).court.us as ScoutCourt;
    expect(court.rotation).toBe(2);
    // Le posizioni sono ["u2","u3","u4","u5","u6","u1"]; u6 è in posizione 5 (seconda linea), dove entra la libero.
    expect(spotsOf(courtSpots(court, data.roster.us, data.roster.us))).toEqual([
      ["4:u5", "3:u4", "2:u3"],
      ["5:ul", "6:u1", "1:u2"],
    ]);
  });

  test("la panchina è chi può farla e non è in campo, per numero di maglia", () => {
    const data = withLineups(roster());
    const court = deriveScout(data).court.us as ScoutCourt;
    // Con la libero in campo per u6, u6 sta fuori insieme a u7 e u8; la libero no.
    expect(benchOptions(data.roster.us, court).map((player) => player.id)).toEqual(["u6", "u7", "u8"]);
    // Chi non può fare l'azione non compare in panchina.
    expect(benchOptions(data.roster.us.filter((player) => player.id !== "u7"), court).map((player) => player.id)).toEqual(["u6", "u8"]);
    // Loro: sei in campo, due in panchina.
    const theirs = deriveScout(data).court.opp as ScoutCourt;
    expect(benchOptions(data.roster.opp, theirs).map((player) => player.id)).toEqual(["opp-7", "opp-8"]);
  });

  test("una posizione vuota si vede, ma non si sceglie; chi non è in rosa non compare", () => {
    const court: ScoutCourt = {
      positions: ["u1", "", "u3", "u4", "u5", "u6"],
      onCourt: ["u1", "", "u3", "u4", "u5", "zzz"],
      libero: null,
      liberoFor: null,
      hosts: ["", ""],
      rotation: 1,
    };
    const data = roster();
    const rows = courtSpots(court, data.roster.us, data.roster.us);
    expect(spotsOf(rows)).toEqual([
      ["4:u4", "3:u3", "2:-"],
      ["5:u5", "6:-", "1:u1"],
    ]);
    expect(rows.flat().filter((spot) => !spot.pickable).map((spot) => spot.position).sort()).toEqual([2, 6]);
  });

  test("come si legge una giocatrice: il numero, per noi in mancanza l'iniziale, per loro un punto interrogativo", () => {
    expect(jerseyLabel({ id: "a", name: "Anna Verdi", number: "9", libero: false }, "us")).toBe("9");
    expect(jerseyLabel({ id: "a", name: "anna Verdi", number: null, libero: false }, "us")).toBe("A");
    expect(jerseyLabel({ id: "o", name: "?", number: null, libero: false }, "opp")).toBe("?");
  });
});

test.describe("la ricezione in primo piano", () => {
  test("la ricezione è da segnare quando battono loro e la nostra non è ancora segnata", () => {
    let data = withLineups(roster());
    // All'inizio batte noi: niente da ricevere.
    expect(receptionOpen(deriveScout(data))).toBe(false);
    // Loro fanno punto e conquistano la battuta: ora riceviamo noi.
    data = point(data, "opp");
    expect(currentServer(deriveScout(data))).toBe("opp");
    expect(receptionOpen(deriveScout(data))).toBe(true);
    // Segnata la nostra ricezione la scheda si chiude: il punto si segna come sempre.
    data = addTouch(data, { side: "us", skill: "reception", player: "u2", grade: "+" }, at(data), id());
    expect(receptionOpen(deriveScout(data))).toBe(false);
    // Tolta la ricezione, torna da segnare.
    const touch = data.events[data.events.length - 1];
    data = scoutReducer(data, { type: "removeTouch", id: touch.id });
    expect(receptionOpen(deriveScout(data))).toBe(true);
    // Riconquistiamo la battuta: di nuovo non c'è niente da ricevere.
    data = point(data, "us");
    expect(receptionOpen(deriveScout(data))).toBe(false);
  });

  test("il campo della ricezione c'è solo se si segue la nostra formazione e c'è chi può ricevere", () => {
    const withCourt = withLineups(roster());
    expect(receptionCourt(withCourt, deriveScout(withCourt))?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    // Senza formazione: nessun campo, si sceglie da una riga di numeri.
    const without = roster();
    expect(receptionCourt(without, deriveScout(without))).toBeNull();
    // La formazione c'è ma la rosa è vuota (tolte tutte le giocatrici): niente campo.
    const emptied = { ...withCourt, roster: { ...withCourt.roster, us: [] } };
    expect(receptionCourt(emptied, deriveScout(withCourt))).toBeNull();
    // Seguire solo la loro formazione non dà il campo della nostra ricezione.
    const onlyTheirs = setLineup(roster(), "opp", THEIRS, T0, id());
    expect(receptionCourt(onlyTheirs, deriveScout(onlyTheirs))).toBeNull();
  });
});

test.describe("cambi", () => {
  test("entra chi è in panchina al posto di chi sta in quella posizione", () => {
    let data = withLineups(roster());
    data = point(data, "us");
    data = substitute(data, "us", 2, "u7", at(data), id());
    const view = deriveScout(data);
    expect(view.court.us?.positions).toEqual(["u1", "u7", "u3", "u4", "u5", "u6"]);
    expect(view.sets[0].subs).toHaveLength(1);
    expect(view.sets[0].subs[0]).toMatchObject({ side: "us", position: 2, out: "u2", in: "u7", score: { us: 1, opp: 0 } });
  });

  test("chi entra eredita il ruolo della centrale sostituita", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 6, "u7", at(data), id());
    const court = deriveScout(data).court.us;
    expect(court?.hosts).toEqual(["u3", "u7"]);
    // La libero resta dentro per chi è entrata al posto di u6.
    expect(court?.liberoFor).toBe("u7");
    expect(court?.onCourt[5]).toBe("ul");
  });

  test("non si fa un cambio con chi è già in campo, con la libero o con chi non è in rosa", () => {
    const data = withLineups(roster());
    expect(substitute(data, "us", 2, "u4", at(data), id())).toBe(data);
    expect(substitute(data, "us", 2, "ul", at(data), id())).toBe(data);
    expect(substitute(data, "us", 2, "nessuna", at(data), id())).toBe(data);
    // Senza formazione di quella squadra non c'è nessuno da sostituire.
    const noLineup = setLineup(roster(), "us", OURS, T0, id());
    expect(substitute(noLineup, "opp", 2, "opp-7", at(noLineup), id())).toBe(noLineup);
  });

  test("«Annulla ultimo» toglie anche un cambio o una formazione", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 2, "u7", at(data), id());
    expect(deriveScout(undoLast(data)).court.us?.positions[1]).toBe("u2");
    expect(deriveScout(undoLast(undoLast(undoLast(data)))).court.us).toBeNull();
  });

  test("chi compare in una formazione o in un cambio non si toglie dalla rosa", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 2, "u7", at(data), id());
    const used = usedPlayerIds(data);
    for (const player of ["u1", "u6", "ul", "u7"]) expect(used.has(player)).toBe(true);
    expect(removePlayer(data, "us", "u7")).toBe(data);
    expect(removePlayer(data, "us", "u8").roster.us.some((p) => p.id === "u8")).toBe(false);
  });
});

test.describe("cambi: il rientro", () => {
  test("una titolare rientra al posto di chi l'ha sostituita, anche se nel frattempo la squadra ha ruotato", () => {
    let data = withLineups(roster());
    data = point(data, "us"); // 1-0: batte noi, nessuna rotazione
    data = substitute(data, "us", 2, "u7", at(data), id()); // esce u2, entra u7 in posizione 2
    data = point(data, "opp"); // 1-1: loro conquistano la battuta
    data = point(data, "us"); // 2-1: noi la riconquistiamo e ruotiamo: u7 passa dalla posizione 2 alla 1
    const view = deriveScout(data);
    expect(view.court.us?.positions.indexOf("u7")).toBe(0);
    // u2 rientra per u7, che adesso sta in posizione 1: niente avvertimenti (prima pretendeva la posizione 2).
    expect(reentryOfPlayer(view, "us", "u2")).toEqual({ replacedBy: "u7", position: 1 });
    expect(substitutionWarningFor(data, view, "us", 1, "u2")).toBeNull();
    // Non può prendere il posto di un'altra; e la riserva u7 esce solo per lei.
    expect(substitutionWarningFor(data, view, "us", 3, "u2")).toContain("solo al posto di chi l'ha sostituita");
    expect(substitutionWarningFor(data, view, "us", 1, "u8")).toContain("può essere sostituita solo da lei");
    // Rientrata, non può più uscire e u7 non torna.
    data = substitute(data, "us", 1, "u2", at(data), id());
    const after = deriveScout(data);
    expect(after.court.us?.positions[0]).toBe("u2");
    expect(reentryOfPlayer(after, "us", "u2")).toBeNull();
    expect(substitutionWarningFor(data, after, "us", 1, "u8")).toContain("non può uscire un'altra volta");
    expect(substitutionWarningFor(data, after, "us", 4, "u7")).toContain("una riserva non può rientrare");
  });

  test("non si propone il rientro a una riserva, a chi non è uscita, né all'altra squadra", () => {
    let data = withLineups(roster());
    data = point(data, "us");
    data = substitute(data, "us", 2, "u7", at(data), id());
    const view = deriveScout(data);
    expect(reentryOfPlayer(view, "us", "u7")).toBeNull();
    expect(reentryOfPlayer(view, "us", "u4")).toBeNull();
    expect(reentryOfPlayer(view, "opp", "u2")).toBeNull();
  });

  test("un cambio prima del primo scambio non cambia la formazione di partenza: la titolare uscita può rientrare e il set dopo riparte da lì", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 2, "u7", at(data), id()); // 0-0: esce u2, entra u7
    let view = deriveScout(data);
    // La partenza resta quella scritta (con u2): u2 è una titolare uscita e può rientrare per u7.
    expect(view.current?.lineups.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(view.court.us?.positions).toEqual(["u1", "u7", "u3", "u4", "u5", "u6"]);
    expect(reentryOfPlayer(view, "us", "u2")).toEqual({ replacedBy: "u7", position: 2 });
    expect(substitutionWarningFor(data, view, "us", 2, "u2")).toBeNull();
    expect(substitutionWarningFor(data, view, "us", 2, "u8")).toContain("può essere sostituita solo da lei");
    // Dopo il primo scambio non cambia niente.
    data = point(data, "us");
    view = deriveScout(data);
    expect(view.sets[0].lineups.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(reentryOfPlayer(view, "us", "u2")).toEqual({ replacedBy: "u7", position: 2 });
    // Il set dopo riparte dalla formazione di partenza, non con la riserva.
    data = endSet(data, "opp", at(data), id());
    expect(deriveScout(data).court.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    // Anche nel 2° set: cambio a 0-0, poi il primo punto; la partenza è senza il cambio e il 3° riparte da lì.
    data = substitute(data, "us", 3, "u8", at(data), id());
    data = point(data, "opp");
    view = deriveScout(data);
    expect(view.sets[1].lineups.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(reentryOfPlayer(view, "us", "u3")).toEqual({ replacedBy: "u8", position: 3 });
    data = endSet(data, "us", at(data), id());
    expect(deriveScout(data).court.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
  });

  test("una nuova formazione dopo un cambio a 0-0 è la nuova partenza", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 2, "u7", at(data), id());
    const changed: LineupInput = { ...OURS, positions: ["u1", "u8", "u3", "u4", "u5", "u6"] };
    data = setLineup(data, "us", changed, at(data), id());
    data = point(data, "us");
    const view = deriveScout(data);
    expect(view.sets[0].lineups.us?.positions).toEqual(["u1", "u8", "u3", "u4", "u5", "u6"]);
    // u2 non è nella nuova partenza: non è una titolare, quindi non rientra.
    expect(reentryOfPlayer(view, "us", "u2")).toBeNull();
  });

  test("si possono fare 8 cambi a set; il nono avvisa", () => {
    let data = withLineups(roster());
    for (const n of [9, 10, 11]) data = addPlayer(data, "us", { id: `u${n}`, name: `Atleta ${n}`, number: String(n), libero: false });
    data = point(data, "us");
    // Quattro riserve entrano al posto di quattro titolari, poi le quattro titolari rientrano, ognuna per la sua sostituta: otto cambi regolari.
    const swaps = [
      { position: 2, reserve: "u7", starter: "u2" },
      { position: 4, reserve: "u8", starter: "u4" },
      { position: 5, reserve: "u9", starter: "u5" },
      { position: 1, reserve: "u10", starter: "u1" },
    ] as const;
    for (const { position, reserve } of swaps) {
      expect(substitutionWarningFor(data, deriveScout(data), "us", position, reserve)).toBeNull();
      data = substitute(data, "us", position, reserve, at(data), id());
    }
    for (const { position, starter } of swaps) {
      expect(substitutionWarningFor(data, deriveScout(data), "us", position, starter)).toBeNull();
      data = substitute(data, "us", position, starter, at(data), id());
    }
    const view = deriveScout(data);
    expect(view.sets[0].subs).toHaveLength(8);
    expect(view.court.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    // Il nono cambio, anche con un'altra riserva, non è previsto.
    expect(substitutionWarningFor(data, view, "us", 3, "u11")).toContain("8 cambi");
  });
});

test.describe("la formazione a ogni set", () => {
  /** Il 1° set a 1–0 per noi, chiuso: comincia il 2°. */
  function secondSet(data: ScoutData): ScoutData {
    return endSet(point(data, "us"), "opp", at(data) + MIN, id());
  }

  test("a un set nuovo, seguendo la formazione, si chiede quale formazione usare; appena la si scrive la domanda non serve più", () => {
    let data = withLineups(roster());
    // Nel 1° set la formazione si scrive nella preparazione: nessuna domanda.
    expect(setLineupPending(data.events, deriveScout(data))).toBe(false);
    data = point(data, "us");
    expect(setLineupPending(data.events, deriveScout(data))).toBe(false);

    // Chiuso il 1° set, il 2° non ha ancora una formazione scritta: si chiede (parte comunque da quella del set prima).
    data = secondSet(withLineups(roster()));
    let view = deriveScout(data);
    expect(view.current?.n).toBe(2);
    expect(view.court.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(lineupWrittenThisSet(data.events)).toBe(false);
    expect(setLineupPending(data.events, view)).toBe(true);

    // Scritta una formazione per il 2° set (qui cambia chi batte): non si chiede più, e vale quella nuova.
    data = setLineup(data, "us", { ...OURS, positions: ["u7", "u2", "u3", "u4", "u5", "u6"] }, at(data), id());
    view = deriveScout(data);
    expect(lineupWrittenThisSet(data.events)).toBe(true);
    expect(setLineupPending(data.events, view)).toBe(false);
    expect(view.court.us?.positions[0]).toBe("u7");
    expect(view.sets[0].lineups.us?.positions[0]).toBe("u1");
  });

  test("anche un cambio prima del primo punto chiude la domanda; a set cominciato non si chiede mai", () => {
    let data = secondSet(withLineups(roster()));
    expect(setLineupPending(data.events, deriveScout(data))).toBe(true);
    data = substitute(data, "us", 2, "u7", at(data), id());
    expect(setLineupPending(data.events, deriveScout(data))).toBe(false);

    const started = point(secondSet(withLineups(roster())), "opp");
    expect(setLineupPending(started.events, deriveScout(started))).toBe(false);
  });

  test("senza formazione da seguire (né per noi né per loro) a un set nuovo non si chiede niente", () => {
    const data = secondSet(roster());
    const view = deriveScout(data);
    expect(view.current?.n).toBe(2);
    expect(view.court).toEqual({ us: null, opp: null });
    expect(setLineupPending(data.events, view)).toBe(false);
  });

  test("con la partita decisa non si chiede niente", () => {
    let data = withLineups(roster());
    for (let i = 0; i < 3; i++) data = endSet(point(data, "us"), "opp", at(data) + MIN, id());
    const view = deriveScout(data);
    expect(view.decided).toBe(true);
    expect(setLineupPending(data.events, view)).toBe(false);
  });

  test("a un set nuovo si può cominciare con un'altra formazione: la partenza di ogni set resta nel tabellino", () => {
    let data = secondSet(withLineups(roster()));
    // 2° set: nuova formazione di partenza (u7 al posto di u1) e un punto.
    data = setLineup(data, "us", { ...OURS, positions: ["u7", "u2", "u3", "u4", "u5", "u6"] }, at(data), id());
    data = point(data, "us");
    const view = deriveScout(data);
    expect(view.sets[0].lineups.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(view.sets[1].lineups.us?.positions).toEqual(["u7", "u2", "u3", "u4", "u5", "u6"]);
    const summary = lineupSummary(view, data.roster);
    expect(summary.starts.filter((row) => row.side === "us").map((row) => row.set)).toEqual([1, 2]);
  });

  test("il cambio della libero: la nuova libero è nella formazione, la rotazione resta e non conta tra i cambi", () => {
    let data = withLineups(roster());
    data = addPlayer(data, "us", { id: "ul2", name: "Seconda libera", number: "21", libero: false });
    data = point(point(data, "opp"), "us"); // noi riconquistiamo la battuta: ruotiamo, 2ª rotazione
    let view = deriveScout(data);
    const before = view.court.us as ScoutCourt;
    expect(before.rotation).toBe(2);
    expect(before.libero).toBe("ul");
    expect(benchOf(data.roster.us, before).map((p) => p.id)).toContain("ul2");

    // Quello che fa «Cambia la libero»: la nuova è una libero in rosa, e la formazione si riscrive uguale con lei.
    data = updatePlayer(data, "us", "ul2", { libero: true });
    data = setLineup(
      data,
      "us",
      { positions: before.positions.map((p) => p || null), libero: "ul2", hosts: [before.hosts[0] || null, before.hosts[1] || null] },
      at(data),
      id(),
    );
    view = deriveScout(data);
    const after = view.court.us as ScoutCourt;
    expect(after.libero).toBe("ul2");
    expect(after.positions).toEqual(before.positions);
    expect(after.rotation).toBe(2);
    expect(after.hosts).toEqual(before.hosts);
    // Dove prima c'era la libero ora c'è la nuova; non è un cambio ufficiale.
    expect(after.onCourt).toEqual(before.onCourt.map((id) => (id === "ul" ? "ul2" : id)));
    expect(view.sets[0].subs).toHaveLength(0);
    // La vecchia libero è in panchina, la formazione di partenza del set è rimasta quella con cui era cominciato.
    expect(benchOf(data.roster.us, after).map((p) => p.id)).toContain("ul");
    expect(view.sets[0].lineups.us?.libero).toBe("ul");

    // Chiuso il set (1–1 non si chiude: un punto in più per noi), il successivo riparte dalla formazione di partenza ma con la libero di adesso: continua lei.
    data = endSet(point(data, "us"), "opp", at(data) + 2 * MIN, id());
    view = deriveScout(data);
    expect(view.current?.n).toBe(2);
    expect(view.court.us?.positions).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(view.court.us?.libero).toBe("ul2");
    expect(view.court.us?.rotation).toBe(1);
  });
});

test.describe("salvataggio", () => {
  test("formazioni e cambi passano la validazione e si rileggono uguali", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 2, "u7", at(data), id());
    const parsed = scoutDataSchema.parse(JSON.parse(JSON.stringify(data)));
    expect(parsed.events).toEqual(data.events);
    expect(deriveScout(parsed).court.us?.positions[1]).toBe("u7");
  });

  test("una formazione con meno di sei posizioni viene rifiutata", () => {
    const data = withLineups(roster());
    const broken = JSON.parse(JSON.stringify(data));
    broken.events[0].positions = ["u1", "u2"];
    expect(scoutDataSchema.safeParse(broken).success).toBe(false);
  });

  test("il reducer le applica come le altre azioni", () => {
    let data = roster();
    data = scoutReducer(data, { type: "lineup", side: "us", input: OURS, at: T0, id: "l1" });
    data = scoutReducer(data, { type: "sub", side: "us", position: 1, player: "u7", at: T0 + MIN, id: "s1" });
    expect(deriveScout(data).court.us?.positions[0]).toBe("u7");
  });
});

test.describe("tabellino e PDF", () => {
  test("il riepilogo dà le formazioni di partenza di ogni set e i cambi, anche per un solo set", () => {
    let data = withLineups(roster());
    data = point(data, "us");
    data = substitute(data, "us", 2, "u7", at(data), id());
    data = point(data, "opp");
    data = point(data, "us"); // 2-1: il set non è in parità e si può chiudere
    data = endSet(data, "opp", at(data), id());
    data = point(data, "us");
    const view = deriveScout(data);
    const all = lineupSummary(view, data.roster);
    expect(all.starts.map((row) => `${row.set}-${row.side}`)).toEqual(["1-us", "1-opp", "2-us", "2-opp"]);
    expect(all.starts[0]).toMatchObject({ positions: ["1", "2", "3", "4", "5", "6"], libero: "20" });
    // Le avversarie si leggono per numero di maglia.
    expect(all.starts[1].positions).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(all.subs).toEqual([{ set: 1, side: "us", position: 2, out: "2", in: "7", score: { us: 1, opp: 0 } }]);
    const second = lineupSummary(view, data.roster, 2);
    expect(second.starts.every((row) => row.set === 2)).toBe(true);
    expect(second.subs).toEqual([]);
    // Senza formazione non c'è niente da mostrare.
    expect(lineupSummary(deriveScout(point(roster(), "us")), roster().roster)).toEqual({ starts: [], subs: [] });
  });

  test("il PDF con formazioni e cambi si genera", async () => {
    let data = withLineups(roster());
    for (let i = 0; i < 10; i++) data = point(data, i % 3 === 0 ? "opp" : "us");
    data = substitute(data, "us", 3, "u7", at(data), id());
    data = endSet(data, "opp", at(data), id());
    data = point(data, "us");
    const bytes = await buildScoutPdf({ match: pdfMatch(), scout: data, set: null, generatedAt: new Date("2026-10-17T12:00:00Z") });
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  });
});

function pdfMatch(): Match {
  return {
    id: "m1",
    team: "u14u15",
    category: "U15",
    opponent: "Pallavolo Degano",
    isHome: true,
    location: "Palestra Comunale",
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
  };
}
