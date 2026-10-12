import { expect, test } from "@playwright/test";
import {
  applyPoint,
  changeSides,
  chooseFirstServer,
  closeSet,
  currentSetTarget,
  frontPositions,
  halfCourtGrid,
  hasLiberoOption,
  initialMatch,
  linkCalendarMatch,
  matchPointFor,
  matchWinner,
  needsFirstServer,
  reconcileLibero,
  rotateOnce,
  setPointFor,
  sideChangeNeeded,
  startMatch,
  substitutePlayer,
  substitutionProblem,
  substitutionWarning,
  suggestedSetEnd,
  toPublicLiveScore,
  withMode,
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
    setFirstServer: "A",
    teamA: { ...base.teamA, positions: names("A"), startPositions: names("A") },
    teamB: { ...base.teamB, label: "Pallavolo Città", positions: names("B"), startPositions: names("B") },
    ...overrides,
  };
}

/** Cella per posizione: [colonna, riga, righe occupate]. */
function grid(players: LiveScorePlayers, side: "left" | "right") {
  const { columns, rows, cells } = halfCourtGrid(players, side);
  return {
    columns,
    rows,
    at: Object.fromEntries(cells.map((c) => [c.position, [c.column, c.row, c.rowSpan]])),
  };
}

test.describe("disposizione in campo", () => {
  test("a 6 il campo resta quello di sempre (le due squadre specchiate)", () => {
    // Sinistra: fondo (2fr) a sinistra, rete (1fr) a destra; dall'alto 4-3-2 a rete, 5-6-1 dietro.
    expect(grid(6, "left")).toEqual({
      columns: "2fr 1fr",
      rows: 3,
      at: { 4: [2, 1, 1], 3: [2, 2, 1], 2: [2, 3, 1], 5: [1, 1, 1], 6: [1, 2, 1], 1: [1, 3, 1] },
    });
    // Destra: rete a sinistra, dall'alto 2-3-4 a rete e 1-6-5 dietro.
    expect(grid(6, "right")).toEqual({
      columns: "1fr 2fr",
      rows: 3,
      at: { 2: [1, 1, 1], 3: [1, 2, 1], 4: [1, 3, 1], 1: [2, 1, 1], 6: [2, 2, 1], 5: [2, 3, 1] },
    });
  });

  test("a 2 le giocatrici sono affiancate", () => {
    expect(grid(2, "left")).toEqual({ columns: "1fr", rows: 2, at: { 2: [1, 1, 1], 1: [1, 2, 1] } });
  });

  test("a 3 a triangolo: una a rete al centro, due dietro", () => {
    expect(grid(3, "left")).toEqual({ columns: "2fr 1fr", rows: 2, at: { 2: [2, 1, 2], 3: [1, 1, 1], 1: [1, 2, 1] } });
  });

  test("a 4 a rombo: una a rete, due ai lati, una in fondo", () => {
    expect(grid(4, "left")).toEqual({
      columns: "1fr 1fr 1fr",
      rows: 2,
      at: { 3: [3, 1, 2], 4: [2, 1, 1], 2: [2, 2, 1], 1: [1, 1, 2] },
    });
    // Specchiato a destra: la 4 (sinistra di chi guarda la rete) va in basso.
    expect(grid(4, "right").at).toEqual({ 3: [1, 1, 2], 4: [2, 2, 1], 2: [2, 1, 1], 1: [3, 1, 2] });
  });

  test("ogni posizione compare una volta sola e nessuna si sovrappone", () => {
    for (const n of [2, 3, 4, 5, 6] as const) {
      for (const side of ["left", "right"] as const) {
        const { rows, cells } = halfCourtGrid(n, side);
        expect(cells.map((c) => c.position).sort()).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        const taken = new Set<string>();
        for (const c of cells) {
          for (let r = c.row; r < c.row + c.rowSpan; r++) {
            expect(r).toBeLessThanOrEqual(rows);
            const key = `${c.column}:${r}`;
            expect(taken.has(key), `${n} ${side} ${key}`).toBe(false);
            taken.add(key);
          }
        }
      }
    }
  });

  test("posizioni a rete e libero per formato", () => {
    expect(frontPositions(6)).toEqual([4, 3, 2]);
    expect(frontPositions(4)).toEqual([3]);
    expect(frontPositions(3)).toEqual([2]);
    expect(hasLiberoOption(2)).toBe(false);
    expect(hasLiberoOption(3)).toBe(true);
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

  test("a 2 contro 2 le due giocatrici si alternano in battuta", () => {
    const start = game(2, { servingTeam: "A" });
    const sideOut = applyPoint(start, "B");
    expect(sideOut.teamB.positions).toEqual(["B2", "B1"]);
    expect(applyPoint(applyPoint(sideOut, "A"), "B").teamB.positions).toEqual(["B1", "B2"]);
  });

  test("senza formazione si contano solo i punti, senza seguire chi batte", () => {
    const start = { ...game(6), withLineup: false, servingTeam: null };
    const next = applyPoint(applyPoint(start, "B"), "B");
    expect(next.servingTeam).toBeNull();
    expect(next.teamB.score).toBe(2);
    expect(next.teamB.positions).toEqual(start.teamB.positions);
  });

  test("chiusura del set e vittoria della partita", () => {
    let m = game(3);
    m = { ...m, teamA: { ...m.teamA, score: 25 }, teamB: { ...m.teamB, score: 20 } };
    m = closeSet(m);
    expect(m.setHistory).toEqual([{ scoreA: 25, scoreB: 20 }]);
    expect(m.teamA.setsWon).toBe(1);
    // Il set dopo comincia con l'altra squadra in battuta.
    expect(m.servingTeam).toBe("B");
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

  test("a 4 (rombo): esce quando la sostituita arriva a rete, in posizione 3", () => {
    let m = game(4, { useLibero: true, servingTeam: "B" });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A4", ""], liberoActiveFor: "A4" } };
    // A conquista la battuta: A4 (a sinistra) va in 3, a rete.
    m = applyPoint(m, "A");
    expect(m.teamA.positions[2]).toBe("A4");
    expect(m.teamA.liberoActiveFor).toBeNull();
  });

  test("nel 2 contro 2 la libero non c'è", () => {
    let m = game(2, { useLibero: true });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A1", "A2"] } };
    expect(applyPoint(m, "B").teamA.liberoActiveFor).toBeNull();
  });

  test("senza libero non entra mai, anche se un nome era rimasto scritto", () => {
    let m = game(6, { useLibero: false });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A1", "A4"] } };
    m = applyPoint(m, "B");
    expect(m.teamA.liberoActiveFor).toBeNull();
  });
});

test.describe("sostituzioni", () => {
  test("chi entra prende il posto di chi esce e il cambio si conta nel set", () => {
    const m = substitutePlayer(game(6), "A", 3, "A9");
    expect(m.teamA.positions).toEqual(["A1", "A2", "A9", "A4", "A5", "A6"]);
    expect(m.teamA.substitutionsUsed).toBe(1);
    expect(m.substitutions).toEqual([{ team: "A", set: 1, position: 3, out: "A3", in: "A9" }]);
    // Le rotazioni portano con sé chi è entrato.
    expect(applyPoint({ ...m, servingTeam: "B" }, "A").teamA.positions[1]).toBe("A9");
  });

  test("i cambi del set si azzerano alla chiusura, l'elenco resta con il numero del set", () => {
    let m = substitutePlayer(game(6), "B", 1, "B8");
    m = { ...m, teamA: { ...m.teamA, score: 25 }, teamB: { ...m.teamB, score: 20 } };
    m = closeSet(m);
    expect(m.teamB.substitutionsUsed).toBe(0);
    m = substitutePlayer(m, "B", 2, "B9");
    expect(m.substitutions.map((s) => s.set)).toEqual([1, 2]);
  });

  test("chi entra eredita il ruolo della sostituita dalla libero (anche se la libero è dentro per lei)", () => {
    // A riceve: la libero è dentro al posto di A1, in posizione 1.
    let m = game(6, { useLibero: true, servingTeam: "B", setFirstServer: "B" });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A1", "A4"], liberoActiveFor: "A1" } };
    m = substitutePlayer(m, "A", 1, "A7");
    expect(m.teamA.hostNames).toEqual(["A7", "A4"]);
    expect(m.teamA.liberoActiveFor).toBe("A7");
  });

  test("se la sostituta della centrale va in battuta, batte lei: la libero non c'è", () => {
    let m = game(6, { useLibero: true });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A1", "A4"] } };
    m = substitutePlayer(m, "A", 1, "A7");
    expect(m.teamA.hostNames).toEqual(["A7", "A4"]);
    expect(m.teamA.liberoActiveFor).toBeNull();
  });

  test("cambi non validi: nessuno che entra, già in campo, la libero", () => {
    let m = game(6, { useLibero: true });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L" } };
    expect(substitutionProblem(m, "A", 2, " ")).toBe("Indica chi entra.");
    expect(substitutionProblem(m, "A", 2, "A5")).toContain("già in campo");
    expect(substitutionProblem(m, "A", 2, "L")).toContain("libero");
    expect(substitutePlayer(m, "A", 2, "A5")).toBe(m);
  });

  test("riempire una posizione vuota non conta come cambio", () => {
    const base = game(4);
    const empty = { ...base, teamA: { ...base.teamA, positions: ["A1", "", "A3", "A4"] } };
    const m = substitutePlayer(empty, "A", 2, "A2");
    expect(m.teamA.positions[1]).toBe("A2");
    expect(m.teamA.substitutionsUsed).toBe(0);
    expect(m.substitutions).toEqual([]);
  });

  test("le sostituzioni non arrivano mai al sito pubblico", () => {
    const m = substitutePlayer(game(6, { publicLive: true }), "A", 3, "Riserva Segreta");
    expect(JSON.stringify(toPublicLiveScore(m, "x"))).not.toContain("Riserva Segreta");
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
    expect(parsed).toMatchObject({ playersPerSide: 6, withLineup: true, useLibero: true, publicLive: false, substitutions: [] });
    expect(parsed.teamA.substitutionsUsed).toBe(0);
    // Prima delle regole dei set non c'erano limiti: si chiude a mano come allora.
    expect(parsed.rules).toEqual({ format: "free", setPoints: 25, lastSetPoints: 15 });
    expect(parsed).toMatchObject({ setFirstServer: null, sideChangeDone: false });
    expect(parsed.teamA.startPositions).toEqual([]);
  });

  test("una formazione che non corrisponde al numero di giocatrici viene rifiutata", () => {
    const m = game(4);
    expect(liveScoreStateSchema.safeParse(m).success).toBe(true);
    expect(liveScoreStateSchema.safeParse({ ...m, playersPerSide: 6 }).success).toBe(false);
  });
});

// ── Set, formula e battuta ─────────────────────────────────────────────

/** Punteggio del set in corso. */
function at(a: number, b: number, overrides: Partial<LiveScoreState> = {}, players: LiveScorePlayers = 6): LiveScoreState {
  const m = game(players, overrides);
  return { ...m, teamA: { ...m.teamA, score: a }, teamB: { ...m.teamB, score: b } };
}

/** Chiude il set con un punteggio da set vinto da `winner`. */
function closeWith(m: LiveScoreState, winner: "A" | "B"): LiveScoreState {
  const a = winner === "A" ? 25 : 20;
  const b = winner === "B" ? 25 : 20;
  return closeSet({ ...m, teamA: { ...m.teamA, score: a }, teamB: { ...m.teamB, score: b } });
}

test.describe("fine del set", () => {
  test("si vince a 25 con due punti di scarto; ai vantaggi si va avanti", () => {
    expect(suggestedSetEnd(at(24, 22))).toBeNull();
    expect(suggestedSetEnd(at(25, 23))).toBe("A");
    expect(suggestedSetEnd(at(25, 24))).toBeNull();
    expect(suggestedSetEnd(at(24, 24))).toBeNull();
    expect(suggestedSetEnd(at(26, 24))).toBe("A");
    expect(suggestedSetEnd(at(27, 29))).toBe("B");
    expect(suggestedSetEnd(at(10, 25))).toBe("B");
  });

  test("il set decisivo si gioca a 15", () => {
    const m = at(14, 12, { setHistory: [{ scoreA: 25, scoreB: 20 }, { scoreA: 20, scoreB: 25 }, { scoreA: 25, scoreB: 20 }, { scoreA: 20, scoreB: 25 }] });
    expect(currentSetTarget(m)).toBe(15);
    expect(suggestedSetEnd(m)).toBeNull();
    expect(suggestedSetEnd({ ...m, teamA: { ...m.teamA, score: 15 } })).toBe("A");
    // Il 4° set è ancora a 25.
    expect(currentSetTarget({ ...m, setHistory: m.setHistory.slice(0, 3) })).toBe(25);
  });

  test("la formula libera (allenamento) non suggerisce nulla e non ha un limite", () => {
    const free = at(40, 3, { rules: { format: "free", setPoints: 25, lastSetPoints: 15 } });
    expect(currentSetTarget(free)).toBeNull();
    expect(suggestedSetEnd(free)).toBeNull();
    expect(setPointFor(free)).toBeNull();
    expect(sideChangeNeeded({ ...free, setHistory: [1, 2, 3, 4].map(() => ({ scoreA: 25, scoreB: 0 })) })).toBe(false);
  });

  test("set point e match point", () => {
    expect(setPointFor(at(24, 22))).toBe("A");
    expect(setPointFor(at(22, 24))).toBe("B");
    expect(setPointFor(at(24, 24))).toBeNull();
    expect(setPointFor(at(24, 23))).toBe("A"); // un punto e fa 25-23
    expect(setPointFor(at(24, 24))).toBeNull(); // 25-24 non basta: serve il +2
    expect(setPointFor(at(25, 24))).toBe("A");
    expect(setPointFor(at(20, 10))).toBeNull();
    // Match point: il set da vincere è il 3° di A.
    const m = at(24, 20);
    expect(matchPointFor(m)).toBeNull();
    const twoSets = { ...m, teamA: { ...m.teamA, setsWon: 2, score: 24 }, setHistory: [{ scoreA: 25, scoreB: 20 }, { scoreA: 25, scoreB: 22 }] };
    expect(matchPointFor(twoSets)).toBe("A");
  });

  test("un set finito non ha altri set point e la partita finita non ne ha affatto", () => {
    expect(setPointFor(at(25, 22))).toBeNull();
    const done = at(24, 20, { teamA: { ...at(24, 20).teamA, setsWon: 3, score: 24 } });
    expect(setPointFor(done)).toBeNull();
    expect(suggestedSetEnd(done)).toBeNull();
  });
});

test.describe("partita secondo la formula", () => {
  test("al meglio dei 5: servono 3 set", () => {
    const m = game(6);
    expect(matchWinner({ ...m, teamA: { ...m.teamA, setsWon: 2 } })).toBeNull();
    expect(matchWinner({ ...m, teamA: { ...m.teamA, setsWon: 3 }, setHistory: [1, 2, 3].map(() => ({ scoreA: 25, scoreB: 10 })) })).toBe("A");
  });

  test("al meglio dei 3: bastano 2 set", () => {
    const m = game(6, { rules: { format: "bo3", setPoints: 25, lastSetPoints: 15 } });
    expect(matchWinner({ ...m, teamB: { ...m.teamB, setsWon: 2 }, setHistory: [1, 2].map(() => ({ scoreA: 10, scoreB: 25 })) })).toBe("B");
    expect(matchWinner({ ...m, teamB: { ...m.teamB, setsWon: 1 } })).toBeNull();
  });

  test("tre set obbligatori: si giocano tutti e vince chi ne ha di più", () => {
    const m = game(6, { rules: { format: "fixed3", setPoints: 25, lastSetPoints: 25 } });
    // Dopo due set vinti dalla stessa squadra la partita non è ancora finita.
    const twoNil = { ...m, teamA: { ...m.teamA, setsWon: 2 }, setHistory: [1, 2].map(() => ({ scoreA: 25, scoreB: 10 })) };
    expect(matchWinner(twoNil)).toBeNull();
    const done = { ...twoNil, teamB: { ...twoNil.teamB, setsWon: 1 }, setHistory: [...twoNil.setHistory, { scoreA: 10, scoreB: 25 }] };
    expect(matchWinner(done)).toBe("A");
    // L'ultimo dei tre usa il suo limite, e non c'è un set decisivo con il cambio campo a 8.
    expect(currentSetTarget({ ...twoNil, setHistory: [1, 2].map(() => ({ scoreA: 25, scoreB: 10 })) })).toBe(25);
    expect(sideChangeNeeded({ ...twoNil, teamA: { ...twoNil.teamA, score: 9 } })).toBe(false);
  });

  test("senza formula il vincitore è chi arriva a 3 set, come sempre", () => {
    const m = game(6, { rules: { format: "free", setPoints: 25, lastSetPoints: 15 } });
    expect(matchWinner({ ...m, teamA: { ...m.teamA, setsWon: 3 } })).toBe("A");
    expect(matchWinner({ ...m, teamA: { ...m.teamA, setsWon: 2 } })).toBeNull();
  });
});

test.describe("cambio di set", () => {
  test("le squadre cambiano campo, tornano alla formazione di partenza e la battuta passa all'altra", () => {
    let m = initialMatch({ mode: "match", playersPerSide: 6, withLineup: true, useLibero: false }, "u14u15");
    const names = (p: string) => ["1", "2", "3", "4", "5", "6"].map((n) => `${p}${n}`);
    m = { ...m, teamA: { ...m.teamA, positions: names("A") }, teamB: { ...m.teamB, label: "Città", positions: names("B") } };
    m = startMatch(m, "A");
    expect(m.setFirstServer).toBe("A");
    // Qualche rotazione: B conquista la battuta (ruota), poi A (ruota), poi B ancora.
    m = applyPoint(applyPoint(applyPoint(m, "B"), "A"), "B");
    expect(m.teamB.positions).not.toEqual(names("B"));
    expect(m.teamA.positions).not.toEqual(names("A"));

    const next = closeWith(m, "B");
    expect(next.sidesSwapped).toBe(true);
    expect(next.servingTeam).toBe("B");
    expect(next.setFirstServer).toBe("B");
    expect(next.teamA.positions).toEqual(names("A"));
    expect(next.teamB.positions).toEqual(names("B"));
    expect(next.teamA.score).toBe(0);
    expect(next.teamB.setsWon).toBe(1);
    expect(next.sideChangeDone).toBe(false);
    // Il punto sbagliato di un primo scambio non fa ruotare chi batte già.
    const first = applyPoint(next, "B");
    expect(first.teamB.positions).toEqual(names("B"));
    expect(first.teamB.score).toBe(1);
  });

  test("la battuta si alterna a ogni set e nel set decisivo va sorteggiata", () => {
    let m = game(6);
    m = closeWith(m, "A");
    expect(m.servingTeam).toBe("B");
    m = closeWith(m, "B");
    expect(m.servingTeam).toBe("A");
    m = closeWith(m, "A");
    expect(m.servingTeam).toBe("B");
    m = closeWith(m, "B"); // 2-2: si va al 5°
    expect(m.servingTeam).toBeNull();
    expect(m.setFirstServer).toBeNull();
    expect(needsFirstServer(m)).toBe(true);
    expect(currentSetTarget(m)).toBe(15);
    // Si sceglie chi batte; lo si può correggere finché il set è a 0-0.
    m = chooseFirstServer(m, "B");
    expect(m).toMatchObject({ servingTeam: "B", setFirstServer: "B" });
    expect(needsFirstServer(m)).toBe(false);
    m = chooseFirstServer(m, "A");
    expect(m.servingTeam).toBe("A");
    const played = applyPoint(m, "A");
    expect(chooseFirstServer(played, "B")).toBe(played);
  });

  test("a partita finita non si prepara nessun altro set", () => {
    let m = game(6);
    m = { ...m, teamA: { ...m.teamA, setsWon: 2 }, setHistory: [{ scoreA: 25, scoreB: 20 }, { scoreA: 25, scoreB: 20 }] };
    const done = closeWith(m, "A");
    expect(matchWinner(done)).toBe("A");
    expect(done.servingTeam).toBeNull();
    expect(done.sidesSwapped).toBe(false);
    expect(needsFirstServer(done)).toBe(false);
  });

  test("senza formazione si cambiano i campi ma non si segue la battuta", () => {
    const m = { ...game(6), withLineup: false, servingTeam: null as null, setFirstServer: null as null };
    const next = closeWith(m, "A");
    expect(next.sidesSwapped).toBe(true);
    expect(next.servingTeam).toBeNull();
    expect(needsFirstServer(next)).toBe(false);
  });

  test("nel set decisivo si cambia campo la prima volta che una squadra arriva a 8", () => {
    const deciding = [1, 2, 3, 4].map((i) => (i % 2 ? { scoreA: 25, scoreB: 20 } : { scoreA: 20, scoreB: 25 }));
    let m = at(7, 3, { setHistory: deciding });
    expect(sideChangeNeeded(m)).toBe(false);
    m = { ...m, teamA: { ...m.teamA, score: 8 } };
    expect(sideChangeNeeded(m)).toBe(true);
    const swapped = changeSides(m);
    expect(swapped.sidesSwapped).toBe(true);
    expect(sideChangeNeeded(swapped)).toBe(false);
    // Non negli altri set.
    expect(sideChangeNeeded(at(20, 10))).toBe(false);
    expect(sideChangeNeeded(at(8, 3, { setHistory: deciding.slice(0, 3) }))).toBe(false);
  });
});

test.describe("libero calcolata dalle posizioni", () => {
  test("la centrale in seconda linea ha subito la libero al suo posto, se non batte", () => {
    let m = game(6, { useLibero: true, started: false });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A6", "A3"] } };
    // A6 in posizione 6 (fondo), A3 a rete: la libero entra per A6 già alla partenza.
    expect(startMatch(m, "A").teamA.liberoActiveFor).toBe("A6");
    expect(startMatch(m, "B").teamA.liberoActiveFor).toBe("A6");
  });

  test("in posizione 1 batte la centrale: la libero entra solo se la squadra riceve", () => {
    let m = game(6, { useLibero: true, started: false });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A1", "A4"] } };
    expect(startMatch(m, "A").teamA.liberoActiveFor).toBeNull();
    expect(startMatch(m, "B").teamA.liberoActiveFor).toBe("A1");
  });

  test("correggere una posizione o le centrali riallinea la libero", () => {
    let m = game(6, { useLibero: true });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["", ""] } };
    expect(reconcileLibero(m).teamA.liberoActiveFor).toBeNull();
    m = { ...m, teamA: { ...m.teamA, hostNames: ["A5", ""] } };
    expect(reconcileLibero(m).teamA.liberoActiveFor).toBe("A5");
  });

  test("a set nuovo la libero riparte da dove sono tornate le giocatrici", () => {
    let m = game(6, { useLibero: true });
    m = { ...m, teamA: { ...m.teamA, liberoName: "L", hostNames: ["A1", "A4"] } };
    m = applyPoint(m, "B"); // A riceve: dentro la libero per A1
    expect(m.teamA.liberoActiveFor).toBe("A1");
    const next = closeWith(m, "B");
    // B batte per primo nel set dopo: A riceve, con A1 di nuovo in posizione 1 → libero dentro.
    expect(next.servingTeam).toBe("B");
    expect(next.teamA.positions[0]).toBe("A1");
    expect(next.teamA.liberoActiveFor).toBe("A1");
  });
});

test.describe("scelta del tipo", () => {
  test("Partita è al meglio dei 5, Allenamento libero; una formula scelta a mano resta", () => {
    const training = initialMatch({ mode: "training" }, "u14u15");
    expect(training.rules.format).toBe("free");
    const match = withMode(training, "match");
    expect(match.rules.format).toBe("bo5");
    expect(withMode(match, "training").rules.format).toBe("free");
    const custom = { ...match, rules: { ...match.rules, format: "bo3" as const } };
    expect(withMode(custom, "training").rules.format).toBe("bo3");
    // A partita iniziata il tipo non cambia più.
    expect(withMode({ ...match, started: true }, "training").mode).toBe("match");
  });
});

test.describe("regole dei cambi (avvertimenti)", () => {
  const withScore = (m: LiveScoreState) => ({ ...m, teamA: { ...m.teamA, score: 3 }, teamB: { ...m.teamB, score: 1 } });

  test("una titolare può rientrare solo al suo posto e al posto di chi l'ha sostituita", () => {
    let m = withScore(game(6));
    m = substitutePlayer(m, "A", 3, "R1"); // esce A3, entra R1
    expect(substitutionWarning(m, "A", 3, "A3")).toBeNull(); // rientra al suo posto per R1: regolare
    expect(substitutionWarning(m, "A", 2, "A3")).toContain("solo al suo posto");
  });

  test("una riserva già uscita non può rientrare, e una riserva può uscire solo per la sua titolare", () => {
    let m = withScore(game(6));
    m = substitutePlayer(m, "A", 3, "R1");
    expect(substitutionWarning(m, "A", 3, "R2")).toContain("può essere sostituita solo da lei");
    m = substitutePlayer(m, "A", 3, "A3"); // A3 rientra: R1 è uscita
    expect(substitutionWarning(m, "A", 4, "R1")).toContain("una riserva non può rientrare");
  });

  test("al massimo 6 cambi per set", () => {
    let m = withScore(game(6));
    for (let i = 1; i <= 6; i++) m = substitutePlayer(m, "A", ((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6, `X${i}`);
    expect(m.teamA.substitutionsUsed).toBe(6);
    expect(substitutionWarning(m, "A", 2, "Y1")).toContain("6 cambi");
  });

  test("solo nel 6 contro 6, e non per riempire una posizione vuota", () => {
    const four = game(4);
    expect(substitutionWarning(four, "A", 2, "Z")).toBeNull();
    const base = game(6);
    const empty = { ...base, teamA: { ...base.teamA, positions: ["A1", "", "A3", "A4", "A5", "A6"] } };
    expect(substitutionWarning(empty, "A", 2, "A9")).toBeNull();
  });
});
