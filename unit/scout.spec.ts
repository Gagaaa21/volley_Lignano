import { expect, test } from "@playwright/test";
import {
  addPlayer,
  addRally,
  cleanNumber,
  DEFAULT_SETTINGS,
  endSet,
  finishMatch,
  manualPlayer,
  newScoutData,
  opponentPlayer,
  removeEvent,
  removePlayer,
  undoLast,
  updateRally,
  updateSettings,
} from "@/lib/scout/actions";
import { currentServer, defaultNextServer, deriveScout, isSetOver, maxSets, setTarget, suggestedSetEnd } from "@/lib/scout/derive";
import { asksPlayer, asksPlayerFor, canDo, ERROR_HOWS, HOW_META, isPointHow, POINT_HOWS, rallyWinner } from "@/lib/scout/rules";
import { MAX_SCOUT_EVENTS, scoutDataSchema } from "@/lib/scout/schema";
import { aggregateSeason, computeStats, hasActivity, percent, statsOf, UNASSIGNED_ID } from "@/lib/scout/stats";
import { SCOUT_HOWS, type ScoutData, type ScoutHow, type ScoutSide } from "@/lib/scout/types";

/** Scout: chi fa punto e come, i set, la battuta, il tabellino e il salvataggio. */

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);
const MIN = 60_000;

const ANNA = { id: "a1", name: "Anna", number: "4", libero: false };
const BEA = { id: "a2", name: "Bea", number: "7", libero: false };
const CARLA = { id: "a3", name: "Carla", number: "1", libero: true };

function emptyMatch(settings: Partial<ScoutData["settings"]> = {}): ScoutData {
  let data = newScoutData({ us: [], opp: [] }, settings);
  for (const p of [ANNA, BEA, CARLA]) data = addPlayer(data, "us", p);
  for (const n of ["5", "9"]) data = addPlayer(data, "opp", opponentPlayer(n));
  return data;
}

let seq = 0;
function rally(data: ScoutData, actor: ScoutSide, how: ScoutHow, player: string | null = null, victim: string | null = null): ScoutData {
  seq += 1;
  const at = T0 + data.events.length * MIN;
  return addRally(data, { actor, how, player, victim }, at, `e${seq}`);
}

/** `n` punti di fila per `side`, segnati come attacchi vincenti senza dire chi. */
function points(data: ScoutData, side: ScoutSide, n: number): ScoutData {
  let next = data;
  for (let i = 0; i < n; i++) next = rally(next, side, "attack");
  return next;
}

function close(data: ScoutData, nextServer: ScoutSide = "opp"): ScoutData {
  seq += 1;
  return endSet(data, nextServer, T0 + data.events.length * MIN, `s${seq}`);
}

test.describe("regole: come e chi fa punto", () => {
  test("attacco, muro e ace sono punto di chi li fa", () => {
    for (const how of POINT_HOWS) {
      expect(isPointHow(how)).toBe(true);
      expect(rallyWinner(how, "us")).toBe("us");
      expect(rallyWinner(how, "opp")).toBe("opp");
    }
  });

  test("ogni errore e ogni fallo è punto dell'altra squadra", () => {
    for (const how of ERROR_HOWS) {
      expect(isPointHow(how)).toBe(false);
      expect(rallyWinner(how, "us")).toBe("opp");
      expect(rallyWinner(how, "opp")).toBe("us");
    }
  });

  test("le conclusioni previste sono tutte descritte e senza doppioni", () => {
    expect(Object.keys(HOW_META).sort()).toEqual([...SCOUT_HOWS].sort());
    expect(new Set([...POINT_HOWS, ...ERROR_HOWS]).size).toBe(SCOUT_HOWS.length);
    for (const how of SCOUT_HOWS) expect(HOW_META[how].label.length).toBeGreaterThan(2);
  });

  test("la libero non può murare né sbagliare a muro", () => {
    expect(canDo("block", true)).toBe(false);
    expect(canDo("blockError", true)).toBe(false);
    expect(canDo("attack", true)).toBe(true);
    expect(canDo("receptionError", true)).toBe(true);
    expect(canDo("block", false)).toBe(true);
  });

  test("rotazione e sanzioni sono di squadra: non si chiede chi", () => {
    expect(asksPlayer("rotationFault")).toBe(false);
    expect(asksPlayer("sanction")).toBe(false);
    expect(asksPlayer("netFault")).toBe(true);
    expect(asksPlayer("attack")).toBe(true);
  });

  test("l'attacco vincente loro non chiede mai chi: tutto il resto sì", () => {
    expect(asksPlayerFor("opp", "attack")).toBe(false);
    // Il nostro attacco, e gli altri modi di fare punto loro, lo chiedono come prima.
    expect(asksPlayerFor("us", "attack")).toBe(true);
    expect(asksPlayerFor("opp", "block")).toBe(true);
    expect(asksPlayerFor("opp", "ace")).toBe(true);
    // L'attacco sbagliato loro è un errore (punto nostro), non un attacco vincente.
    expect(asksPlayerFor("opp", "attackError")).toBe(true);
    // I falli di squadra restano di squadra, per tutte e due.
    expect(asksPlayerFor("opp", "rotationFault")).toBe(false);
    expect(asksPlayerFor("us", "sanction")).toBe(false);
  });
});

