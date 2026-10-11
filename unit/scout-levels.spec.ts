import { expect, test } from "@playwright/test";
import {
  addPlayer,
  addTouch,
  DEFAULT_SETTINGS,
  endSet,
  insertTouch,
  newScoutData,
  normalizeSettings,
  opponentPlayer,
  removePlayer,
  removeRally,
  removeTouch,
  scoutReducer,
  undoLast,
  updateTouch,
  usedPlayerIds,
  addRally,
  type TouchInput,
} from "@/lib/scout/actions";
import { deriveScout, currentServer } from "@/lib/scout/derive";
import { effectiveLevel, hasTouches, higherLevel, levelOf, LEVEL_META, recordsReceptions, recordsTouches } from "@/lib/scout/levels";
import { MAX_SCOUT_EVENTS, scoutDataSchema } from "@/lib/scout/schema";
import { aggregateSeason, computeStats, hasActivity, statsOf, zonedTouches } from "@/lib/scout/stats";
import { scoutContent } from "@/lib/scout/sync";
import {
  effectiveTouches,
  endsRally,
  GRADE_META,
  gradeSymbol,
  isGradeAllowed,
  suggestNext,
  TOUCH_SKILL_ORDER,
  TOUCH_SKILLS,
  touchOutcome,
} from "@/lib/scout/touches";
import { SCOUT_GRADES, SCOUT_LEVELS, SCOUT_TOUCH_SKILLS, type ScoutData, type ScoutGrade, type ScoutSide, type ScoutTouch, type ScoutTouchSkill } from "@/lib/scout/types";

/** Livelli dello scout: tocchi con voto (ricezioni e scambio completo), regole di chiusura, conti e salvataggio. */

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);

const ANNA = { id: "a1", name: "Anna", number: "4", libero: false };
const BEA = { id: "a2", name: "Bea", number: "7", libero: false };
const CARLA = { id: "a3", name: "Carla", number: "1", libero: true };

function emptyMatch(settings: Partial<ScoutData["settings"]> = {}): ScoutData {
  let data = newScoutData({ us: [], opp: [] }, { level: "completo", ...settings });
  for (const p of [ANNA, BEA, CARLA]) data = addPlayer(data, "us", p);
  for (const n of ["5", "9"]) data = addPlayer(data, "opp", opponentPlayer(n));
  return data;
}

let seq = 0;
function touch(
  data: ScoutData,
  side: ScoutSide,
  skill: ScoutTouchSkill,
  player: string | null,
  grade: ScoutGrade,
  zone: number | null = null,
): ScoutData {
  seq += 1;
  return addTouch(data, { side, skill, player, grade, zone }, T0 + data.events.length * 1000, `t${seq}`);
}

function outcome(data: ScoutData, actor: ScoutSide, how: Parameters<typeof addRally>[1]["how"], player: string | null = null, victim: string | null = null): ScoutData {
  seq += 1;
  return addRally(data, { actor, how, player, victim }, T0 + data.events.length * 1000, `r${seq}`);
}

function asTouch(side: ScoutSide, skill: ScoutTouchSkill, player: string | null, grade: ScoutGrade): ScoutTouch {
  seq += 1;
  return { id: `x${seq}`, at: T0, side, skill, player, grade, zone: null };
}

/**
 * Sei scambi, tutti i conti fatti a mano (battiamo noi per primi):
 *
 *  1  noi batte Anna !, loro ricevono n.5 +, n.5 attacca e viene murato /, Bea muro #     1-0  (batte noi)
 *  2  noi batte Anna # (ace)                                                              2-0  (batte noi)
 *  3  noi batte Anna = (errore)                                                           2-1  (batte noi, perde la battuta)
 *  4  loro battono n.9 !, Carla riceve # (zona 5), Anna attacca # (zona 4)                3-1  (cambio palla)
 *  5  noi batte Bea !, n.5 riceve -, n.5 attacca + (zona 4), Carla difende + (zona 6),
 *     Anna attacca =                                                                      3-2
 *  6  loro battono n.9 !, Anna riceve / (zona 1), n.5 attacca #                           3-3  (break point loro)
 */
function sixRallies(): ScoutData {
  let d = emptyMatch({ firstServer: "us" });
  // 1
  d = touch(d, "us", "serve", "a1", "!");
  d = touch(d, "opp", "reception", "opp-5", "+");
  d = touch(d, "opp", "attack", "opp-5", "/");
  d = touch(d, "us", "block", "a2", "#");
  // 2
  d = touch(d, "us", "serve", "a1", "#");
  // 3
  d = touch(d, "us", "serve", "a1", "=");
  // 4
  d = touch(d, "opp", "serve", "opp-9", "!");
  d = touch(d, "us", "reception", "a3", "#", 5);
  d = touch(d, "us", "attack", "a1", "#", 4);
  // 5
  d = touch(d, "us", "serve", "a2", "!");
  d = touch(d, "opp", "reception", "opp-5", "-");
  d = touch(d, "opp", "attack", "opp-5", "+", 4);
  d = touch(d, "us", "dig", "a3", "+", 6);
  d = touch(d, "us", "attack", "a1", "=");
  // 6
  d = touch(d, "opp", "serve", "opp-9", "!");
  d = touch(d, "us", "reception", "a1", "/", 1);
  d = touch(d, "opp", "attack", "opp-5", "#");
  return d;
}

