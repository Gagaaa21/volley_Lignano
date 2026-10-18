import { expect, test } from "@playwright/test";
import {
  addPlayer,
  addRally,
  addTimeout,
  endSet,
  foldRotationSteps,
  newScoutData,
  opponentPlayer,
  removeEvent,
  rotateTeam,
  scoutReducer,
  setLineup,
  substitute,
  undoLast,
  usedPlayerIds,
  type LineupInput,
} from "@/lib/scout/actions";
import { currentServer, deriveScout, shiftCourt } from "@/lib/scout/derive";
import { lineupWrittenThisSet, setLineupPending } from "@/lib/scout/court";
import { scoutDataSchema } from "@/lib/scout/schema";
import { statsOf } from "@/lib/scout/stats";
import { reconcile } from "@/lib/scout/sync";
import type { ScoutData, ScoutSide } from "@/lib/scout/types";

/**
 * Correzione della rotazione: una squadra (di cui si segue la formazione) può girare avanti o indietro di una o più
 * posizioni senza che cambi il punteggio, chi batte, i cambi o i time-out: cambia solo chi sta in ogni posizione.
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
const OURS: LineupInput = { positions: ["u1", "u2", "u3", "u4", "u5", "u6"], libero: "ul", hosts: ["u3", "u6"] };
const THEIRS: LineupInput = { positions: ["opp-1", "opp-2", "opp-3", "opp-4", "opp-5", "opp-6"], libero: null, hosts: [null, null] };

let seq = 0;
const id = () => `r${++seq}`;
const at = (data: ScoutData) => T0 + data.events.length * MIN;

function withLineups(data: ScoutData): ScoutData {
  return setLineup(setLineup(data, "us", OURS, at(data), id()), "opp", THEIRS, T0, id());
}

function point(data: ScoutData, winner: ScoutSide): ScoutData {
  return addRally(data, { actor: winner, how: "attack", player: null, victim: null }, at(data), id());
}

const rotate = (data: ScoutData, side: ScoutSide, steps: number) => rotateTeam(data, side, steps, at(data), id());

/** Dopo «loro» e poi «noi»: noi hanno riconquistato la battuta e sono alla 2ª rotazione, loro pure. */
function playing(): ScoutData {
  return point(point(withLineups(roster()), "opp"), "us");
}

const positionsOf = (data: ScoutData, side: ScoutSide) => deriveScout(data).court[side]?.positions;