test.describe("set, partita e battuta", () => {
  test("punteggio e battuta si ricavano dalla sequenza", () => {
    let data = emptyMatch({ firstServer: "us" });
    data = rally(data, "us", "attack"); // 1-0, batteva noi
    data = rally(data, "opp", "attack"); // 1-1, batteva noi e perdiamo la battuta
    data = rally(data, "opp", "ace"); // 1-2, batte loro
    data = rally(data, "opp", "serveError"); // 2-2, batteva loro e sbagliano
    data = rally(data, "us", "attack"); // 3-2

    const view = deriveScout(data);
    expect(view.rallies.map((r) => r.server)).toEqual(["us", "us", "opp", "opp", "us"]);
    expect(view.rallies.map((r) => r.winner)).toEqual(["us", "opp", "opp", "us", "us"]);
    expect(view.rallies.map((r) => `${r.score.us}-${r.score.opp}`)).toEqual(["1-0", "1-1", "1-2", "2-2", "3-2"]);
    expect(view.rallies.map((r) => r.n)).toEqual([1, 2, 3, 4, 5]);
    expect(currentServer(view)).toBe("us");
    expect(view.current?.score).toEqual({ us: 3, opp: 2 });
  });

  test("chi batte per primo nel 1° set si sceglie", () => {
    const data = rally(emptyMatch({ firstServer: "opp" }), "us", "attack");
    expect(deriveScout(data).rallies[0].server).toBe("opp");
    expect(currentServer(deriveScout(emptyMatch({ firstServer: "opp" })))).toBe("opp");
  });

  test("il set finisce a 25 con due punti di scarto, altrimenti si va ai vantaggi", () => {
    expect(isSetOver({ us: 25, opp: 23 }, 25)).toBe(true);
    expect(isSetOver({ us: 25, opp: 24 }, 25)).toBe(false);
    expect(isSetOver({ us: 24, opp: 24 }, 25)).toBe(false);
    expect(isSetOver({ us: 26, opp: 24 }, 25)).toBe(true);
    expect(isSetOver({ us: 30, opp: 29 }, 25)).toBe(false);
    expect(isSetOver({ us: 24, opp: 0 }, 25)).toBe(false);
  });

  test("al meglio dei 5 set il quinto è a 15", () => {
    expect(maxSets("bo5")).toBe(5);
    expect(maxSets("bo3")).toBe(3);
    expect(maxSets("fixed3")).toBe(3);
    const bo5 = DEFAULT_SETTINGS;
    expect([1, 2, 3, 4].map((n) => setTarget(bo5, n))).toEqual([25, 25, 25, 25]);
    expect(setTarget(bo5, 5)).toBe(15);
    expect(setTarget({ ...bo5, format: "bo3" }, 3)).toBe(15);
    expect(setTarget({ ...bo5, format: "bo3" }, 2)).toBe(25);
  });

  test("si propone di chiudere il set solo quando è davvero finito", () => {
    let data = points(emptyMatch(), "us", 24);
    expect(suggestedSetEnd(deriveScout(data), data.settings)).toBeNull();
    data = points(data, "us", 1);
    expect(suggestedSetEnd(deriveScout(data), data.settings)).toEqual({ winner: "us", score: { us: 25, opp: 0 } });

    let deuce = points(points(emptyMatch(), "us", 24), "opp", 24);
    deuce = points(deuce, "us", 1);
    expect(suggestedSetEnd(deriveScout(deuce), deuce.settings)).toBeNull();
    deuce = points(deuce, "us", 1);
    expect(suggestedSetEnd(deriveScout(deuce), deuce.settings)?.winner).toBe("us");
  });

  test("chiudere il set apre il successivo con chi batte per primo scelto", () => {
    const data = close(points(emptyMatch({ firstServer: "us" }), "us", 25), "opp");
    const view = deriveScout(data);
    expect(view.sets).toHaveLength(2);
    expect(view.setsWon).toEqual({ us: 1, opp: 0 });
    expect(view.sets[0].closed).toBe(true);
    expect(view.sets[0].winner).toBe("us");
    expect(view.current?.n).toBe(2);
    expect(view.current?.firstServer).toBe("opp");
    expect(currentServer(view)).toBe("opp");
    expect(defaultNextServer(view.sets[0])).toBe("opp");
    expect(defaultNextServer({ firstServer: "opp" })).toBe("us");
  });

  test("non si chiude un set vuoto o in parità", () => {
    const empty = emptyMatch();
    expect(close(empty)).toBe(empty);
    const tied = rally(rally(empty, "us", "attack"), "opp", "attack");
    expect(close(tied)).toBe(tied);
  });

  test("al meglio dei 5 la partita finisce al terzo set vinto", () => {
    let data = emptyMatch();
    data = close(points(data, "us", 25));
    data = close(points(data, "opp", 25));
    data = close(points(data, "us", 25));
    data = close(points(data, "opp", 25));
    let view = deriveScout(data);
    expect(view.setsWon).toEqual({ us: 2, opp: 2 });
    expect(view.decided).toBe(false);
    expect(view.current?.n).toBe(5);

    // Il quinto è a 15.
    data = points(data, "us", 14);
    expect(suggestedSetEnd(deriveScout(data), data.settings)).toBeNull();
    data = close(points(data, "us", 1));
    view = deriveScout(data);
    expect(view.setsWon).toEqual({ us: 3, opp: 2 });
    expect(view.decided).toBe(true);
    expect(view.current).toBeNull();
  });

  test("al meglio dei 3 la partita finisce al secondo set vinto, e poi non si aggiunge altro", () => {
    let data = emptyMatch({ format: "bo3" });
    data = close(points(data, "opp", 25));
    data = close(points(data, "opp", 25));
    const view = deriveScout(data);
    expect(view.decided).toBe(true);
    expect(view.setsWon).toEqual({ us: 0, opp: 2 });
    expect(rally(data, "us", "attack")).toBe(data);
    expect(close(data)).toBe(data);
  });

  test("con 3 set obbligatori si giocano sempre tutti e tre", () => {
    let data = emptyMatch({ format: "fixed3", lastSetPoints: 25 });
    data = close(points(data, "us", 25));
    data = close(points(data, "us", 25));
    let view = deriveScout(data);
    expect(view.setsWon).toEqual({ us: 2, opp: 0 });
    expect(view.decided).toBe(false);
    expect(view.current?.n).toBe(3);
    expect(suggestedSetEnd(deriveScout(points(data, "opp", 24)), data.settings)).toBeNull();
    data = close(points(data, "opp", 25));
    view = deriveScout(data);
    expect(view.decided).toBe(true);
    expect(view.setsWon).toEqual({ us: 2, opp: 1 });
  });

  test("eventi in coda a una partita già decisa (dati vecchi) vengono ignorati", () => {
    let data = emptyMatch({ format: "bo3" });
    data = close(points(data, "us", 25));
    data = close(points(data, "us", 25));
    const extra = { ...data, events: [...data.events, { type: "rally" as const, id: "late", at: T0, actor: "opp" as const, how: "ace" as const, player: null, victim: null }] };
    const view = deriveScout(extra);
    expect(view.rallies).toHaveLength(50);
    expect(view.setsWon).toEqual({ us: 2, opp: 0 });
  });
});

