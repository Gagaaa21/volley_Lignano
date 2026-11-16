import { expect, test } from "@playwright/test";
import { addPlayer, addRally, addTouch, endSet, newScoutData, opponentPlayer, setLineup, substitute, type LineupInput } from "@/lib/scout/actions";
import { deriveScout } from "@/lib/scout/derive";
import { buildSheet, partialsOf, partialThresholds, perPoint, seasonOf, serverOf } from "@/lib/scout/sheet";
import type { ScoutData, ScoutHow, ScoutLevel, ScoutSide } from "@/lib/scout/types";

/**
 * Il tabellino in stile ufficiale (come quelli delle leghe): segni dei set, battute per giocatrice, punti vinti set per set,
 * parziali, rotazioni, ricezioni e battute per punto, primo attacco dopo la ricezione e contrattacco. Si ricava tutto dagli
 * scambi segnati, anche per uno scout salvato prima che esistesse.
 */

const T0 = Date.UTC(2026, 9, 17, 16, 0, 0);
const MIN = 60_000;
let seq = 0;
const id = () => `e${++seq}`;
const at = (data: ScoutData) => T0 + data.events.length * MIN;

function roster(settings: Partial<ScoutData["settings"]> = {}): ScoutData {
  let data = newScoutData({ us: [], opp: [] }, { firstServer: "us", ...settings });
  for (let i = 1; i <= 8; i++) data = addPlayer(data, "us", { id: `u${i}`, name: `Atleta ${i}`, number: String(i), libero: false });
  data = addPlayer(data, "us", { id: "ul", name: "Libera", number: "20", libero: true });
  for (let n = 1; n <= 7; n++) data = addPlayer(data, "opp", opponentPlayer(String(n)));
  return data;
}

const OURS: LineupInput = { positions: ["u1", "u2", "u3", "u4", "u5", "u6"], libero: "ul", hosts: ["u3", "u6"] };
const THEIRS: LineupInput = { positions: ["opp-1", "opp-2", "opp-3", "opp-4", "opp-5", "opp-6"], libero: null, hosts: [null, null] };

function point(data: ScoutData, actor: ScoutSide, how: ScoutHow = "attack", player: string | null = null): ScoutData {
  return addRally(data, { actor, how, player, victim: null }, at(data), id());
}

/** Un set fino a 25-x con punti di attacco senza giocatrice. */
function playSet(data: ScoutData, us: number, opp: number): ScoutData {
  let d = data;
  let a = 0;
  let b = 0;
  while (a < us || b < opp) {
    if (a < us && (b >= opp || a <= b)) {
      d = point(d, "us");
      a += 1;
    } else {
      d = point(d, "opp");
      b += 1;
    }
  }
  return d;
}

test.describe("parziali e chi batte", () => {
  test("i parziali sono il punteggio quando una delle due arriva a 8, 16 e 21 (a 8 nel set corto)", () => {
    expect(partialThresholds(25)).toEqual([8, 16, 21]);
    expect(partialThresholds(15)).toEqual([8]);
    const view = deriveScout(playSet(roster(), 25, 15));
    const set = view.sets[0];
    const partials = partialsOf(set, 25);
    expect(partials).toHaveLength(3);
    for (const [i, threshold] of [8, 16, 21].entries()) expect(Math.max(partials[i].us, partials[i].opp)).toBe(threshold);
    // Un set non finito ha solo i parziali già raggiunti.
    expect(partialsOf(deriveScout(playSet(roster(), 10, 6)).sets[0], 25)).toHaveLength(1);
    expect(partialsOf(deriveScout(playSet(roster(), 5, 3)).sets[0], 25)).toHaveLength(0);
  });

  test("chi ha battuto: la battuta segnata, poi chi ha fatto l'ace o sbagliato la battuta, poi chi era in posizione 1", () => {
    // Con la formazione: la posizione 1 di chi batte.
    let data = setLineup(setLineup(roster(), "us", OURS, T0, id()), "opp", THEIRS, T0, id());
    data = point(data, "opp");
    let view = deriveScout(data);
    expect(serverOf(view.rallies[0])).toBe("u1");
    // L'ace con la giocatrice cambiata vale lei, non la posizione 1.
    data = point(data, "opp", "ace", "opp-4");
    view = deriveScout(data);
    expect(serverOf(view.rallies[1])).toBe("opp-4");
    // Senza formazione né battuta segnata non si sa.
    expect(serverOf(deriveScout(point(roster(), "us")).rallies[0])).toBeUndefined();
    // La battuta segnata (negli scout del vecchio livello Completo) vince su tutto, anche se non dice chi.
    const touched = addTouch(roster(), { side: "us", skill: "serve", player: null, grade: "#" }, T0, id());
    expect(serverOf(deriveScout(touched).rallies[0])).toBeNull();
  });
});

