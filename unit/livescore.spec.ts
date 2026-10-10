import { expect, test } from "@playwright/test";
import {
  applyPoint,
  closeSet,
  courtRows,
  exitingBackRowIndex,
  halfCourtColumns,
  initialMatch,
  linkCalendarMatch,
  matchWinner,
  rotateOnce,
  toPublicLiveScore,
  withPlayersPerSide,
} from "@/lib/liveScore";
import { liveScoreStateSchema } from "@/lib/liveScoreSchema";
import type { LiveScorePlayers, LiveScoreState } from "@/lib/types";

/** Tabellone live: dal 2 contro 2 al 6 contro 6, con o senza libero, anche
 * senza formazione; e cosa può vedere il sito pubblico della diretta. */

function game(players: LiveScorePlayers, overrides: Partial<LiveScoreState> = {}): LiveScoreState {
  const base = initialMatch({ mode: "match", playersPerSide: players, withLineup: true }, "u14u15");
  const names = (prefix: string) => Array.from({ length: players }, (_, i) => `${prefix}${i + 1}`);
  return {
    ...base,
    started: true,
    servingTeam: "A",
    teamA: { ...base.teamA, positions: names("A") },
    teamB: { ...base.teamB, label: "Pallavolo Città", positions: names("B") },
    ...overrides,
  };
}