test.describe("operazioni sui dati", () => {
  test("lo scambio tiene solo giocatrici in rosa e il «chi attaccava» solo per il muro", () => {
    let data = emptyMatch();
    data = rally(data, "us", "attack", "a1");
    data = rally(data, "us", "attack", "non-esiste");
    data = rally(data, "us", "attack", "opp-5"); // è dell'altra squadra
    data = rally(data, "us", "block", "a1", "opp-9");
    data = rally(data, "us", "block", "a1", "a2"); // l'attaccante deve essere dell'altra squadra
    data = rally(data, "us", "attack", "a1", "opp-9"); // fuori dal muro non ha senso
    const events = data.events.flatMap((e) => (e.type === "rally" ? [e] : []));
    expect(events.map((e) => e.player)).toEqual(["a1", null, null, "a1", "a1", "a1"]);
    expect(events.map((e) => e.victim)).toEqual([null, null, null, "opp-9", null, null]);
  });

  test("annulla toglie l'ultimo evento, anche una chiusura di set", () => {
    const base = points(emptyMatch(), "us", 25);
    const closed = close(base);
    expect(deriveScout(closed).sets).toHaveLength(2);
    const reopened = undoLast(closed);
    expect(deriveScout(reopened).sets).toHaveLength(1);
    expect(reopened.events).toHaveLength(25);
    expect(undoLast(reopened).events).toHaveLength(24);
    expect(undoLast(emptyMatch()).events).toHaveLength(0);
  });

  test("annullare riapre una partita chiusa a mano", () => {
    const finished = finishMatch(points(emptyMatch(), "us", 3));
    expect(finished.finished).toBe(true);
    expect(rally(finished, "us", "attack")).toBe(finished);
    expect(undoLast(finished).finished).toBe(false);
    expect(finishMatch(finished)).toBe(finished);
  });

  test("togliere o correggere uno scambio ricalcola punteggi e battute", () => {
    let data = emptyMatch({ firstServer: "us" });
    data = rally(data, "us", "attack", "a1"); // 1-0
    data = rally(data, "opp", "attack"); // 1-1, batte loro
    data = rally(data, "opp", "ace"); // 1-2
    const secondId = data.events[1].id;

    const without = removeEvent(data, secondId);
    expect(deriveScout(without).current?.score).toEqual({ us: 1, opp: 1 });
    expect(removeEvent(data, "non-esiste")).toBe(data);

    // «Attacco loro» diventa «attacco sbagliato loro»: il punto passa a noi.
    const fixed = updateRally(data, secondId, { actor: "opp", how: "attackError", player: null });
    expect(deriveScout(fixed).rallies.map((r) => r.winner)).toEqual(["us", "us", "opp"]);
    expect(deriveScout(fixed).current?.score).toEqual({ us: 2, opp: 1 });
    // Chi batteva cambia di conseguenza: dopo il secondo punto batte ancora noi.
    expect(deriveScout(fixed).rallies.map((r) => r.server)).toEqual(["us", "us", "us"]);
  });

  test("la rosa: niente doppioni, e si toglie solo chi non compare negli scambi", () => {
    let data = emptyMatch();
    expect(addPlayer(data, "us", ANNA)).toBe(data);
    data = rally(data, "us", "attack", "a1");
    expect(removePlayer(data, "us", "a1")).toBe(data);
    expect(removePlayer(data, "us", "a2").roster.us.map((p) => p.id)).toEqual(["a1", "a3"]);
    data = rally(data, "us", "block", "a3", "opp-9"); // anche chi è stata murata conta
    expect(removePlayer(data, "opp", "opp-9")).toBe(data);
    expect(removePlayer(data, "opp", "opp-5").roster.opp.map((p) => p.id)).toEqual(["opp-9"]);
  });

  test("numeri di maglia ripuliti e giocatrici avversarie riconoscibili dal numero", () => {
    expect(cleanNumber("7")).toBe("7");
    expect(cleanNumber("007")).toBe("7");
    expect(cleanNumber(" 12 ")).toBe("12");
    expect(cleanNumber("1a2")).toBe("12");
    expect(cleanNumber("123")).toBe("12");
    expect(cleanNumber("")).toBeNull();
    expect(cleanNumber("abc")).toBeNull();
    expect(opponentPlayer("7")).toEqual({ id: "opp-7", name: "n. 7", number: "7", libero: false });
    const mine = manualPlayer("k1", "  Giulia ", "11");
    expect(mine).toEqual({ id: "x-k1", name: "Giulia", number: "11", libero: false });
  });

  test("le impostazioni si cambiano senza toccare gli scambi", () => {
    const data = points(emptyMatch(), "us", 3);
    const changed = updateSettings(data, { format: "bo3", firstServer: "opp" });
    expect(changed.settings).toMatchObject({ format: "bo3", firstServer: "opp", setPoints: 25 });
    expect(changed.events).toBe(data.events);
  });
});