test.describe("correzione della rotazione", () => {
  test("avanti di una: chi era in posizione 2 batte, chi era in 1 va nell'ultima", () => {
    const before = playing();
    expect(positionsOf(before, "us")).toEqual(["u2", "u3", "u4", "u5", "u6", "u1"]);
    const after = rotate(before, "us", 1);
    expect(positionsOf(after, "us")).toEqual(["u3", "u4", "u5", "u6", "u1", "u2"]);
    expect(deriveScout(after).court.us?.rotation).toBe(3);
    // L'altra squadra non si muove.
    expect(positionsOf(after, "opp")).toEqual(positionsOf(before, "opp"));
  });

  test("indietro di una e di due: il giro al contrario", () => {
    const before = playing();
    expect(positionsOf(rotate(before, "us", -1), "us")).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(positionsOf(rotate(before, "us", -2), "us")).toEqual(["u6", "u1", "u2", "u3", "u4", "u5"]);
    expect(deriveScout(rotate(before, "us", -2)).court.us?.rotation).toBe(6);
    // A set cominciato, indietro dalla 1ª rotazione si torna alla 6ª, non a una rotazione «zero»…
    const first = point(withLineups(roster()), "opp");
    expect(deriveScout(first).court.us?.rotation).toBe(1);
    expect(deriveScout(rotate(first, "us", -1)).court.us?.rotation).toBe(6);
    // …mentre a set non cominciato la formazione di partenza è per definizione la 1ª.
    expect(deriveScout(rotate(withLineups(roster()), "us", -1)).court.us?.rotation).toBe(1);
  });

  test("più posizioni insieme: avanti di tre", () => {
    const after = rotate(playing(), "us", 3);
    expect(positionsOf(after, "us")).toEqual(["u5", "u6", "u1", "u2", "u3", "u4"]);
    expect(deriveScout(after).court.us?.rotation).toBe(5);
  });

  test("punteggio, chi batte, cambi e time-out non cambiano", () => {
    let before = playing();
    before = addTimeout(before, "opp", at(before), id());
    before = substitute(before, "us", 4, "u7", at(before), id());
    const a = deriveScout(before);
    const b = deriveScout(rotate(before, "us", 2));
    expect(b.current?.score).toEqual(a.current?.score);
    expect(b.setsWon).toEqual(a.setsWon);
    expect(b.rallies).toHaveLength(a.rallies.length);
    expect(b.rallies.map((r) => r.court)).toEqual(a.rallies.map((r) => r.court));
    expect(currentServer(b)).toBe(currentServer(a));
    expect(b.current?.subs).toEqual(a.current?.subs);
    expect(b.current?.timeouts).toEqual(a.current?.timeouts);
    expect(b.current?.rallies.map((r) => r.score)).toEqual(a.current?.rallies.map((r) => r.score));
  });

  test("la correzione si legge nel registro del set, con il punteggio di quel momento", () => {
    const after = rotate(playing(), "us", 2);
    const set = deriveScout(after).current;
    expect(set?.rotations).toEqual([{ id: expect.any(String), at: expect.any(Number), side: "us", steps: 2, score: { us: 1, opp: 1 } }]);
  });

  test("la libero si riallinea a dove stanno ora le giocatrici", () => {
    // Partenza, batte noi: u6 (centrale) è in seconda linea e c'è la libero.
    const start = withLineups(roster());
    expect(deriveScout(start).court.us?.liberoFor).toBe("u6");
    // Avanti di una: u6 è in posizione 5, sempre in seconda linea.
    const one = deriveScout(rotate(start, "us", 1)).court.us;
    expect(one?.positions).toEqual(["u2", "u3", "u4", "u5", "u6", "u1"]);
    expect(one?.liberoFor).toBe("u6");
    expect(one?.onCourt).toEqual(["u2", "u3", "u4", "u5", "ul", "u1"]);
    // Avanti di due: u3 è in posizione 1 e batte (la libero non batte), u6 è in prima linea: nessuna libero in campo.
    const two = deriveScout(rotate(start, "us", 2)).court.us;
    expect(two?.positions).toEqual(["u3", "u4", "u5", "u6", "u1", "u2"]);
    expect(two?.liberoFor).toBeNull();
    expect(two?.onCourt).toEqual(two?.positions);
  });

  test("l'anteprima della schermata (shiftCourt) è identica al risultato vero", () => {
    const before = playing();
    const view = deriveScout(before);
    const serving = currentServer(view) === "us";
    for (const steps of [-5, -3, -1, 1, 2, 4, 5]) {
      const preview = shiftCourt(view.court.us!, steps, serving);
      const real = deriveScout(rotate(before, "us", steps)).court.us;
      expect(preview).toEqual(real);
    }
  });

  test("una squadra di cui non si segue la formazione non si può ruotare", () => {
    const start = setLineup(roster(), "us", OURS, T0, id());
    expect(rotate(start, "opp", 1)).toBe(start);
  });

  test("a partita chiusa o decisa non si corregge più", () => {
    const closed = { ...playing(), finished: true };
    expect(rotate(closed, "us", 1)).toBe(closed);
    let decided = withLineups({ ...roster(), settings: { ...roster().settings, format: "bo3" } });
    for (let set = 1; set <= 2; set++) {
      for (let i = 0; i < 25; i++) decided = point(decided, "us");
      decided = endSet(decided, "opp", at(decided), id());
    }
    expect(deriveScout(decided).decided).toBe(true);
    expect(rotate(decided, "us", 1)).toBe(decided);
  });

  test("0 passi o un giro intero non fanno niente; oltre i sei passi si tiene il resto", () => {
    const before = playing();
    expect(rotate(before, "us", 0)).toBe(before);
    expect(rotate(before, "us", 6)).toBe(before);
    expect(rotate(before, "us", Number.NaN)).toBe(before);
    expect(foldRotationSteps(0)).toBe(0);
    expect(foldRotationSteps(6)).toBe(0);
    expect(foldRotationSteps(-6)).toBe(0);
    expect(foldRotationSteps(7)).toBe(1);
    expect(foldRotationSteps(-7)).toBe(-1);
    expect(foldRotationSteps(2.9)).toBe(2);
    expect(foldRotationSteps(-5)).toBe(-5);
    const seven = rotate(before, "us", 7);
    expect(seven.events.at(-1)).toMatchObject({ type: "rotate", steps: 1 });
  });
});