test.describe("disposizione in campo", () => {
  test("a rete e in seconda linea, da sinistra a destra, per ogni formato", () => {
    expect(courtRows(6)).toEqual({ front: [4, 3, 2], back: [5, 6, 1] });
    expect(courtRows(5)).toEqual({ front: [4, 3, 2], back: [5, 1] });
    expect(courtRows(4)).toEqual({ front: [3, 2], back: [4, 1] });
    // A 3 a triangolo: una a rete, due dietro.
    expect(courtRows(3)).toEqual({ front: [2], back: [3, 1] });
    expect(courtRows(2)).toEqual({ front: [2], back: [1] });
  });

  test("a 6 il campo resta quello di sempre (le due squadre specchiate)", () => {
    expect(halfCourtColumns(6, "left")).toEqual({ net: [4, 3, 2], baseline: [5, 6, 1] });
    expect(halfCourtColumns(6, "right")).toEqual({ net: [2, 3, 4], baseline: [1, 6, 5] });
  });

  test("ogni posizione compare una volta sola", () => {
    for (const n of [2, 3, 4, 5, 6] as const) {
      const { net, baseline } = halfCourtColumns(n, "left");
      expect([...net, ...baseline].sort()).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });

  test("chi passa dalla seconda linea a rete alla rotazione", () => {
    // A 6 è la posizione 5 (va in 4); a 4 la posizione 4 (va in 3); a 3 la posizione 3
    // (dietro a sinistra, va a rete in 2); a 2 chi batte.
    expect(exitingBackRowIndex(6)).toBe(4);
    expect(exitingBackRowIndex(5)).toBe(4);
    expect(exitingBackRowIndex(4)).toBe(3);
    expect(exitingBackRowIndex(3)).toBe(2);
    expect(exitingBackRowIndex(2)).toBe(0);
  });
});

test.describe("punti e rotazione", () => {
  test("rotazione in senso orario con qualunque numero di giocatrici", () => {
    expect(rotateOnce(["a", "b", "c", "d"])).toEqual(["b", "c", "d", "a"]);
    expect(rotateOnce(["a", "b"])).toEqual(["b", "a"]);
  });

  test("chi conquista la battuta ruota, chi la tiene no (4 contro 4)", () => {
    const start = game(4);
    const kept = applyPoint(start, "A");
    expect(kept.teamA.score).toBe(1);
    expect(kept.teamA.positions).toEqual(start.teamA.positions);

    const sideOut = applyPoint(kept, "B");
    expect(sideOut.servingTeam).toBe("B");
    expect(sideOut.teamB.score).toBe(1);
    expect(sideOut.teamB.positions).toEqual(["B2", "B3", "B4", "B1"]);
    expect(sideOut.teamA.positions).toEqual(start.teamA.positions);
  });

  test("a 3 contro 3 (triangolo): chi è a rete va a battere, chi è dietro a sinistra sale a rete", () => {
    const start = game(3, { servingTeam: "A" });
    const sideOut = applyPoint(start, "B");
    // Prima: 1 B1 dietro a destra, 2 B2 a rete, 3 B3 dietro a sinistra.
    expect(sideOut.teamB.positions).toEqual(["B2", "B3", "B1"]);
  });

  test("senza formazione si contano solo punti e battuta", () => {
    const start = { ...game(6), withLineup: false };
    const next = applyPoint(start, "B");
    expect(next.servingTeam).toBe("B");
    expect(next.teamB.score).toBe(1);
    expect(next.teamB.positions).toEqual(start.teamB.positions);
  });

  test("chiusura del set e vittoria della partita", () => {
    let m = game(3);
    m = { ...m, teamA: { ...m.teamA, score: 25 }, teamB: { ...m.teamB, score: 20 } };
    m = closeSet(m);
    expect(m.setHistory).toEqual([{ scoreA: 25, scoreB: 20 }]);
    expect(m.teamA.setsWon).toBe(1);
    expect(m.servingTeam).toBeNull();
    expect(matchWinner(m)).toBeNull();
    expect(matchWinner({ ...m, teamB: { ...m.teamB, setsWon: 3 } })).toBe("B");
  });
});

test.describe("libero", () => {
  test("a 6: entra quando la centrale perde il punto in battuta, esce quando torna a rete", () => {
    let m = game(6, { useLibero: true });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A1", "A4"] } };
    // A1 (centrale) è in battuta e perde il punto: entra la libero al suo posto.
    m = applyPoint(m, "B");
    expect(m.teamA.liberoActiveFor).toBe("A1");
    // A riconquista la battuta: ruota, A1 passa da 1 a 6 (ancora dietro).
    m = applyPoint(m, "A");
    expect(m.teamA.positions[5]).toBe("A1");
    expect(m.teamA.liberoActiveFor).toBe("A1");
    // Altre due rotazioni: A1 arriva in 4, a rete, e rientra di persona.
    m = applyPoint(applyPoint(m, "B"), "A");
    expect(m.teamA.positions[4]).toBe("A1");
    m = applyPoint(applyPoint(m, "B"), "A");
    expect(m.teamA.positions[3]).toBe("A1");
    expect(m.teamA.liberoActiveFor).toBeNull();
  });

  test("a 4: esce quando la sostituita passa dalla seconda linea a rete", () => {
    let m = game(4, { useLibero: true, servingTeam: "B" });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A4", ""], liberoActiveFor: "A4" } };
    // A conquista la battuta: A4 (dietro a sinistra) va in 3, a rete.
    m = applyPoint(m, "A");
    expect(m.teamA.positions[2]).toBe("A4");
    expect(m.teamA.liberoActiveFor).toBeNull();
  });

  test("senza libero non entra mai, anche se un nome era rimasto scritto", () => {
    let m = game(6, { useLibero: false });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A1", "A4"] } };
    m = applyPoint(m, "B");
    expect(m.teamA.liberoActiveFor).toBeNull();
  });
});

test("cambiare formato adatta le formazioni e scorda le sostituite non più in campo", () => {
  let m = game(6, { started: false });
  m = { ...m, teamA: { ...m.teamA, hostNames: ["A2", "A6"] } };
  const four = withPlayersPerSide(m, 4);
  expect(four.teamA.positions).toEqual(["A1", "A2", "A3", "A4"]);
  expect(four.teamA.hostNames).toEqual(["A2", ""]);
  expect(withPlayersPerSide(four, 6).teamA.positions).toEqual(["A1", "A2", "A3", "A4", "", ""]);
});

test.describe("diretta pubblica", () => {
  test("solo se accesa da un admin, in Partita e a partita iniziata", () => {
    const m = game(6, { publicLive: true });
    expect(toPublicLiveScore(m, "2026-10-10T16:00:00Z")).not.toBeNull();
    expect(toPublicLiveScore({ ...m, publicLive: false }, "x")).toBeNull();
    expect(toPublicLiveScore({ ...m, started: false }, "x")).toBeNull();
    expect(toPublicLiveScore({ ...m, mode: "training" }, "x")).toBeNull();
  });

  test("mostra squadre, punti e set, mai nomi o formazioni", () => {
    let m = game(6, { publicLive: true, useLibero: true, servingTeam: "B" });
    m = {
      ...m,
      teamA: { ...m.teamA, liberoName: "Libera Segreta", hostNames: ["A1", "A4"] },
      setHistory: [{ scoreA: 25, scoreB: 21 }],
    };
    m = applyPoint(m, "A");
    const live = toPublicLiveScore(m, "2026-10-10T16:00:00Z")!;
    expect(live.home).toMatchObject({ name: "Volley Lignano", score: 1 });
    expect(live.away).toMatchObject({ name: "Pallavolo Città", score: 0 });
    expect(live.serving).toBe("home");
    expect(live.sets).toEqual([{ home: 25, away: 21 }]);
    const json = JSON.stringify(live);
    for (const secret of ["A1", "A2", "B3", "Libera Segreta"]) expect(json).not.toContain(secret);
  });

  test("a partita finita lo segnala", () => {
    const m = game(6, { publicLive: true });
    const done = { ...m, teamA: { ...m.teamA, setsWon: 3 } };
    expect(toPublicLiveScore(done, "x")!.finished).toBe(true);
  });

  test("collegare la partita di oggi scrive l'avversaria e la categoria (non per i tornei)", () => {
    const m = game(6);
    const linked = linkCalendarMatch(m, { id: "m1", category: "U15", opponent: "Degano", isTournament: false });
    expect(linked).toMatchObject({ matchId: "m1", category: "U15" });
    expect(linked.teamB.label).toBe("Degano");
    const tournament = linkCalendarMatch(m, { id: "t1", category: "U14", opponent: "Torneo", isTournament: true });
    expect(tournament.teamB.label).toBe("Pallavolo Città");
    expect(linkCalendarMatch(linked, null)).toMatchObject({ matchId: null, category: null });
  });
});

test.describe("salvataggi", () => {
  test("una partita salvata con la versione precedente si ricarica come 6 contro 6", () => {
    const old = {
      started: true,
      mode: "training",
      servingTeam: "A",
      sidesSwapped: false,
      teamA: {
        label: "Squadra A",
        positions: ["a", "b", "c", "d", "e", "f"],
        liberoName: "L",
        hostNames: ["a", "d"],
        liberoActiveFor: null,
        score: 3,
        setsWon: 0,
        timeoutsUsed: 0,
      },
      teamB: {
        label: "Squadra B",
        positions: ["", "", "", "", "", ""],
        liberoName: "",
        hostNames: ["", ""],
        liberoActiveFor: null,
        score: 1,
        setsWon: 0,
        timeoutsUsed: 1,
      },
      setHistory: [],
      opponentColor: "#475569",
    };
    const parsed = liveScoreStateSchema.parse(old);
    expect(parsed).toMatchObject({ playersPerSide: 6, withLineup: true, useLibero: true, publicLive: false });
  });

  test("una formazione che non corrisponde al numero di giocatrici viene rifiutata", () => {
    const m = game(4);
    expect(liveScoreStateSchema.safeParse(m).success).toBe(true);
    expect(liveScoreStateSchema.safeParse({ ...m, playersPerSide: 6 }).success).toBe(false);
  });
});