/**
 * Partita di prova, 11 scambi, tutti i conti fatti a mano:
 *
 *  1  noi   attacco       Anna          (batte noi)  1-0
 *  2  noi   ace           Bea           (noi)        2-0
 *  3  noi   muro          Anna su n.5   (noi)        3-0
 *  4  loro  attacco       n.9           (noi)        3-1
 *  5  noi   ricezione ✗   Carla         (loro)       3-2
 *  6  loro  battuta ✗     n.5           (loro)       4-2
 *  7  noi   attacco ✗     Anna          (noi)        4-3
 *  8  loro  muro          n.9 su Bea    (loro)       4-4
 *  9  noi   attacco       (non so chi)  (loro)       5-4
 * 10  noi   tocco rete    Bea           (noi)        5-5
 * 11  loro  sanzione      (squadra)     (loro)       6-5
 */
function sampleMatch(): ScoutData {
  let data = emptyMatch({ firstServer: "us" });
  data = rally(data, "us", "attack", "a1");
  data = rally(data, "us", "ace", "a2");
  data = rally(data, "us", "block", "a1", "opp-5");
  data = rally(data, "opp", "attack", "opp-9");
  data = rally(data, "us", "receptionError", "a3");
  data = rally(data, "opp", "serveError", "opp-5");
  data = rally(data, "us", "attackError", "a1");
  data = rally(data, "opp", "block", "opp-9", "a2");
  data = rally(data, "us", "attack");
  data = rally(data, "us", "netFault", "a2");
  data = rally(data, "opp", "sanction");
  return data;
}

