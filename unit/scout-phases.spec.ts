import { expect, test } from "@playwright/test";
import { addRally, addTouch, endSet, newScoutData } from "@/lib/scout/actions";
import { deriveScout } from "@/lib/scout/derive";
import { ballOf, tracksSetsOf } from "@/lib/scout/phases";
import { describeNext, flowAfter, suggestNext } from "@/lib/scout/touches";
import type { ScoutData, ScoutGrade, ScoutSide, ScoutTouch, ScoutTouchSkill } from "@/lib/scout/types";

/** Le fasi dello scambio: di chi è il turno, perché, e cosa segue di solito. */

function touch(side: ScoutSide, skill: ScoutTouchSkill, grade: ScoutGrade, n = 1): ScoutTouch {
  return { id: `t${n}`, at: n, side, skill, player: null, grade, zone: null };
}

test.describe("fasi dello scambio", () => {
  test("a inizio scambio tocca alla battuta di chi ha la battuta", () => {
    const hint = describeNext([], "opp");
    expect(hint.next).toEqual({ skill: "serve", side: "opp" });
    expect(hint.why).toContain("batte l'avversaria");
    expect(hint.after).toEqual([
      { skill: "reception", side: "us" },
      { skill: "attack", side: "us" },
      { skill: "dig", side: "opp" },
    ]);
  });

  test("le due squadre si alternano: battuta, ricezione, attacco, difesa dall'altra parte", () => {
    expect(flowAfter({ skill: "serve", side: "us" }, false, 4)).toEqual([
      { skill: "reception", side: "opp" },
      { skill: "attack", side: "opp" },
      { skill: "dig", side: "us" },
      { skill: "attack", side: "us" },
    ]);
  });

  test("con l'alzata segnata, dopo ricezione e difesa viene l'alzata", () => {
    expect(flowAfter({ skill: "reception", side: "us" }, true, 3)).toEqual([
      { skill: "set", side: "us" },
      { skill: "attack", side: "us" },
      { skill: "dig", side: "opp" },
    ]);
    expect(suggestNext([touch("opp", "reception", "+")], "us", true)).toEqual({ skill: "set", side: "opp" });
    expect(suggestNext([touch("opp", "set", "+")], "us", true)).toEqual({ skill: "attack", side: "opp" });
    // Senza, l'alzata si salta come prima.
    expect(suggestNext([touch("opp", "reception", "+")], "us")).toEqual({ skill: "attack", side: "opp" });
  });

  test("dopo un tocco con la palla rimandata di là attacca l'altra squadra", () => {
    const hint = describeNext([touch("us", "serve", "!"), touch("opp", "reception", "/", 2)], "us");
    expect(hint.next).toEqual({ skill: "attack", side: "us" });
    expect(hint.why).toContain("ha rimandato la palla di là");
  });

  test("dopo un attacco difeso difende l'altra squadra, dopo un attacco murato si segna il muro", () => {
    const defended = describeNext([touch("us", "attack", "+")], "us");
    expect(defended.next).toEqual({ skill: "dig", side: "opp" });
    expect(defended.why).toContain("difeso");
    const blocked = describeNext([touch("us", "attack", "/")], "us");
    expect(blocked.next).toEqual({ skill: "block", side: "opp" });
    expect(blocked.why).toContain("muro");
  });

  test("dopo un muro con tocco difende chi ha murato", () => {
    const hint = describeNext([touch("us", "attack", "/"), touch("opp", "block", "+", 2)], "us");
    expect(hint.next).toEqual({ skill: "dig", side: "opp" });
    expect(hint.why).toContain("ha murato");
  });

  test("ogni fase ha una spiegazione e non si propone mai una fase sconosciuta", () => {
    const skills: ScoutTouchSkill[] = ["serve", "reception", "set", "attack", "block", "dig"];
    for (const skill of skills) {
      for (const grade of ["+", "!", "/"] as const) {
        const hint = describeNext([touch("us", skill, grade)], "us");
        expect(hint.why.length).toBeGreaterThan(10);
        expect(skills).toContain(hint.next.skill);
        expect(hint.after).toHaveLength(3);
      }
    }
  });
});


