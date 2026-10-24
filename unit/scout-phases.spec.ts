import { expect, test } from "@playwright/test";
import { addRally, addTouch, endSet, newScoutData } from "@/lib/scout/actions";
import { deriveScout } from "@/lib/scout/derive";
import { ballOf } from "@/lib/scout/phases";
import type { ScoutData, ScoutGrade, ScoutSide, ScoutTouchSkill } from "@/lib/scout/types";

/** Da che parte del campo è la palla: la fascia «Palla nostra / Palla loro» e il tabellone. */

test.describe("la palla, da che parte del campo", () => {
  let n = 0;
  const id = () => `b${++n}`;
  const base = (firstServer: ScoutSide = "us"): ScoutData => newScoutData({ us: [], opp: [] }, { firstServer });
  const play = (data: ScoutData, side: ScoutSide, skill: ScoutTouchSkill, grade: ScoutGrade): ScoutData =>
    addTouch(data, { side, skill, player: null, grade, zone: null }, n * 1000, id());

  test("a ogni livello, a inizio scambio la palla è dalla parte di chi batte", () => {
    for (const level of ["base", "ricezioni"] as const) {
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

  test("in uno scout del vecchio livello Completo i tocchi in sospeso non spostano la palla", () => {
    // Battuta in campo e ricezione loro, segnate tocco per tocco: si legge come «Con ricezioni», la palla resta a chi batte.
    let data = base("us");
    data = play(data, "us", "serve", "!");
    data = play(data, "opp", "reception", "+");
    expect(ballOf(deriveScout(data), "ricezioni")).toEqual({ side: "us", phase: "Battuta", from: null });
  });

  test("tra un set e l'altro la palla è di chi batte per primo nel set nuovo", () => {
    let data = base("us");
    data = addRally(data, { actor: "us", how: "attack", player: null, victim: null }, 1000, id());
    data = endSet(data, "opp", 2000, id());
    expect(ballOf(deriveScout(data), "base")).toEqual({ side: "opp", phase: "Battuta", from: null });
  });
});