test.describe("tabellino", () => {
  test("squadre: punti per tipo, errori, break point e cambio palla", () => {
    const stats = statsOf(sampleMatch());
    expect(stats.rallies).toBe(11);

    const { us, opp } = stats;
    expect(us.points).toBe(6);
    expect([us.attack, us.block, us.ace]).toEqual([2, 1, 1]);
    expect(us.points - us.attack - us.block - us.ace).toBe(2); // i due errori/falli di loro
    expect(us.errors).toBe(3);
    expect(us.committed.receptionError).toBe(1);
    expect(us.committed.attackError).toBe(1);
    expect(us.committed.netFault).toBe(1);
    expect([us.served, us.breakPoints]).toEqual([6, 3]);
    expect([us.received, us.sideOuts]).toEqual([5, 3]);
    expect(us.longestRun).toBe(3);

    expect(opp.points).toBe(5);
    expect([opp.attack, opp.block, opp.ace]).toEqual([1, 1, 0]);
    expect(opp.points - opp.attack - opp.block - opp.ace).toBe(3);
    expect(opp.errors).toBe(2);
    expect(opp.committed.serveError).toBe(1);
    expect(opp.committed.sanction).toBe(1);
    expect([opp.served, opp.breakPoints]).toEqual([5, 2]);
    expect([opp.received, opp.sideOuts]).toEqual([6, 3]);
    expect(opp.longestRun).toBe(2);

    // I conti tornano: ogni scambio ha una battuta e una ricezione, un vincitore.
    expect(us.points + opp.points).toBe(stats.rallies);
    expect(us.served + opp.served).toBe(stats.rallies);
    expect(us.breakPoints + opp.sideOuts).toBe(us.served);
    expect(opp.breakPoints + us.sideOuts).toBe(opp.served);
  });

  test("giocatrici: punti, break point, errori, muri subiti e saldo", () => {
    const { players } = statsOf(sampleMatch());
    expect(players.us.map((p) => p.id)).toEqual(["a3", "a1", "a2", UNASSIGNED_ID]); // per maglia, poi «Non assegnato»

    const [carla, anna, bea, nobody] = players.us;
    expect(carla).toMatchObject({ points: 0, receptionErrors: 1, errors: 1, blocked: 0, balance: -1 });
    expect(anna).toMatchObject({ kills: 1, stuffs: 1, aces: 0, points: 2, bp: 2, attackErrors: 1, errors: 1, blocked: 0, balance: 1 });
    expect(bea).toMatchObject({ aces: 1, points: 1, bp: 1, otherErrors: 1, errors: 1, blocked: 1, balance: -1 });
    expect(nobody).toMatchObject({ name: "Non assegnato", kills: 1, points: 1, bp: 0, errors: 0, balance: 1 });

    const [n5, n9, oppNobody] = players.opp;
    expect(n5).toMatchObject({ number: "5", serveErrors: 1, blocked: 1, points: 0, errors: 1, balance: -2 });
    expect(n9).toMatchObject({ number: "9", kills: 1, stuffs: 1, points: 2, bp: 1, balance: 2 });
    expect(oppNobody).toMatchObject({ id: UNASSIGNED_ID, otherErrors: 1, errors: 1, balance: -1 });

    // Il tabellino è coerente con i totali di squadra.
    for (const side of ["us", "opp"] as const) {
      const lines = players[side];
      const team = statsOf(sampleMatch())[side];
      expect(lines.reduce((sum, p) => sum + p.points, 0)).toBe(team.attack + team.block + team.ace);
      expect(lines.reduce((sum, p) => sum + p.errors, 0)).toBe(team.errors);
    }
  });

  test("chi non compare in nessuno scambio non ha attività; «Non assegnato» c'è solo se serve", () => {
    let data = emptyMatch();
    data = rally(data, "us", "attack", "a1");
    const { players } = statsOf(data);
    expect(players.us.find((p) => p.id === UNASSIGNED_ID)).toBeUndefined();
    expect(players.us.find((p) => p.id === "a2" && hasActivity(p))).toBeUndefined();
    expect(players.us.filter(hasActivity).map((p) => p.id)).toEqual(["a1"]);
  });

  test("una giocatrice non più in rosa finisce in «Non assegnato» senza far saltare i conti", () => {
    const data = sampleMatch();
    const { roster, ...rest } = data;
    const stats = statsOf({ ...rest, roster: { ...roster, us: roster.us.filter((p) => p.id !== "a1") } });
    expect(stats.players.us.find((p) => p.id === "a1")).toBeUndefined();
    const nobody = stats.players.us.find((p) => p.id === UNASSIGNED_ID);
    expect(nobody).toMatchObject({ kills: 2, stuffs: 1, attackErrors: 1, points: 3 });
    expect(stats.us.points).toBe(6);
  });

  test("un muro senza dire chi attaccava segna l'attacco murato su «Non assegnato» dell'altra squadra", () => {
    const data = rally(emptyMatch(), "us", "block", "a1");
    const { players } = statsOf(data);
    expect(players.opp.find((p) => p.id === UNASSIGNED_ID)).toMatchObject({ blocked: 1, balance: -1 });
  });

  test("andamento del set, serie di punti e durata stimata", () => {
    const { sets } = statsOf(sampleMatch());
    expect(sets).toHaveLength(1);
    expect(sets[0].flow).toEqual([0, 1, 2, 3, 2, 1, 2, 1, 0, 1, 0, 1]);
    expect(sets[0].longestRun).toEqual({ us: 3, opp: 2 });
    expect(sets[0].rallies).toBe(11);
    expect(sets[0].minutes).toBe(10); // dal primo all'ultimo punto, un minuto l'uno dall'altro
    expect(sets[0].closed).toBe(false);
    expect(sets[0].firstServer).toBe("us");
  });

  test("la durata si dice solo se ha senso", () => {
    expect(statsOf(rally(emptyMatch(), "us", "attack")).sets[0].minutes).toBeNull(); // un solo punto
    const burst = emptyMatch();
    const fast = { ...burst, events: [1, 2, 3].map((i) => ({ type: "rally" as const, id: `f${i}`, at: T0 + i * 1000, actor: "us" as const, how: "attack" as const, player: null, victim: null })) };
    expect(statsOf(fast).sets[0].minutes).toBeNull(); // inseriti tutti insieme a fine partita
  });

  test("per set: il filtro conta solo gli scambi di quel set, i riepiloghi restano tutti", () => {
    let data = emptyMatch();
    data = points(data, "us", 25);
    data = close(data, "opp");
    data = rally(data, "opp", "attack", "opp-9");
    data = rally(data, "opp", "attack", "opp-9");
    data = rally(data, "us", "ace", "a2");
    const view = deriveScout(data);

    const all = computeStats(view, data.roster);
    const first = computeStats(view, data.roster, { set: 1 });
    const second = computeStats(view, data.roster, { set: 2 });

    expect(all.rallies).toBe(28);
    expect(first.rallies).toBe(25);
    expect(second.rallies).toBe(3);
    expect(first.us.points).toBe(25);
    expect(first.opp.points).toBe(0);
    expect(second.us).toMatchObject({ points: 1, ace: 1, attack: 0 });
    expect(second.opp).toMatchObject({ points: 2, attack: 2 });
    expect(second.players.opp.find((p) => p.id === "opp-9")).toMatchObject({ kills: 2, points: 2 });
    expect(first.players.opp.find((p) => p.id === "opp-9")?.points).toBe(0);

    // La serie più lunga è quella del set considerato.
    expect(first.us.longestRun).toBe(25);
    expect(second.us.longestRun).toBe(1);
    expect(all.us.longestRun).toBe(25);
    expect(second.opp.longestRun).toBe(2);

    // Il filtro non nasconde i set: servono per i selettori e i parziali.
    expect(second.sets.map((s) => s.n)).toEqual([1, 2]);
    expect(second.sets[0].score).toEqual({ us: 25, opp: 0 });
    expect(second.sets[0].winner).toBe("us");

    // Un set che non esiste: tutto a zero.
    expect(computeStats(view, data.roster, { set: 4 }).rallies).toBe(0);
  });

  test("percentuali", () => {
    expect(percent(3, 6)).toBe(50);
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 5)).toBe(0);
    expect(percent(0, 0)).toBeNull();
  });

  test("partita senza scambi: tutto a zero e nessun errore", () => {
    const stats = statsOf(emptyMatch());
    expect(stats.rallies).toBe(0);
    expect(stats.us.points).toBe(0);
    expect(stats.us.longestRun).toBe(0);
    expect(stats.sets[0].flow).toEqual([0]);
    expect(stats.players.us.filter(hasActivity)).toHaveLength(0);
  });
});

