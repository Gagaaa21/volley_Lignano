import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { addPlayer, addRally, addTimeout, endSet, newScoutData, opponentPlayer, updateSettings } from "@/lib/scout/actions";
import { deriveScout } from "@/lib/scout/derive";
import { toPublicScoutScore } from "@/lib/scout/publicScore";
import { publishPublicScore, readPublicScoutSnapshot } from "@/lib/scout/publicSnapshot";
import { setRecapCounts } from "@/lib/scout/stats";
import type { ScoutData, ScoutHow, ScoutSide } from "@/lib/scout/types";

/** Il resoconto di fine set: numeri di squadra del set (attacco, muri, ace, errori dell'avversaria, serie, time-out) e durata. */

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);
const MATCH = { team: "u14u15" as const, category: "U15" as const, opponent: "Pol. Esempio" };

function base(): ScoutData {
  let data = newScoutData({ us: [], opp: [] });
  data = addPlayer(data, "us", { id: "a1", name: "Giulia Bianchi", number: "4", libero: false });
  data = addPlayer(data, "opp", opponentPlayer("7"));
  return updateSettings(data, { publicLive: true });
}

let seq = 0;
/** Un punto: `actor` fa l'azione `how` (se è un errore il punto va all'altra squadra). `at` in secondi dall'inizio. */
function rally(data: ScoutData, actor: ScoutSide, how: ScoutHow, seconds: number): ScoutData {
  return addRally(data, { actor, how, player: actor === "us" ? "a1" : null, victim: null }, T0 + seconds * 1000, `r${++seq}`);
}

const live = (data: ScoutData) => toPublicScoutScore({ ...data, updatedAt: "2026-10-17T09:30:00.000Z" }, MATCH);

/** Un set da 25-20: i nostri punti in attacco, muro, ace e da errori loro, in mezzo ai loro. */
function firstSet(): ScoutData {
  let data = base();
  let t = 0;
  const step = (actor: ScoutSide, how: ScoutHow) => {
    data = rally(data, actor, how, (t += 30));
  };
  // Serie nostra di 3 (attacco, attacco, muro), loro 4 di fila (attacco, attacco, ace, attacco), poi nostri.
  step("us", "attack");
  step("us", "attack");
  step("us", "block");
  step("opp", "attack");
  step("opp", "attack");
  step("opp", "ace");
  step("opp", "attack");
  // Errori loro: battuta e ricezione = punti nostri. Errore nostro (attacco fuori) = punto loro.
  step("opp", "serveError");
  step("opp", "receptionError");
  step("us", "attackError");
  // Fino a 25-20: 18 punti nostri in attacco e 5 loro in attacco (tolti quelli già fatti).
  while (deriveScout(data).current!.score.us < 25) step("us", "ace");
  return data;
}

test.describe("numeri del set", () => {
  test("punti sul campo e punti da errori, per squadra, sommano al punteggio del set", () => {
    const data = firstSet();
    const view = deriveScout(data);
    const set = view.sets[0];
    const counts = setRecapCounts(set);
    // Noi: attacco 2, muro 1, errori loro 2 (battuta, ricezione), ace = il resto fino a 25.
    expect(counts.us.attack).toBe(2);
    expect(counts.us.block).toBe(1);
    expect(counts.us.gifts).toBe(2);
    expect(counts.us.attack + counts.us.block + counts.us.ace + counts.us.gifts).toBe(set.score.us);
    // Loro: attacco 3 e un ace; un solo punto è un nostro errore.
    expect(counts.opp).toMatchObject({ attack: 3, block: 0, ace: 1, gifts: 1 });
    expect(counts.opp.attack + counts.opp.block + counts.opp.ace + counts.opp.gifts).toBe(set.score.opp);
  });

  test("la serie più lunga di punti di fila, per squadra", () => {
    const counts = setRecapCounts(deriveScout(firstSet()).sets[0]);
    // Loro: 4 di fila (attacco, attacco, ace, attacco). Noi: la lunga serie finale (ace fino a 25).
    expect(counts.opp.run).toBe(4);
    expect(counts.us.run).toBeGreaterThanOrEqual(3);
    const tail = deriveScout(firstSet()).sets[0].rallies;
    let streak = 0;
    let best = 0;
    for (const r of tail) {
      streak = r.winner === "us" ? streak + 1 : 0;
      best = Math.max(best, streak);
    }
    expect(counts.us.run).toBe(best);
  });

  test("i time-out usati nel set, per squadra", () => {
    let data = firstSet();
    data = addTimeout(data, "us", T0 + 5000, "to1");
    data = addTimeout(data, "opp", T0 + 6000, "to2");
    data = addTimeout(data, "opp", T0 + 7000, "to3");
    const counts = setRecapCounts(deriveScout(data).sets[0]);
    expect(counts.us.timeouts).toBe(1);
    expect(counts.opp.timeouts).toBe(2);
  });
});

