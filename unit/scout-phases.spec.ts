import { expect, test } from "@playwright/test";
import { describeNext, flowAfter, suggestNext } from "@/lib/scout/touches";
import type { ScoutGrade, ScoutSide, ScoutTouch, ScoutTouchSkill } from "@/lib/scout/types";

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