test.describe("correzioni ravvicinate", () => {
  test("toccare più volte la stessa squadra somma i passi in un solo evento", () => {
    let data = playing();
    const count = data.events.length;
    data = rotate(rotate(rotate(data, "us", 1), "us", 1), "us", 1);
    expect(data.events).toHaveLength(count + 1);
    expect(data.events.at(-1)).toMatchObject({ type: "rotate", side: "us", steps: 3 });
    expect(deriveScout(data).current?.rotations).toHaveLength(1);
  });

  test("a somma zero spariscono, e a somma di un giro intero pure", () => {
    const base = playing();
    expect(rotate(rotate(base, "us", 2), "us", -2).events).toEqual(base.events);
    expect(rotate(rotate(base, "us", 3), "us", 3).events).toEqual(base.events);
    expect(rotate(rotate(base, "us", 4), "us", 4).events.at(-1)).toMatchObject({ steps: 2 });
  });

  test("le due squadre non si mescolano, ma si fondono lo stesso se in mezzo c'è solo l'altra", () => {
    let data = playing();
    const count = data.events.length;
    data = rotate(rotate(rotate(data, "us", 1), "opp", 2), "us", 1);
    const rotates = data.events.slice(count);
    expect(rotates.map((e) => (e.type === "rotate" ? `${e.side}${e.steps}` : e.type)).sort()).toEqual(["opp2", "us2"]);
  });

  test("dopo un punto non si fonde più: è un'altra correzione, in un altro momento", () => {
    let data = playing();
    data = rotate(data, "us", 1);
    data = point(data, "us");
    data = rotate(data, "us", 1);
    expect(data.events.filter((e) => e.type === "rotate")).toHaveLength(2);
    expect(deriveScout(data).current?.rotations.map((r) => r.score)).toEqual([
      { us: 1, opp: 1 },
      { us: 2, opp: 1 },
    ]);
  });

  test("annulla ultimo toglie la correzione, e il registro ne toglie una qualsiasi", () => {
    const base = playing();
    const rotated = rotate(base, "us", 2);
    expect(positionsOf(undoLast(rotated), "us")).toEqual(positionsOf(base, "us"));
    const withTwo = rotate(point(rotated, "us"), "opp", 1);
    const first = withTwo.events.find((e) => e.type === "rotate")!;
    const removed = removeEvent(withTwo, first.id);
    expect(removed.events.filter((e) => e.type === "rotate")).toHaveLength(1);
    // Tolta la prima correzione, noi tornano dove sarebbero senza: l'altra resta.
    expect(positionsOf(removed, "us")).toEqual(positionsOf(point(base, "us"), "us"));
  });

  test("dalla pagina l'azione «rotate» fa la stessa cosa", () => {
    const base = playing();
    const viaReducer = scoutReducer(base, { type: "rotate", side: "us", steps: -1, at: at(base), id: id() });
    expect(positionsOf(viaReducer, "us")).toEqual(positionsOf(rotate(base, "us", -1), "us"));
    expect(viaReducer.events.at(-1)).toMatchObject({ type: "rotate", side: "us", steps: -1 });
  });
});

test.describe("set non cominciato", () => {
  test("corregge la formazione di partenza: resta la 1ª rotazione e la correzione non compare nel registro", () => {
    const start = rotate(withLineups(roster()), "us", 2);
    const view = deriveScout(start);
    expect(view.court.us?.positions).toEqual(["u3", "u4", "u5", "u6", "u1", "u2"]);
    expect(view.court.us?.rotation).toBe(1);
    expect(view.current?.rotations).toEqual([]);
    // Dal primo scambio la formazione di partenza del set è quella corretta, e il 2° set riparte da lì.
    let data = point(start, "us");
    expect(deriveScout(data).sets[0].lineups.us?.positions).toEqual(["u3", "u4", "u5", "u6", "u1", "u2"]);
    for (let i = 0; i < 24; i++) data = point(data, "us");
    data = endSet(data, "opp", at(data), id());
    expect(deriveScout(data).court.us?.positions).toEqual(["u3", "u4", "u5", "u6", "u1", "u2"]);
  });

  test("con un cambio già fatto prima del primo scambio, i titolari ruotano insieme", () => {
    let data = withLineups(roster());
    data = substitute(data, "us", 4, "u7", at(data), id());
    data = rotate(data, "us", 1);
    data = point(data, "us");
    const view = deriveScout(data);
    // In campo: u7 al posto di u4, tutti ruotati di una; titolari: u4 al suo posto, ruotati anche loro.
    expect(view.court.us?.positions).toEqual(["u2", "u3", "u7", "u5", "u6", "u1"]);
    expect(view.sets[0].lineups.us?.positions).toEqual(["u2", "u3", "u4", "u5", "u6", "u1"]);
  });

  test("conta come «formazione scritta» in un set nuovo: la domanda su come si ricomincia non serve più", () => {
    let data = withLineups(roster());
    for (let i = 0; i < 25; i++) data = point(data, "us");
    data = endSet(data, "opp", at(data), id());
    expect(setLineupPending(data.events, deriveScout(data))).toBe(true);
    data = rotate(data, "us", 1);
    expect(lineupWrittenThisSet(data.events)).toBe(true);
    expect(setLineupPending(data.events, deriveScout(data))).toBe(false);
  });
});