test.describe("stagione", () => {
  test("somma le partite: stessa atleta per id, scritte a mano per nome, «Non assegnato» in fondo", () => {
    const first = sampleMatch(); // Anna 2 punti, Bea 1, Carla 0
    let second = newScoutData({ us: [], opp: [] });
    second = addPlayer(second, "us", ANNA);
    second = addPlayer(second, "us", manualPlayer("zz", "Giulia", "11"));
    second = rally(second, "us", "attack", "a1");
    second = rally(second, "us", "attack", "x-zz");
    second = rally(second, "us", "attack"); // senza dire chi

    let third = newScoutData({ us: [], opp: [] });
    third = addPlayer(third, "us", manualPlayer("yy", " giulia ", "11"));
    third = rally(third, "us", "ace", "x-yy");

    const empty = emptyMatch(); // nessun punto: non conta come partita

    const season = aggregateSeason([first, empty, second, third]);
    expect(season.matches).toBe(3);
    expect(season.rallies).toBe(11 + 3 + 1);
    // Per numero di maglia: Carla 1, Anna 4, Bea 7, Giulia 11 (con il nome dell'ultima partita).
    expect(season.players.map((p) => p.name)).toEqual(["Carla", "Anna", "Bea", "giulia", "Non assegnato"]);

    const anna = season.players.find((p) => p.id === "a1");
    expect(anna).toMatchObject({ matches: 2, points: 3, kills: 2, stuffs: 1, errors: 1 });
    const giulia = season.players.find((p) => p.name.toLowerCase() === "giulia");
    expect(giulia).toMatchObject({ matches: 2, points: 2, kills: 1, aces: 1 });
    expect(season.players.filter((p) => p.name.toLowerCase() === "giulia")).toHaveLength(1);
    // I punti senza nome di tutte le partite (uno nella prima, uno nella seconda) stanno su un'unica riga.
    expect(season.players.find((p) => p.id === UNASSIGNED_ID)).toMatchObject({ kills: 2, points: 2, matches: 2 });
    expect(season.players.reduce((sum, p) => sum + p.points, 0)).toBe(season.us.attack + season.us.block + season.us.ace);

    expect(season.us.points).toBe(6 + 3 + 1);
    expect(season.us.longestRun).toBe(3);
    expect(season.opp.points).toBe(5);
  });

  test("nessuna partita: nessun errore", () => {
    const season = aggregateSeason([]);
    expect(season).toMatchObject({ matches: 0, rallies: 0, players: [] });
  });
});