test.describe("le regole dei tocchi", () => {
  test("i livelli sono tre, con testi per la scelta, e il vecchio scout vale «base»", () => {
    expect([...SCOUT_LEVELS]).toEqual(["base", "ricezioni", "completo"]);
    for (const level of SCOUT_LEVELS) {
      const meta = LEVEL_META[level];
      expect(meta.label.length).toBeGreaterThan(3);
      expect(meta.marks.length).toBeGreaterThan(0);
      expect(meta.gets.length).toBeGreaterThan(0);
      expect(meta.needs.length).toBeGreaterThan(0);
    }
    expect(levelOf({})).toBe("base");
    expect(levelOf({ level: "ricezioni" })).toBe("ricezioni");
    expect(levelOf({ level: "inventato" })).toBe("base");
    expect(recordsReceptions("base")).toBe(false);
    expect(recordsReceptions("ricezioni")).toBe(true);
    expect(recordsTouches("ricezioni")).toBe(false);
    expect(recordsTouches("completo")).toBe(true);
    expect(higherLevel("base", "completo")).toBe("completo");
    expect(higherLevel("completo", "ricezioni")).toBe("completo");
    expect(DEFAULT_SETTINGS.level).toBe("base");
    expect(normalizeSettings({ format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" })).toMatchObject({ publicLive: false, level: "base" });
  });

  test("ogni fondamentale ha lettera, nome, voti e spiegazioni coerenti", () => {
    expect(TOUCH_SKILL_ORDER).toEqual([...SCOUT_TOUCH_SKILLS]);
    expect(new Set(TOUCH_SKILL_ORDER.map((s) => TOUCH_SKILLS[s].letter)).size).toBe(6);
    for (const skill of SCOUT_TOUCH_SKILLS) {
      const meta = TOUCH_SKILLS[skill];
      expect(meta.grades.length).toBeGreaterThanOrEqual(3);
      // Ogni voto proposto ha il suo nome e la sua spiegazione, e il peggiore (l'errore) c'è sempre.
      for (const grade of meta.grades) {
        expect(meta.gradeLabels[grade], `${skill} ${grade}`).toBeTruthy();
        expect(meta.gradeHints[grade], `${skill} ${grade}`).toBeTruthy();
        expect(isGradeAllowed(skill, grade)).toBe(true);
      }
      expect(meta.grades).toContain("=");
    }
    expect(isGradeAllowed("serve", "+")).toBe(false);
    expect(isGradeAllowed("attack", "-")).toBe(false);
    expect(gradeSymbol("-")).toBe("−");
    expect(Object.keys(GRADE_META).sort()).toEqual([...SCOUT_GRADES].sort());
  });

  test("un errore chiude sempre lo scambio; il # solo per battuta, attacco e muro", () => {
    for (const skill of SCOUT_TOUCH_SKILLS) expect(endsRally(skill, "=")).toBe(true);
    for (const skill of ["serve", "attack", "block"] as const) expect(endsRally(skill, "#")).toBe(true);
    for (const skill of ["reception", "set", "dig"] as const) expect(endsRally(skill, "#")).toBe(false);
    for (const grade of ["+", "!", "-", "/"] as const) {
      for (const skill of SCOUT_TOUCH_SKILLS) expect(endsRally(skill, grade)).toBe(false);
    }
  });

  test("dal voto si ricava chi fa punto e come", () => {
    const cases: [ScoutTouchSkill, ScoutGrade, string][] = [
      ["serve", "#", "ace"],
      ["serve", "=", "serveError"],
      ["reception", "=", "receptionError"],
      ["set", "=", "setError"],
      ["attack", "#", "attack"],
      ["attack", "=", "attackError"],
      ["block", "#", "block"],
      ["block", "=", "blockError"],
      ["dig", "=", "digError"],
    ];
    for (const [skill, grade, how] of cases) {
      const out = touchOutcome(asTouch("us", skill, "a1", grade), []);
      expect(out, `${skill} ${grade}`).toMatchObject({ actor: "us", how, player: "a1" });
    }
    expect(touchOutcome(asTouch("us", "reception", "a1", "+"), [])).toBeNull();
    expect(touchOutcome(asTouch("us", "attack", "a1", "/"), [])).toBeNull();
    expect(touchOutcome(asTouch("opp", "dig", "opp-5", "!"), [])).toBeNull();
  });

  test("un muro vincente ricorda chi aveva attaccato", () => {
    const before = [asTouch("opp", "serve", "opp-9", "!"), asTouch("us", "reception", "a3", "+"), asTouch("opp", "attack", "opp-5", "/")];
    expect(touchOutcome(asTouch("us", "block", "a2", "#"), before)?.victim).toBe("opp-5");
    // Senza un attacco avversario prima non c'è nessuno da indicare.
    expect(touchOutcome(asTouch("us", "block", "a2", "#"), [asTouch("us", "attack", "a1", "+")])?.victim).toBeNull();
    // Il muro sbagliato non ha vittime.
    expect(touchOutcome(asTouch("us", "block", "a2", "="), before)?.victim).toBeNull();
  });

  test("il tocco successivo si propone da solo (e chi segna può sempre scegliere altro)", () => {
    expect(suggestNext([], "opp")).toEqual({ skill: "serve", side: "opp" });
    expect(suggestNext([asTouch("us", "serve", "a1", "!")], "us")).toEqual({ skill: "reception", side: "opp" });
    expect(suggestNext([asTouch("opp", "reception", "opp-5", "+")], "us")).toEqual({ skill: "attack", side: "opp" });
    expect(suggestNext([asTouch("opp", "set", "opp-9", "+")], "us")).toEqual({ skill: "attack", side: "opp" });
    expect(suggestNext([asTouch("us", "attack", "a1", "+")], "us")).toEqual({ skill: "dig", side: "opp" });
    expect(suggestNext([asTouch("us", "attack", "a1", "/")], "us")).toEqual({ skill: "block", side: "opp" });
    expect(suggestNext([asTouch("opp", "block", "opp-5", "+")], "us")).toEqual({ skill: "dig", side: "opp" });
    expect(suggestNext([asTouch("us", "dig", "a3", "+")], "us")).toEqual({ skill: "attack", side: "us" });
    // Palla rimandata di là: la gioca e attacca l'altra squadra.
    expect(suggestNext([asTouch("us", "reception", "a3", "/")], "opp")).toEqual({ skill: "attack", side: "opp" });
    expect(suggestNext([asTouch("us", "dig", "a3", "/")], "opp")).toEqual({ skill: "attack", side: "opp" });
  });
});

test.describe("gli scambi dai tocchi", () => {
  test("un voto che chiude lo scambio dà punto da solo; gli altri restano in sospeso", () => {
    let d = emptyMatch({ firstServer: "us" });
    d = touch(d, "us", "serve", "a1", "!");
    d = touch(d, "opp", "reception", "opp-5", "+");
    let view = deriveScout(d);
    expect(view.rallies).toHaveLength(0);
    expect(view.pending.map((t) => t.skill)).toEqual(["serve", "reception"]);
    expect(view.current?.score).toEqual({ us: 0, opp: 0 });

    d = touch(d, "opp", "attack", "opp-5", "#"); // attacco a terra: punto loro
    view = deriveScout(d);
    expect(view.pending).toHaveLength(0);
    expect(view.rallies).toHaveLength(1);
    const rally = view.rallies[0];
    expect(rally).toMatchObject({ actor: "opp", how: "attack", winner: "opp", player: "opp-5", server: "us", closedBy: "touch" });
    expect(rally.score).toEqual({ us: 0, opp: 1 });
    expect(rally.touches.map((t) => `${t.side}:${t.skill}:${t.grade}`)).toEqual(["us:serve:!", "opp:reception:+", "opp:attack:#"]);
    expect(rally.eventIds).toEqual(rally.touches.map((t) => t.id));
    // Hanno vinto loro mentre ricevevano: ora battono loro.
    expect(currentServer(view)).toBe("opp");
  });

  test("ace, errore in battuta e in ricezione assegnano il punto all'altra squadra", () => {
    let d = emptyMatch({ firstServer: "us" });
    d = touch(d, "us", "serve", "a1", "#");
    d = touch(d, "us", "serve", "a1", "=");
    d = touch(d, "opp", "serve", "opp-9", "!");
    d = touch(d, "us", "reception", "a3", "=");
    const view = deriveScout(d);
    expect(view.rallies.map((r) => `${r.how}:${r.winner}`)).toEqual(["ace:us", "serveError:opp", "receptionError:opp"]);
    expect(view.rallies.map((r) => `${r.score.us}-${r.score.opp}`)).toEqual(["1-0", "1-1", "1-2"]);
    expect(view.rallies.map((r) => r.server)).toEqual(["us", "us", "opp"]);
  });

  test("attacco murato e muro vincente: il muro chiude, l'attaccante resta indicato", () => {
    let d = emptyMatch({ firstServer: "us" });
    d = touch(d, "us", "serve", "a1", "!");
    d = touch(d, "opp", "attack", "opp-5", "/");
    // Il muro non è ancora segnato: lo scambio è aperto.
    expect(deriveScout(d).rallies).toHaveLength(0);
    d = touch(d, "us", "block", "a2", "#");
    const rally = deriveScout(d).rallies[0];
    expect(rally).toMatchObject({ actor: "us", how: "block", player: "a2", victim: "opp-5", winner: "us" });
    const stats = statsOf(d);
    expect(stats.players.us.find((p) => p.id === "a2")).toMatchObject({ stuffs: 1, points: 1 });
    expect(stats.players.opp.find((p) => p.id === "opp-5")).toMatchObject({ blocked: 1 });
    expect(stats.players.opp.find((p) => p.id === "opp-5")?.detail.attacks).toBe(1);
  });

  test("lo scambio chiuso a mano si prende i tocchi già segnati; «chi attaccava» si ricava dall'ultimo attacco", () => {
    let d = emptyMatch({ firstServer: "opp" });
    d = touch(d, "opp", "serve", "opp-9", "!");
    d = touch(d, "us", "reception", "a3", "+");
    d = touch(d, "us", "attack", "a1", "/");
    d = outcome(d, "opp", "block", "opp-5"); // «Punto loro: muro» dal pannello dei punti, senza dire chi attaccava
    const view = deriveScout(d);
    const rally = view.rallies[0];
    expect(rally.closedBy).toBe("outcome");
    expect(rally.touches).toHaveLength(3);
    expect(rally.victim).toBe("a1");
    expect(rally.eventIds).toHaveLength(4);
    expect(rally.eventIds[3]).toBe(rally.id);
  });

  test("fine set: i tocchi di uno scambio rimasto a metà non contano e il set si apre pulito", () => {
    let d = emptyMatch({ firstServer: "us" });
    d = outcome(d, "us", "attack", "a1");
    d = touch(d, "us", "serve", "a1", "!");
    expect(deriveScout(d).pending).toHaveLength(1);
    seq += 1;
    d = endSet(d, "opp", T0 + 99_000, `s${seq}`);
    const view = deriveScout(d);
    expect(view.sets).toHaveLength(2);
    expect(view.pending).toHaveLength(0);
    expect(view.current?.rallies).toHaveLength(0);
  });

  test("a partita decisa non si aggiungono più tocchi", () => {
    let d = emptyMatch({ format: "bo3", firstServer: "us" });
    for (let set = 0; set < 2; set++) {
      for (let i = 0; i < 25; i++) d = touch(d, "us", "serve", "a1", "#");
      seq += 1;
      d = endSet(d, "opp", T0 + 99_000 + set, `s${seq}`);
    }
    expect(deriveScout(d).decided).toBe(true);
    expect(touch(d, "us", "serve", "a1", "#")).toBe(d);
  });

  test("la durata del set parte dal primo tocco, non dal primo punto", () => {
    let d = emptyMatch({ firstServer: "us" });
    d = addTouch(d, { side: "us", skill: "serve", player: "a1", grade: "!" }, T0, "t-a");
    d = addTouch(d, { side: "opp", skill: "reception", player: "opp-5", grade: "+" }, T0 + 2_000, "t-b");
    d = addTouch(d, { side: "opp", skill: "attack", player: "opp-5", grade: "=" }, T0 + 60_000 * 5, "t-c");
    const set = deriveScout(d).sets[0];
    expect(set.startedAt).toBe(T0);
    expect(set.endedAt).toBe(T0 + 60_000 * 5);
  });
});

test.describe("operazioni sui tocchi", () => {
  test("un tocco tiene solo giocatrici in rosa della sua squadra e una zona da 1 a 6", () => {
    let d = emptyMatch();
    d = touch(d, "us", "reception", "non-esiste", "+", 2);
    d = touch(d, "us", "reception", "opp-5", "+", 9); // è dell'altra squadra, zona che non esiste
    d = touch(d, "us", "reception", "a1", "+", 0);
    const events = d.events.flatMap((e) => (e.type === "touch" ? [e] : []));
    expect(events.map((e) => e.player)).toEqual([null, null, "a1"]);
    expect(events.map((e) => e.zone)).toEqual([2, null, null]);
    // Fondamentale o voto inventati: nessun effetto.
    const bad = addTouch(d, { side: "us", skill: "volo" as ScoutTouchSkill, player: null, grade: "+" }, T0, "bad");
    expect(bad).toBe(d);
    expect(addTouch(d, { side: "us", skill: "dig", player: null, grade: "?" as ScoutGrade }, T0, "bad2")).toBe(d);
  });

  test("annulla toglie l'ultimo tocco; se aveva chiuso lo scambio, torna indietro anche il punto", () => {
    let d = emptyMatch({ firstServer: "us" });
    d = touch(d, "us", "serve", "a1", "!");
    d = touch(d, "opp", "reception", "opp-5", "-");
    d = touch(d, "opp", "attack", "opp-5", "=");
    expect(deriveScout(d).rallies).toHaveLength(1);
    d = undoLast(d);
    let view = deriveScout(d);
    expect(view.rallies).toHaveLength(0);
    expect(view.pending.map((t) => t.skill)).toEqual(["serve", "reception"]);
    d = undoLast(undoLast(d));
    view = deriveScout(d);
    expect(view.pending).toHaveLength(0);
    expect(d.events).toHaveLength(0);
  });

  test("togliere uno scambio toglie tutti i suoi tocchi, anche l'esito scelto a mano; le altre restano", () => {
    let d = emptyMatch({ firstServer: "us" });
    d = touch(d, "us", "serve", "a1", "#"); // 1-0
    d = touch(d, "us", "serve", "a1", "!");
    d = touch(d, "opp", "reception", "opp-5", "+");
    d = outcome(d, "us", "attack", "a2"); // 2-0 chiuso a mano
    d = touch(d, "us", "serve", "a1", "=");
    expect(deriveScout(d).rallies).toHaveLength(3);
    const second = deriveScout(d).rallies[1];
    const removed = removeRally(d, second.id);
    const view = deriveScout(removed);
    expect(view.rallies).toHaveLength(2);
    expect(view.rallies.map((r) => r.how)).toEqual(["ace", "serveError"]);
    expect(removed.events).toHaveLength(2);
    expect(removeRally(d, "non-esiste")).toBe(d);
  });

  test("correggere un tocco: chi e zona sì; il voto solo tra voti che hanno lo stesso effetto sullo scambio", () => {
    let d = emptyMatch({ firstServer: "us" });
    d = touch(d, "us", "serve", "a1", "!");
    d = touch(d, "opp", "reception", "opp-5", "+");
    d = touch(d, "opp", "attack", "opp-5", "#");
    const [serve, reception, attack] = d.events.map((e) => e.id);

    // Chi ha ricevuto: si cambia, anche mettendo «non so».
    let fixed = updateTouch(d, reception, { player: "opp-9", zone: 3 });
    expect(deriveScout(fixed).rallies[0].touches[1]).toMatchObject({ player: "opp-9", zone: 3 });
    fixed = updateTouch(fixed, reception, { player: null });
    expect(deriveScout(fixed).rallies[0].touches[1].player).toBeNull();
    // Una giocatrice che non c'è diventa «non so».
    expect(deriveScout(updateTouch(d, reception, { player: "fantasma" })).rallies[0].touches[1].player).toBeNull();

    // Il voto della ricezione cambia tra voti che non chiudono lo scambio…
    expect(deriveScout(updateTouch(d, reception, { grade: "#" })).rallies[0].touches[1].grade).toBe("#");
    // …ma non può diventare un errore (chiuderebbe lo scambio lì).
    expect(deriveScout(updateTouch(d, reception, { grade: "=" })).rallies[0].touches[1].grade).toBe("+");
    // L'attacco da punto a errore sì: cambia chi vince, non la struttura.
    const swapped = deriveScout(updateTouch(d, attack, { grade: "=" })).rallies[0];
    expect(swapped).toMatchObject({ how: "attackError", winner: "us" });
    // L'attacco a terra non può diventare «continua».
    expect(deriveScout(updateTouch(d, attack, { grade: "+" })).rallies[0].how).toBe("attack");
    expect(updateTouch(d, serve, { player: "a2" }).events[0]).toMatchObject({ player: "a2" });
  });

  test("togliere un tocco in sospeso; un tocco che chiude lo scambio si toglie annullando o togliendo lo scambio", () => {
    let d = emptyMatch({ firstServer: "us" });
    d = touch(d, "us", "serve", "a1", "!");
    d = touch(d, "opp", "reception", "opp-5", "+");
    const first = d.events[0].id;
    expect(deriveScout(removeTouch(d, first)).pending.map((t) => t.skill)).toEqual(["reception"]);
    expect(removeTouch(d, "non-esiste")).toBe(d);
  });

  test("aggiungere a posteriori la ricezione a uno scambio chiuso a mano", () => {
    let d = emptyMatch({ level: "ricezioni", firstServer: "opp" });
    d = outcome(d, "us", "attack", "a1");
    const closing = d.events[0].id;
    const input: TouchInput = { side: "us", skill: "reception", player: "a3", grade: "+", zone: 6 };
    seq += 1;
    d = insertTouch(d, closing, input, T0 + 1, `i${seq}`);
    const rally = deriveScout(d).rallies[0];
    expect(rally.closedBy).toBe("outcome");
    expect(rally.touches).toHaveLength(1);
    expect(rally.touches[0]).toMatchObject({ skill: "reception", player: "a3", grade: "+", zone: 6 });
    expect(d.events.map((e) => e.type)).toEqual(["touch", "rally"]);
    // Prima di un evento che non c'è: nessun effetto.
    expect(insertTouch(d, "non-esiste", input, T0, "z")).toBe(d);
  });

  test("chi compare in un tocco non si può togliere dalla rosa", () => {
    let d = emptyMatch();
    d = touch(d, "us", "reception", "a3", "+");
    d = touch(d, "opp", "attack", "opp-5", "+");
    expect([...usedPlayerIds(d)].sort()).toEqual(["a3", "opp-5"]);
    expect(removePlayer(d, "us", "a3")).toBe(d);
    expect(removePlayer(d, "opp", "opp-5")).toBe(d);
    expect(removePlayer(d, "us", "a2").roster.us.map((p) => p.id)).toEqual(["a1", "a3"]);
  });

  test("il reducer conosce le nuove operazioni", () => {
    let d = emptyMatch({ firstServer: "us" });
    d = scoutReducer(d, { type: "touch", input: { side: "us", skill: "serve", player: "a1", grade: "!" }, at: T0, id: "k1" });
    d = scoutReducer(d, { type: "touch", input: { side: "opp", skill: "reception", player: "opp-5", grade: "+" }, at: T0 + 1, id: "k2" });
    d = scoutReducer(d, { type: "updateTouch", id: "k2", patch: { zone: 4 } });
    d = scoutReducer(d, { type: "insertTouch", before: "k2", input: { side: "us", skill: "set", player: null, grade: "!" }, at: T0 + 1, id: "k3" });
    expect(d.events.map((e) => e.id)).toEqual(["k1", "k3", "k2"]);
    d = scoutReducer(d, { type: "removeTouch", id: "k3" });
    expect(d.events.map((e) => e.id)).toEqual(["k1", "k2"]);
    d = scoutReducer(d, { type: "touch", input: { side: "opp", skill: "attack", player: "opp-5", grade: "#" }, at: T0 + 2, id: "k4" });
    d = scoutReducer(d, { type: "removeRally", id: "k4" });
    expect(d.events).toHaveLength(0);
    d = scoutReducer(d, { type: "settings", patch: { level: "ricezioni" } });
    expect(d.settings.level).toBe("ricezioni");
  });
});

test.describe("i tocchi nel tabellino", () => {
  test("sei scambi: punteggio, battuta e conti di ogni giocatrice tornano", () => {
    const d = sixRallies();
    const view = deriveScout(d);
    expect(view.rallies.map((r) => `${r.score.us}-${r.score.opp}`)).toEqual(["1-0", "2-0", "2-1", "3-1", "3-2", "3-3"]);
    expect(view.rallies.map((r) => r.server)).toEqual(["us", "us", "us", "opp", "us", "opp"]);
    expect(view.pending).toHaveLength(0);

    const stats = statsOf(d);
    const us = (id: string) => stats.players.us.find((p) => p.id === id)!;
    const opp = (id: string) => stats.players.opp.find((p) => p.id === id)!;

    // Anna: 3 battute (un ace, un errore), 2 attacchi (un punto, un errore), una ricezione scarsa.
    expect(us("a1")).toMatchObject({ aces: 1, serveErrors: 1, kills: 1, attackErrors: 1, points: 2 });
    expect(us("a1").detail).toMatchObject({ serves: 3, attacks: 2, receptions: 1 });
    expect(us("a1").detail.reception["/"]).toBe(1);
    // Bea: il muro che ha chiuso il primo scambio, e una battuta.
    expect(us("a2")).toMatchObject({ stuffs: 1, points: 1 });
    expect(us("a2").detail.serves).toBe(1);
    // Carla (libero): una ricezione perfetta e una difesa.
    expect(us("a3").detail).toMatchObject({ receptions: 1, digs: 1, digErrors: 0 });
    expect(us("a3").detail.reception["#"]).toBe(1);
    expect(us("a3").points).toBe(0);
    expect(hasActivity(us("a3"))).toBe(true);
    // L'avversaria: n.5 ha ricevuto 2 volte, attaccato 3 (uno murato, uno a terra), n.9 ha battuto due volte.
    expect(opp("opp-5")).toMatchObject({ kills: 1, blocked: 1, points: 1 });
    expect(opp("opp-5").detail).toMatchObject({ attacks: 3, receptions: 2 });
    expect(opp("opp-9").detail.serves).toBe(2);
    expect(stats.players.us.find((p) => p.id === "?")).toBeUndefined();
  });

  test("ricezione: voti, zone e cambio palla in base a come si è ricevuto", () => {
    const stats = statsOf(sixRallies());
    const a = stats.analysis.us;
    expect(a.receptions).toBe(2);
    expect(a.reception).toEqual({ "#": 1, "+": 0, "!": 0, "-": 0, "/": 1, "=": 0 });
    // Dopo la ricezione perfetta abbiamo vinto lo scambio; dopo quella scarsa no.
    expect(a.sideOutByGrade["#"]).toEqual({ total: 1, won: 1 });
    expect(a.sideOutByGrade["/"]).toEqual({ total: 1, won: 0 });
    expect(a.sideOutByGrade["+"]).toEqual({ total: 0, won: 0 });
    // Zone: la perfetta in 5 è buona, la scarsa in 1 è persa.
    expect(a.zones.reception[5]).toEqual({ total: 1, good: 1, lost: 0 });
    expect(a.zones.reception[1]).toEqual({ total: 1, good: 0, lost: 1 });
    expect(a.zones.reception[3]).toEqual({ total: 0, good: 0, lost: 0 });
    expect(a.zones.dig[6]).toEqual({ total: 1, good: 1, lost: 0 });
    expect(a.zones.attack[4]).toEqual({ total: 1, good: 1, lost: 0 });
    expect(zonedTouches(a.zones.reception)).toBe(2);
    // Anche l'avversaria: ha ricevuto due volte, una positiva e una negativa.
    expect(stats.analysis.opp.reception).toMatchObject({ "+": 1, "-": 1 });
    expect(stats.analysis.opp.sideOutByGrade["+"]).toEqual({ total: 1, won: 0 });
    expect(stats.analysis.opp.sideOutByGrade["-"]).toEqual({ total: 1, won: 1 });
  });

  test("rotazioni: si ruota quando si recupera la battuta e ogni set riparte dalla prima", () => {
    const stats = statsOf(sixRallies());
    const us = stats.analysis.us.rotations;
    expect(us[0]).toMatchObject({ rotation: 1, served: 3, breakPoints: 2, received: 1, sideOuts: 1 });
    expect(us[1]).toMatchObject({ rotation: 2, served: 1, breakPoints: 0, received: 1, sideOuts: 0 });
    expect(us.slice(2).every((r) => r.served + r.received === 0)).toBe(true);
    const opp = stats.analysis.opp.rotations;
    expect(opp[0]).toMatchObject({ served: 0, received: 3, sideOuts: 1 });
    expect(opp[1]).toMatchObject({ served: 1, breakPoints: 0, received: 1, sideOuts: 1 });
    expect(opp[2]).toMatchObject({ served: 1, breakPoints: 1, received: 0 });
    // Tutte le battute e tutte le ricezioni delle rotazioni sommano agli scambi giocati.
    const served = us.reduce((n, r) => n + r.served, 0) + opp.reduce((n, r) => n + r.served, 0);
    expect(served).toBe(6);

    // Un secondo set riparte dalla rotazione 1.
    let d = sixRallies();
    // Si porta il set a 25 con punti a mano (attacchi nostri) e si chiude.
    while ((deriveScout(d).current?.score.us ?? 0) < 25) d = outcome(d, "us", "attack", "a1");
    seq += 1;
    d = endSet(d, "us", T0 + 500_000, `s${seq}`);
    d = touch(d, "us", "serve", "a1", "=");
    const second = statsOf(d, { set: 2 });
    expect(second.analysis.us.rotations[0]).toMatchObject({ served: 1, breakPoints: 0 });
    expect(second.analysis.us.rotations.slice(1).every((r) => r.served === 0)).toBe(true);
  });

  test("chi segna i tocchi e chi chiude gli scambi a mano si somma: la ricezione resta, il punto arriva dall'esito", () => {
    let d = emptyMatch({ level: "ricezioni", firstServer: "opp" });
    // 1: ricezione negativa segnata, poi punto loro dal pannello dei punti (attacco di n.5).
    d = touch(d, "us", "reception", "a1", "-", 2);
    d = outcome(d, "opp", "attack", "opp-5");
    // 2: ricezione sbagliata di Carla: chiude da sola.
    d = touch(d, "us", "reception", "a3", "=");
    // 3: ricezione positiva di Anna, poi punto nostro dal pannello (attacco di Bea).
    d = touch(d, "us", "reception", "a1", "+", 2);
    d = outcome(d, "us", "attack", "a2");
    const view = deriveScout(d);
    expect(view.rallies).toHaveLength(3);
    expect(view.rallies.map((r) => r.closedBy)).toEqual(["outcome", "touch", "outcome"]);
    expect(view.rallies[1]).toMatchObject({ how: "receptionError", winner: "opp" });
    expect(view.rallies.map((r) => r.server)).toEqual(["opp", "opp", "opp"]);

    const stats = statsOf(d);
    const a1 = stats.players.us.find((p) => p.id === "a1")!;
    expect(a1.detail.receptions).toBe(2);
    expect(a1.detail.reception["-"]).toBe(1);
    expect(a1.detail.reception["+"]).toBe(1);
    const a2 = stats.players.us.find((p) => p.id === "a2")!;
    expect(a2).toMatchObject({ kills: 1, points: 1 });
    expect(a2.detail.attacks).toBe(1);
    const a3 = stats.players.us.find((p) => p.id === "a3")!;
    expect(a3).toMatchObject({ receptionErrors: 1 });
    expect(a3.detail.reception["="]).toBe(1);
    expect(stats.analysis.us.receptions).toBe(3);
    expect(stats.analysis.us.sideOutByGrade["-"]).toEqual({ total: 1, won: 0 });
    expect(stats.analysis.us.sideOutByGrade["="]).toEqual({ total: 1, won: 0 });
    expect(stats.analysis.us.sideOutByGrade["+"]).toEqual({ total: 1, won: 1 });
    expect(stats.us.sideOuts).toBe(1);
    expect(stats.analysis.us.zones.reception[2]).toEqual({ total: 2, good: 1, lost: 0 });
  });

  test("senza tocchi segnati (livello Base) i numeri di prima non cambiano e le mappe sono vuote", () => {
    let d = newScoutData({ us: [ANNA], opp: [] }, { firstServer: "us" });
    d = outcome(d, "us", "attack", "a1");
    d = outcome(d, "opp", "ace");
    d = outcome(d, "us", "block", "a1", null);
    const stats = statsOf(d);
    expect(stats.analysis.us.receptions).toBe(0);
    expect(zonedTouches(stats.analysis.us.zones.reception)).toBe(0);
    const anna = stats.players.us.find((p) => p.id === "a1")!;
    expect(anna).toMatchObject({ kills: 1, stuffs: 1, points: 2 });
    // Il muro senza dire chi attaccava segna l'attacco murato su «Non assegnato» dell'altra squadra.
    expect(stats.players.opp.find((p) => p.id === "?")).toMatchObject({ blocked: 1 });
    expect(hasTouches(d)).toBe(false);
    expect(effectiveLevel(d)).toBe("base");
  });

  test("il livello con cui leggere uno scout tiene conto dei tocchi già segnati", () => {
    let d = emptyMatch({ level: "base" });
    expect(effectiveLevel(d)).toBe("base");
    d = touch(d, "us", "reception", "a1", "+");
    expect(effectiveLevel(d)).toBe("ricezioni");
    d = touch(d, "opp", "attack", "opp-5", "+");
    expect(effectiveLevel(d)).toBe("completo");
    // Il livello scelto vale comunque se è più alto.
    expect(effectiveLevel(emptyMatch({ level: "completo" }))).toBe("completo");
    expect(effectiveLevel({ settings: { ...DEFAULT_SETTINGS, level: "ricezioni" }, events: [] })).toBe("ricezioni");
  });

  test("i tocchi di uno scambio chiuso a mano: ogni esito ha il suo tocco, i falli no", () => {
    const base = { id: "r", at: T0, victim: null, touches: [] as ScoutTouch[], closedBy: "outcome" as const };
    const effective = (how: Parameters<typeof outcome>[2], actor: ScoutSide = "us") => effectiveTouches({ ...base, actor, how, player: "a1" });
    expect(effective("ace").map((t) => `${t.skill}${t.grade}`)).toEqual(["serve#"]);
    expect(effective("serveError").map((t) => `${t.skill}${t.grade}`)).toEqual(["serve="]);
    expect(effective("receptionError").map((t) => `${t.skill}${t.grade}`)).toEqual(["reception="]);
    expect(effective("attack").map((t) => `${t.skill}${t.grade}`)).toEqual(["attack#"]);
    expect(effective("attackError").map((t) => `${t.skill}${t.grade}`)).toEqual(["attack="]);
    expect(effective("blockError").map((t) => `${t.skill}${t.grade}`)).toEqual(["block="]);
    expect(effective("setError").map((t) => `${t.skill}${t.grade}`)).toEqual(["set="]);
    expect(effective("digError").map((t) => `${t.skill}${t.grade}`)).toEqual(["dig="]);
    // Il muro vincente porta con sé l'attacco murato dell'altra squadra.
    const stuff = effectiveTouches({ ...base, actor: "us", how: "block", player: "a2", victim: "opp-5" });
    expect(stuff.map((t) => `${t.side}:${t.skill}${t.grade}:${t.player}`)).toEqual(["opp:attack/:opp-5", "us:block#:a2"]);
    for (const how of ["netFault", "centerLine", "doubleContact", "heldBall", "fourHits", "rotationFault", "sanction"] as const) {
      expect(effective(how)).toEqual([]);
    }
    // Un attacco già segnato prima del muro diventa «murato» senza raddoppiare.
    const withAttack = effectiveTouches({
      ...base,
      actor: "us",
      how: "block",
      player: "a2",
      victim: "opp-5",
      touches: [asTouch("opp", "attack", "opp-5", "+")],
    });
    expect(withAttack.map((t) => `${t.skill}${t.grade}`)).toEqual(["attack/", "block#"]);
  });
});

test.describe("stagione e salvataggio con i livelli", () => {
  test("la stagione somma il dettaglio solo delle partite con i tocchi", () => {
    // Una partita a livello Base, una con i tocchi.
    let basic = newScoutData({ us: [ANNA, BEA], opp: [] }, { level: "base", firstServer: "us" });
    basic = outcome(basic, "us", "attack", "a1");
    basic = outcome(basic, "us", "attack", "a1");
    const detailed = sixRallies();

    const season = aggregateSeason([basic, detailed]);
    expect(season.matches).toBe(2);
    expect(season.detailMatches).toBe(1);
    expect(season.level).toBe("completo");
    const anna = season.players.find((p) => p.id === "a1")!;
    // I punti sommano tutte e due le partite; il dettaglio solo quella con i tocchi (3 battute, 2 attacchi).
    expect(anna.kills).toBe(3);
    expect(anna.detail.attacks).toBe(2);
    expect(anna.detail.serves).toBe(3);
    expect(season.analysis.us.receptions).toBe(2);
    expect(season.analysis.us.rotations[0].served).toBe(3);

    const onlyBasic = aggregateSeason([basic]);
    expect(onlyBasic.detailMatches).toBe(0);
    expect(onlyBasic.level).toBe("base");
    expect(onlyBasic.analysis.us.receptions).toBe(0);
  });

  test("il salvataggio accetta tocchi e livello; uno scout vecchio senza livello vale «base»", () => {
    const d = sixRallies();
    const parsed = scoutDataSchema.safeParse(d);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(d);

    const old = JSON.parse(JSON.stringify(d)) as { settings: Record<string, unknown> };
    delete old.settings.level;
    delete old.settings.publicLive;
    const reparsed = scoutDataSchema.safeParse(old);
    expect(reparsed.success).toBe(true);
    if (reparsed.success) expect(reparsed.data.settings).toMatchObject({ level: "base", publicLive: false });

    const bad = (patch: Record<string, unknown>) => {
      const copy = JSON.parse(JSON.stringify(d)) as { events: Record<string, unknown>[] };
      Object.assign(copy.events[0], patch);
      return scoutDataSchema.safeParse(copy).success;
    };
    expect(bad({ zone: 7 })).toBe(false);
    expect(bad({ zone: 0 })).toBe(false);
    expect(bad({ grade: "?" })).toBe(false);
    expect(bad({ skill: "volo" })).toBe(false);
    expect(bad({ side: "noi" })).toBe(false);
    expect(bad({ zone: 3 })).toBe(true);
    const wrongLevel = JSON.parse(JSON.stringify(d)) as { settings: Record<string, unknown> };
    wrongLevel.settings.level = "super";
    expect(scoutDataSchema.safeParse(wrongLevel).success).toBe(false);
  });

  test("la copia di una partita intera (5 set da molti tocchi) sta nei limiti", () => {
    // Una partita al meglio dei 5 con scambi lunghi: ben sotto il massimo.
    expect(MAX_SCOUT_EVENTS).toBeGreaterThanOrEqual(3000);
    let d = emptyMatch({ firstServer: "us" });
    for (let i = 0; i < 400; i++) {
      d = touch(d, "us", "serve", "a1", "!");
      d = touch(d, "opp", "reception", "opp-5", "+");
      d = touch(d, "opp", "attack", "opp-5", "+");
      d = touch(d, "us", "dig", "a3", "+");
      d = touch(d, "us", "attack", "a1", "#");
      if (deriveScout(d).decided) break;
      // Dopo ogni set vinto si chiude (25 punti per set).
      const view = deriveScout(d);
      if (view.current && view.current.score.us >= 25) {
        seq += 1;
        d = endSet(d, "us", T0 + d.events.length * 1000, `s${seq}`);
      }
    }
    expect(d.events.length).toBeGreaterThan(300);
    expect(d.events.length).toBeLessThan(MAX_SCOUT_EVENTS);
    expect(scoutDataSchema.safeParse(d).success).toBe(true);
  });

  test("scoutContent completa le impostazioni mancanti", () => {
    const legacy = {
      settings: { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" },
      roster: { us: [], opp: [] },
      events: [],
      finished: false,
    } as unknown as ScoutData;
    expect(scoutContent(legacy).settings).toMatchObject({ publicLive: false, level: "base" });
    expect(scoutContent({ ...legacy, settings: { ...legacy.settings, level: "completo" } }).settings.level).toBe("completo");
  });

  test("le statistiche ricevono lo stesso set di tocchi sia da computeStats sia da statsOf", () => {
    const d = sixRallies();
    expect(computeStats(deriveScout(d), d.roster)).toEqual(statsOf(d));
  });
});