/** Da che parte del campo è la palla: sul tabellone e nella fascia «Palla nostra / Palla loro». */
test.describe("la palla, da che parte del campo", () => {
  let n = 0;
  const id = () => `b${++n}`;
  const base = (firstServer: ScoutSide = "us"): ScoutData => newScoutData({ us: [], opp: [] }, { firstServer });
  const play = (data: ScoutData, side: ScoutSide, skill: ScoutTouchSkill, grade: ScoutGrade): ScoutData =>
    addTouch(data, { side, skill, player: null, grade, zone: null }, n * 1000, id());

  test("a ogni livello, a inizio scambio la palla è dalla parte di chi batte", () => {
    for (const level of ["base", "ricezioni", "completo"] as const) {
      expect(ballOf(deriveScout(base("us")), level), level).toEqual({ side: "us", phase: "Battuta", from: null });
      expect(ballOf(deriveScout(base("opp")), level), level).toEqual({ side: "opp", phase: "Battuta", from: null });
    }
  });

  test("dopo un punto la palla passa a chi ha vinto lo scambio (batte lui)", () => {
    const data = addRally(base("us"), { actor: "opp", how: "attack", player: null, victim: null }, 1000, id());
    expect(ballOf(deriveScout(data), "base")).toEqual({ side: "opp", phase: "Battuta", from: null });
    const ours = addRally(data, { actor: "us", how: "attack", player: null, victim: null }, 2000, id());
    expect(ballOf(deriveScout(ours), "base")).toEqual({ side: "us", phase: "Battuta", from: null });
  });

  test("a livello Completo la palla segue i tocchi e passa la rete: battuta, ricezione, attacco, difesa", () => {
    let data = base("us");
    // Battuta in campo: ora la palla è dall'altra parte e la riceve l'avversaria.
    data = play(data, "us", "serve", "!");
    expect(ballOf(deriveScout(data), "completo")).toEqual({ side: "opp", phase: "Ricezione", from: "us" });
    // Ricezione buona: la gioca la stessa squadra, la palla non ha passato la rete.
    data = play(data, "opp", "reception", "+");
    expect(ballOf(deriveScout(data), "completo")).toEqual({ side: "opp", phase: "Attacco", from: null });
    // Attacco difeso: la palla è tornata dalla nostra parte.
    data = play(data, "opp", "attack", "+");
    expect(ballOf(deriveScout(data), "completo")).toEqual({ side: "us", phase: "Difesa", from: "opp" });
    // Difesa mandata di là (/): attacca l'altra squadra.
    data = play(data, "us", "dig", "/");
    expect(ballOf(deriveScout(data), "completo")).toEqual({ side: "opp", phase: "Attacco", from: "us" });
    // Attacco murato: il muro è della squadra che ha murato, dall'altra parte della rete.
    data = play(data, "opp", "attack", "/");
    expect(ballOf(deriveScout(data), "completo")).toEqual({ side: "us", phase: "Muro", from: "opp" });
  });

  test("con l'alzata segnata dopo la ricezione la palla resta dalla stessa parte", () => {
    let data = base("opp");
    data = play(data, "opp", "serve", "!");
    data = play(data, "us", "reception", "+");
    data = play(data, "us", "set", "+");
    expect(tracksSetsOf(deriveScout(data))).toBe(true);
    expect(ballOf(deriveScout(data), "completo")).toEqual({ side: "us", phase: "Attacco", from: null });
  });

  test("a livello Con ricezioni: dalla parte di chi batte, nostra una volta segnata la ricezione", () => {
    // Battono loro: la palla parte da loro.
    let data = base("opp");
    expect(ballOf(deriveScout(data), "ricezioni")).toEqual({ side: "opp", phase: "Battuta", from: null });
    // Segnata la nostra ricezione: la palla è nostra, arrivata da loro.
    data = play(data, "us", "reception", "+");
    expect(ballOf(deriveScout(data), "ricezioni")).toEqual({ side: "us", phase: "In gioco", from: "opp" });
    // Se batte la nostra squadra, non c'è ricezione da segnare: resta la battuta.
    expect(ballOf(deriveScout(base("us")), "ricezioni")).toEqual({ side: "us", phase: "Battuta", from: null });
  });

  test("tra un set e l'altro la palla è di chi batte per primo nel set nuovo", () => {
    let data = base("us");
    data = addRally(data, { actor: "us", how: "attack", player: null, victim: null }, 1000, id());
    data = endSet(data, "opp", 2000, id());
    expect(ballOf(deriveScout(data), "base")).toEqual({ side: "opp", phase: "Battuta", from: null });
  });
});