test.describe("salvataggio: forma valida", () => {
  test("una partita vera passa e resta identica", () => {
    const data = close(points(sampleMatch(), "us", 20));
    const parsed = scoutDataSchema.safeParse(data);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(data);
  });

  test("scartati: conclusioni inventate, numeri strani, eventi o giocatrici doppie", () => {
    const base = sampleMatch();
    const bad = (mutate: (copy: ScoutData) => ScoutData) => scoutDataSchema.safeParse(mutate(structuredClone(base))).success;

    expect(bad((d) => d)).toBe(true);
    expect(bad((d) => ({ ...d, events: d.events.map((e, i) => (i === 0 && e.type === "rally" ? { ...e, how: "boom" as ScoutHow } : e)) }))).toBe(false);
    expect(bad((d) => ({ ...d, events: [...d.events, d.events[0]] }))).toBe(false);
    expect(bad((d) => ({ ...d, roster: { ...d.roster, us: [...d.roster.us, d.roster.us[0]] } }))).toBe(false);
    expect(bad((d) => ({ ...d, roster: { ...d.roster, us: [{ ...d.roster.us[0], number: "123" }] } }))).toBe(false);
    expect(bad((d) => ({ ...d, settings: { ...d.settings, format: "bo7" as "bo5" } }))).toBe(false);
    expect(bad((d) => ({ ...d, settings: { ...d.settings, setPoints: 3 } }))).toBe(false);
    expect(bad((d) => ({ ...d, finished: "si" as unknown as boolean }))).toBe(false);
  });

  test("un numero smisurato di eventi viene rifiutato", () => {
    const many = Array.from({ length: MAX_SCOUT_EVENTS + 1 }, (_, i) => ({
      type: "rally" as const,
      id: `m${i}`,
      at: T0,
      actor: "us" as const,
      how: "attack" as const,
      player: null,
      victim: null,
    }));
    expect(scoutDataSchema.safeParse({ ...emptyMatch(), events: many }).success).toBe(false);
    expect(scoutDataSchema.safeParse({ ...emptyMatch(), events: many.slice(0, 300) }).success).toBe(true);
  });
});