test.describe("rotazioni della tabella", () => {
  test("la tabella segue le correzioni: dopo +2 si serve nella 3ª rotazione", () => {
    let data = withLineups(roster());
    data = point(data, "us"); // battiamo noi in 1ª rotazione e facciamo punto
    data = rotate(data, "us", 2);
    data = point(data, "us"); // ancora noi al servizio, adesso in 3ª
    const rows = statsOf(data).analysis.us.rotations;
    expect(rows.map((row) => row.served)).toEqual([1, 0, 1, 0, 0, 0]);
    expect(rows.map((row) => row.breakPoints)).toEqual([1, 0, 1, 0, 0, 0]);
    expect(deriveScout(data).rallies.map((r) => r.rotation.us)).toEqual([1, 3]);
  });

  test("senza correzioni i numeri sono quelli di sempre, anche per chi non ha la formazione", () => {
    let data = roster();
    data = point(point(point(data, "opp"), "us"), "us");
    const rotations = deriveScout(data).rallies.map((r) => r.rotation);
    // Rally 1: batte noi, perdiamo → loro ruotano. 2: batte loro, vinciamo noi → ruotiamo noi. 3: battiamo noi e vinciamo.
    expect(rotations).toEqual([
      { us: 1, opp: 1 },
      { us: 1, opp: 2 },
      { us: 2, opp: 2 },
    ]);
    const rows = statsOf(data).analysis;
    expect(rows.us.rotations.map((row) => row.served)).toEqual([1, 1, 0, 0, 0, 0]);
    expect(rows.opp.rotations.map((row) => row.served)).toEqual([0, 1, 0, 0, 0, 0]);
    expect(rows.opp.rotations.map((row) => row.received)).toEqual([1, 1, 0, 0, 0, 0]);
    expect(rows.opp.rotations.map((row) => row.sideOuts)).toEqual([1, 0, 0, 0, 0, 0]);
  });

  test("a ogni set si riparte dalla 1ª rotazione, anche dopo una correzione", () => {
    let data = withLineups(roster());
    data = rotate(point(data, "us"), "us", 3);
    for (let i = 0; i < 24; i++) data = point(data, "us");
    data = endSet(data, "opp", at(data), id());
    data = point(data, "opp");
    expect(deriveScout(data).sets[1].rallies[0].rotation.us).toBe(1);
  });
});

test.describe("salvataggio", () => {
  const rotateEvent = (steps: unknown) => ({ type: "rotate", id: "x1", at: 1, side: "us", steps });
  const withEvent = (event: unknown) => ({ ...roster(), events: [event] });

  test("lo schema accetta da −5 a 5 e rifiuta 0, 6 e i numeri non interi", () => {
    for (const steps of [-5, -1, 1, 3, 5]) expect(scoutDataSchema.safeParse(withEvent(rotateEvent(steps))).success).toBe(true);
    for (const steps of [0, 6, -6, 1.5, "1", null]) expect(scoutDataSchema.safeParse(withEvent(rotateEvent(steps))).success).toBe(false);
  });

  test("la correzione non riguarda nessuna giocatrice: la rosa si può cambiare come prima", () => {
    const base = playing();
    const used = (data: ScoutData) => [...usedPlayerIds(data)].sort();
    expect(used(rotate(base, "us", 2))).toEqual(used(base));
  });

  test("due dispositivi che segnano e correggono in momenti diversi si uniscono, in ordine di tempo", () => {
    const base = playing();
    const server = point(base, "opp");
    // Il secondo dispositivo corregge dopo (un'ora più tardi): il punto del server viene prima.
    const mine = rotateTeam(base, "us", 1, T0 + 60 * MIN, "rot-tardi");
    const result = reconcile(server, mine);
    expect(result.kind).toBe("merged");
    if (result.kind !== "merged") return;
    expect(result.data.events.map((e) => e.type)).toEqual([...base.events.map((e) => e.type), "rally", "rotate"]);
    expect(scoutDataSchema.safeParse(result.data).success).toBe(true);
    expect(deriveScout(result.data).current?.rotations).toHaveLength(1);
  });

  test("le correzioni di due dispositivi negli stessi momenti non si uniscono da sole", () => {
    const base = playing();
    const a = rotateTeam(base, "us", 1, T0 + 60 * MIN, "rot-a");
    const b = rotateTeam(base, "us", 2, T0 + 60 * MIN, "rot-b");
    expect(reconcile(a, b).kind).toBe("conflict");
  });
});