test.describe("le righe delle giocatrici", () => {
  test("livello Base senza formazione: tutta la rosa, i set dove ha fatto qualcosa, e quello che non si segna resta vuoto", () => {
    let data = roster();
    data = point(data, "us", "attack", "u2");
    data = point(data, "us", "ace", "u1");
    data = point(data, "opp", "attack");
    data = point(data, "us", "serveError", "u3");
    const sheet = buildSheet(data);
    expect(sheet.level).toBe("base");
    expect(sheet.us.lines.map((line) => line.id)).toEqual(["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "ul"]);
    const u2 = sheet.us.lines.find((line) => line.id === "u2")!;
    expect(u2.points).toBe(1);
    expect(u2.sets).toEqual(["in"]);
    expect(sheet.us.lines.find((line) => line.id === "u7")!.sets).toEqual([null]);
    // Né battute per giocatrice (non si sa chi batteva), né ricezioni.
    expect(sheet.us.tracksServes).toBe(false);
    expect(u2.serves).toBeNull();
    expect(u2.receptions).toBeNull();
    // Il totale delle battute della squadra si sa sempre.
    expect(sheet.us.total.serves).toBe(sheet.us.serves);
    expect(sheet.us.total.serves).toBeGreaterThan(0);
    expect(sheet.us.sideOutByReception).toBeNull();
  });

  test("con la formazione: la posizione di partenza in ogni set, la libero e chi entra; le battute di ognuna", () => {
    let data = setLineup(setLineup(roster(), "us", OURS, T0, id()), "opp", THEIRS, T0, id());
    data = point(data, "us"); // batte u1, punto
    data = point(data, "us"); // ancora u1
    data = point(data, "opp"); // u1 sbaglia lo scambio: batte loro
    data = point(data, "us"); // cambio palla: ruotiamo, batte u2
    data = substitute(data, "us", 4, "u7", at(data), id());
    data = playSet(data, 22, 0); // fino a 25-1
    const sheet = buildSheet(data);
    const line = (key: string) => sheet.us.lines.find((l) => l.id === key)!;
    expect(line("u1").sets).toEqual([1]);
    expect(line("u4").sets).toEqual([4]);
    expect(line("u7").sets).toEqual(["in"]);
    expect(line("ul").sets).toEqual(["in"]);
    expect(line("u8").sets).toEqual([null]);
    expect(sheet.opp.lines.find((l) => l.id === "opp-3")!.sets).toEqual([3]);
    expect(sheet.us.tracksServes).toBe(true);
    expect(line("u1").serves).toBe(3);
    // La somma delle battute delle giocatrici è il totale della squadra.
    const sum = sheet.us.lines.reduce((total, l) => total + (l.serves ?? 0), 0);
    expect(sum).toBe(sheet.us.total.serves);
    expect(sheet.us.firstServes).toEqual([1]);
    expect(sheet.opp.firstServes).toEqual([]);
  });
});

test.describe("set per set, rotazioni, ricezioni e battute", () => {
  test("i punti vinti di ogni set (ace, attacco, muro, errori dell'avversaria) fanno il punteggio del set", () => {
    let data = roster();
    data = point(data, "us", "ace", "u1");
    data = point(data, "us", "block", "u3");
    data = point(data, "opp", "attackError", "opp-2");
    data = playSet(data, 22, 20);
    data = endSet(data, "opp", at(data), id());
    data = playSet(data, 25, 18);
    data = endSet(data, "us", at(data), id());
    const sheet = buildSheet(data);
    expect(sheet.sets.map((set) => set.n)).toEqual([1, 2]);
    for (const [index, set] of sheet.sets.entries()) {
      const won = sheet.us.perSet[index].won;
      expect(won.ace + won.attack + won.block + won.gifts).toBe(set.final.us);
      const theirs = sheet.opp.perSet[index].won;
      expect(theirs.ace + theirs.attack + theirs.block + theirs.gifts).toBe(set.final.opp);
    }
    expect(sheet.us.perSet[0].won).toMatchObject({ ace: 1, block: 1, gifts: 1 });
    expect(sheet.totalPoints).toEqual({ us: sheet.sets[0].final.us + sheet.sets[1].final.us, opp: sheet.sets[0].final.opp + sheet.sets[1].final.opp });
    expect(sheet.setsWon).toEqual({ us: 2, opp: 0 });
    // Le battute dei set sommano quelle della partita.
    expect((sheet.us.perSet[0].serves ?? 0) + (sheet.us.perSet[1].serves ?? 0)).toBe(sheet.us.serves);
  });

  test("le rotazioni: punti fatti e persi in ognuna, che sommano il punteggio della partita", () => {
    const sheet = buildSheet(playSet(roster(), 25, 21));
    expect(sheet.us.rotations).toHaveLength(6);
    expect(sheet.us.rotations.reduce((n, r) => n + r.won, 0)).toBe(25);
    expect(sheet.us.rotations.reduce((n, r) => n + r.lost, 0)).toBe(21);
  });

  test("ricezioni, Punti CP e Punti BP come Data Volley: solo i punti fatti, senza gli errori dell'avversaria", () => {
    let data = roster({ firstServer: "opp" });
    data = point(data, "opp", "serveError", "opp-1"); // punto nostro: errore loro in battuta
    data = point(data, "opp", "attack"); // battiamo noi, punto loro
    data = point(data, "us", "attack", "u2"); // battono loro, cambio palla nostro con un attacco: Punto CP
    data = point(data, "us", "ace", "u1"); // battiamo noi: Punto BP
    data = point(data, "opp", "attackError"); // battiamo ancora noi, punto da errore loro: non è un Punto BP
    data = point(data, "opp", "attack"); // battiamo noi, punto loro
    data = point(data, "opp", "attackError"); // battono loro, cambio palla da errore loro: non è un Punto CP
    const sheet = buildSheet(data);
    // Loro hanno battuto 3 volte, una sbagliata: due ricezioni nostre.
    expect(sheet.us.receptionsFaced).toBe(2);
    expect(sheet.us.sideOutPoints).toBe(1);
    expect(sheet.us.serves).toBe(4);
    expect(sheet.us.breakPoints).toBe(1);
    // È il Tot dei punti meno il BP, come nel tabellino di Data Volley (58 − 30 = 28 punti CP).
    expect(sheet.us.sideOutPoints).toBe(sheet.us.total.points - sheet.us.total.bp);
    expect(perPoint(46, 28)).toBe("1,64");
    expect(perPoint(5, 0)).toBeNull();
  });

  test("con le ricezioni: il cambio palla dopo una ricezione positiva o negativa, solo per noi", () => {
    let data = roster({ level: "ricezioni", firstServer: "opp" });
    data = addTouch(data, { side: "us", skill: "reception", player: "u2", grade: "+" }, at(data), id());
    data = point(data, "us", "attack", "u4");
    data = point(data, "opp", "attack");
    data = addTouch(data, { side: "us", skill: "reception", player: "u2", grade: "-" }, at(data), id());
    data = point(data, "opp", "attack");
    const sheet = buildSheet(data);
    expect(sheet.us.tracksReceptions).toBe(true);
    expect(sheet.opp.tracksReceptions).toBe(false);
    expect(sheet.us.sideOutByReception).toEqual({ positive: { total: 1, won: 1 }, negative: { total: 1, won: 0 } });
    const u2 = sheet.us.lines.find((l) => l.id === "u2")!;
    expect(u2.receptions).toBe(2);
    expect(u2.positivePct).toBe(50);
    expect(u2.perfectPct).toBe(0);
  });

  test("uno scout del vecchio livello Completo si legge come «Con ricezioni», con tutti i suoi punti", () => {
    let data = roster({ level: "completo" as unknown as ScoutLevel, firstServer: "opp" });
    const touch = (side: ScoutSide, skill: "serve" | "reception" | "attack" | "dig" | "block", player: string | null, grade: "#" | "+" | "!" | "-" | "/" | "=") => {
      data = addTouch(data, { side, skill, player, grade }, at(data), id());
    };
    // 1) Battono loro, ricezione positiva, attacco a punto.
    touch("opp", "serve", "opp-1", "+");
    touch("us", "reception", "u2", "+");
    touch("us", "attack", "u4", "#");
    // 2) Battiamo noi, loro ricevono male e attaccano, noi difendiamo e sbagliamo il contrattacco.
    touch("us", "serve", "u1", "+");
    touch("opp", "reception", "opp-5", "-");
    touch("opp", "attack", "opp-4", "!");
    touch("us", "dig", "u5", "+");
    touch("us", "attack", "u3", "=");
    // 3) Battono loro, ricezione negativa, il nostro attacco è murato.
    touch("opp", "serve", "opp-1", "+");
    touch("us", "reception", "u6", "-");
    touch("us", "attack", "u2", "!");
    touch("opp", "block", "opp-3", "#");
    const sheet = buildSheet(data);
    expect(sheet.level).toBe("ricezioni");
    expect(sheet.setsWon).toEqual({ us: 0, opp: 0 });
    expect(sheet.sets[0].final).toEqual({ us: 1, opp: 2 });
    const line = (key: string) => sheet.us.lines.find((l) => l.id === key)!;
    // I punti arrivano dai tocchi che chiudono lo scambio.
    expect(line("u4").kills).toBe(1);
    expect(line("u3").attackErrors).toBe(1);
    expect(line("u2").blocked).toBe(1);
    expect(sheet.opp.lines.find((l) => l.id === "opp-3")!.blocks).toBe(1);
    // Le nostre ricezioni ci sono; quelle dell'avversaria, come a «Con ricezioni», no.
    expect(line("u2").receptions).toBe(1);
    expect(line("u2").positivePct).toBe(100);
    expect(line("u6").receptions).toBe(1);
    expect(sheet.us.tracksReceptions).toBe(true);
    expect(sheet.opp.tracksReceptions).toBe(false);
    expect(sheet.opp.lines.find((l) => l.id === "opp-5")!.receptions).toBeNull();
    expect(sheet.us.sideOutByReception).toEqual({ positive: { total: 1, won: 1 }, negative: { total: 1, won: 0 } });
    expect(sheet.opp.sideOutByReception).toBeNull();
    // Le battute segnate dicono chi batteva.
    expect(sheet.us.tracksServes).toBe(true);
    expect(line("u1").serves).toBe(1);
  });
});

test.describe("durata, stagione e partite vecchie", () => {
  test("la durata della partita è la somma dei set; la stagione comincia ad agosto", () => {
    const sheet = buildSheet(playSet(roster(), 25, 10));
    expect(sheet.sets[0].minutes).toBe(34);
    expect(sheet.totalMinutes).toBe(34);
    expect(seasonOf("2026-10-17T18:00")).toBe("2026/2027");
    expect(seasonOf("2027-03-02T18:00")).toBe("2026/2027");
    expect(seasonOf("2026-08-30T18:00")).toBe("2026/2027");
    expect(seasonOf("2026-07-30T18:00")).toBe("2025/2026");
  });

  test("uno scout salvato prima dei livelli e del punteggio live si legge come Base", () => {
    let data = roster();
    data = point(data, "us", "attack", "u2");
    const old = { ...data, settings: { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" } } as unknown as ScoutData;
    const sheet = buildSheet(old);
    expect(sheet.level).toBe("base");
    expect(sheet.us.lines.find((l) => l.id === "u2")!.points).toBe(1);
  });

  test("senza nessun punto: niente set, totali a zero", () => {
    const sheet = buildSheet(roster());
    expect(sheet.sets).toEqual([]);
    expect(sheet.totalMinutes).toBeNull();
    expect(sheet.us.total.points).toBe(0);
  });
});

test.describe("come si contano errori e ace (V-P)", () => {
  test("la ricezione sbagliata è anche un ace di chi batte: stesso conto in tutti e due i modi di segnarla", () => {
    // Con la formazione: batte loro n. 1, la nostra libero riceve male (scambio chiuso dalla ricezione «=»).
    let data = setLineup(setLineup(roster({ firstServer: "opp", level: "ricezioni" }), "us", OURS, T0, id()), "opp", THEIRS, T0, id());
    data = addTouch(data, { side: "us", skill: "reception", player: "ul", grade: "=" }, at(data), id());
    // Poi battiamo noi (la n. 2 dopo la rotazione) e la loro ricezione sbagliata è segnata come esito.
    data = point(data, "us", "attack", "u4");
    data = point(data, "opp", "receptionError");
    const sheet = buildSheet(data);
    const libero = sheet.us.lines.find((line) => line.id === "ul")!;
    expect(libero).toMatchObject({ receptionErrors: 1, balance: -1, points: 0 });
    // Il loro punto è un ace della n. 1 (in battuta), non un regalo.
    expect(sheet.opp.won).toMatchObject({ ace: 1, gifts: 0 });
    expect(sheet.opp.lines.find((line) => line.id === "opp-1")).toMatchObject({ aces: 1, bp: 1, points: 1 });
    // Il nostro: ace di chi batteva (la n. 2 dopo la rotazione), break point compreso.
    expect(sheet.us.won).toMatchObject({ ace: 1, attack: 1, gifts: 0 });
    expect(sheet.us.lines.find((line) => line.id === "u2")).toMatchObject({ aces: 1, bp: 1, points: 1 });
  });

  test("l'errore generale dà il punto all'avversaria ma non pesa sul V-P di nessuna (né su «Non assegnato»)", () => {
    let data = roster();
    data = point(data, "us", "attack", "u2");
    data = point(data, "us", "generalError");
    data = point(data, "opp", "generalError");
    const view = deriveScout(data);
    expect(view.rallies.map((rally) => rally.winner)).toEqual(["us", "opp", "us"]);
    const sheet = buildSheet(data, view);
    expect(sheet.us.lines.some((line) => line.id === "?")).toBe(false);
    expect(sheet.opp.lines.some((line) => line.id === "?")).toBe(false);
    expect(sheet.us.total).toMatchObject({ points: 1, balance: 1 });
    // Per la squadra che riceve il punto è un errore dell'avversaria.
    expect(sheet.opp.won).toMatchObject({ gifts: 1 });
    expect(sheet.us.won).toMatchObject({ attack: 1, gifts: 1 });
  });

  test("il V-P come in Data Volley: punti − battute, ricezioni e attacchi sbagliati − murati (alzata, difesa e falli no)", () => {
    let data = roster();
    data = point(data, "us", "attack", "u1");
    data = point(data, "us", "serveError", "u1");
    data = point(data, "us", "digError", "u1");
    data = point(data, "us", "setError", "u1");
    data = point(data, "us", "netFault", "u1");
    data = point(data, "us", "receptionError", "u1");
    data = addRally(data, { actor: "opp", how: "block", player: null, victim: "u1" }, at(data), id());
    const u1 = buildSheet(data).us.lines.find((line) => line.id === "u1")!;
    expect(u1).toMatchObject({ points: 1, serveErrors: 1, receptionErrors: 1, attackErrors: 0, blocked: 1 });
    // Si rifà a mano con le colonne del tabellino: difesa, alzata e rete sbagliate non entrano.
    expect(u1.balance).toBe(u1.points - u1.serveErrors - u1.receptionErrors - u1.attackErrors - u1.blocked);
    expect(u1.balance).toBe(-2);
  });
});

test.describe("confronto con un tabellino vero di Data Volley 4 (Serie A1 femminile 2026/27, 1ª giornata)", () => {
  /**
   * Il 2° set (25-19) di una partita vera di Serie A1, scambio per scambio come lo pubblica il sito della Lega Volley Femminile
   * (una riga doppia tolta e un punto mancante rimesso), giocatrici solo con il numero di maglia. Noi siamo la squadra che
   * vince il set. I numeri attesi sono quelli del tabellino ufficiale stampato da Data Volley 4 per lo stesso set.
   * Codici: a attacco, b muro, se battuta sbagliata, ae attacco sbagliato, re ricezione sbagliata; «?» = maglia non indicata.
   */
  const SET2 =
    "U a 14|U a 14|U se 10|U a 14|O b 23|U a 7|O a 23|O a 19|U a 7|U ae 11|U a 14|O a 19|U a 14|O a 5|U a 10|O a 19|O a 5|U a 12|" +
    "U b 7|U a 7|U b 7|U b 12|O a ?|U b 14|O a 11|O se 6|O re 19|U b 10|O a 9|O a 9|U a 14|O a 3|U a 10|U se 11|O a 5|O ae 5|" +
    "U a 12|U se 10|U ae 12|U a 7|O a 5|U a 7|O re 6|O ae 18";
  const HOW: Record<string, ScoutHow> = { a: "attack", b: "block", se: "serveError", ae: "attackError", re: "receptionError" };

  function realSet(): ScoutData {
    // Nel 2° set ha battuto per prima l'avversaria (il set cerchiato nel tabellino DV).
    let data = newScoutData({ us: [], opp: [] }, { firstServer: "opp" });
    for (const n of ["7", "10", "11", "12", "14", "20"]) data = addPlayer(data, "us", { id: `t${n}`, name: `Maglia ${n}`, number: n, libero: false });
    for (const n of ["3", "5", "6", "9", "11", "18", "19", "23"]) data = addPlayer(data, "opp", opponentPlayer(n));
    for (const rally of SET2.split("|")) {
      const [team, code, number] = rally.split(" ");
      const actor: ScoutSide = team === "U" ? "us" : "opp";
      const player = number === "?" ? null : actor === "us" ? `t${number}` : `opp-${number}`;
      data = point(data, actor, HOW[code], player);
    }
    return data;
  }

  test("punti vinti, battute, ricezioni ed errori del set sono quelli del tabellino DV4", () => {
    const sheet = buildSheet(realSet());
    expect(sheet.sets[0].final).toEqual({ us: 25, opp: 19 });
    // «Punti vinti» del set: Bat 2, Att 15, Mu 5, Er.Av 3 (i due ace sono le due ricezioni sbagliate dell'avversaria).
    expect(sheet.us.perSet[0].won).toEqual({ ace: 2, attack: 15, block: 5, gifts: 3 });
    expect(sheet.opp.perSet[0].won).toEqual({ ace: 0, attack: 13, block: 1, gifts: 5 });
    // Battuta Tot / Err / Pt: 24 3 2 per noi, 20 1 . per loro.
    expect(sheet.us.perSet[0]).toMatchObject({ serves: 24, serveErrors: 3, aces: 2 });
    expect(sheet.opp.perSet[0]).toMatchObject({ serves: 20, serveErrors: 1, aces: 0 });
    // Ricezione Tot: le battute dell'altra squadra meno quelle sbagliate (19 nostre, 21 loro), e i loro 2 errori in ricezione.
    expect(sheet.us.receptionsFaced).toBe(19);
    expect(sheet.opp.receptionsFaced).toBe(21);
    expect(sheet.opp.perSet[0].receptionErrors).toBe(2);
    // Il V-P si rifà con le colonne, e i Punti CP sono il Tot meno il BP.
    for (const team of [sheet.us, sheet.opp]) {
      for (const line of team.lines) {
        expect(line.balance).toBe(line.points - line.serveErrors - line.receptionErrors - line.attackErrors - line.blocked);
      }
      expect(team.sideOutPoints).toBe(team.total.points - team.total.bp);
    }
  });
});