test.describe("resoconto nel punteggio pubblico", () => {
  test("non c'è finché non si chiude un set: il payload di prima resta identico", () => {
    expect(live(firstSet())).not.toHaveProperty("recap");
  });

  test("dopo il set chiuso c'è il resoconto di quel set, durata compresa, e tiene fino al set dopo", () => {
    let data = endSet(firstSet(), "opp", T0 + 3_000_000, "end1");
    const closed = live(data);
    expect(closed?.recap).toMatchObject({ n: 1, home: { attack: 2, block: 1, gifts: 2 }, away: { attack: 3, ace: 1, gifts: 1 } });
    // 24 scambi a 30 secondi uno dall'altro dal primo punto al 25°: stima per difetto, in minuti.
    expect(closed?.recap?.minutes).toBeGreaterThanOrEqual(10);
    // Nel secondo set il resoconto è ancora quello del primo, finché non si chiude il secondo.
    data = rally(data, "opp", "attack", 3_100);
    expect(live(data)?.recap?.n).toBe(1);
  });

  test("a ogni set chiuso il resoconto passa al set appena finito", () => {
    let data = endSet(firstSet(), "opp", T0 + 3_000_000, "end1");
    let t = 4_000;
    for (let i = 0; i < 25; i++) data = rally(data, "opp", "attack", (t += 30));
    data = endSet(data, "us", T0 + 9_000_000, "end2");
    const result = live(data);
    expect(result?.recap).toMatchObject({ n: 2, home: { attack: 0, block: 0, ace: 0, gifts: 0 }, away: { attack: 25 } });
    expect(result?.sets).toHaveLength(2);
  });

  test("a partita finita il resoconto è quello dell'ultimo set giocato", () => {
    let data = updateSettings(base(), { format: "bo3" });
    let t = 0;
    for (let set = 1; set <= 2; set++) {
      for (let i = 0; i < 25; i++) data = rally(data, "us", "attack", (t += 30));
      data = endSet(data, "opp", T0 + (t + 1) * 1000, `end${set}`);
    }
    const result = live(data);
    expect(result?.finished).toBe(true);
    expect(result?.recap).toMatchObject({ n: 2, home: { attack: 25 } });
  });

  test("solo totali di squadra: niente nomi, numeri di maglia o altro", () => {
    const result = live(endSet(firstSet(), "opp", T0 + 3_000_000, "end1"));
    expect(Object.keys(result!.recap!).sort()).toEqual(["away", "home", "minutes", "n"]);
    expect(Object.keys(result!.recap!.home).sort()).toEqual(["ace", "attack", "block", "gifts", "run", "timeouts"]);
    const json = JSON.stringify(result);
    for (const secret of ["Giulia", "Bianchi", "a1", "roster", "player"]) expect(json).not.toContain(secret);
  });

  test("la durata manca se il set ha un solo scambio o dura meno di un minuto", () => {
    let data = base();
    data = rally(data, "us", "attack", 0);
    expect(setRecapCounts(deriveScout(data).sets[0]).us.attack).toBe(1);
    let quick = base();
    for (let i = 0; i < 25; i++) quick = rally(quick, "us", "attack", i);
    quick = endSet(quick, "opp", T0 + 60_000, "endq");
    expect(live(quick)?.recap?.minutes).toBeNull();
  });
});

test.describe("copia compatta", () => {
  test("il resoconto viaggia nella copia pubblica e resta piccolo", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const data = endSet(firstSet(), "opp", T0 + 3_000_000, "end1");
    await publishPublicScore(repo, { ...data, matchId: "m1", version: 1, updatedBy: null, updatedAt: "2026-10-17T09:30:00.000Z" }, MATCH);
    const read = await readPublicScoutSnapshot(repo, Date.parse("2026-10-17T09:31:00.000Z"));
    expect(read?.recap).toMatchObject({ n: 1, home: { attack: 2 } });
    expect((await repo.getAppSetting("public_live_scout"))!.length).toBeLessThan(1000);
  });
});
