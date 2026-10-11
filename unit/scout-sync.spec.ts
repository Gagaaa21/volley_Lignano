import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { addPlayer, addRally, newScoutData, opponentPlayer, endSet } from "@/lib/scout/actions";
import { parseJerseyNumbers, playerLabel, rallyText, shortName, sideLabel, sortPlayers } from "@/lib/scout/describe";
import { deriveScout } from "@/lib/scout/derive";
import { isScoutable, summarizeScout } from "@/lib/scout/match";
import { isScoutTableMissing } from "@/lib/scout/missing";
import { backupKey, canonicalJson, decideStart, parseBackup, sameScout, scoutContent, type LocalBackup } from "@/lib/scout/sync";
import type { MatchScout, ScoutData } from "@/lib/scout/types";
import type { MatchInput } from "@/lib/types";

/** Salvataggio dello scout (versioni, copia nel telefono), testi del registro e archivio in memoria. */

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);

function sample(points = 3): ScoutData {
  let data = newScoutData({ us: [], opp: [] });
  data = addPlayer(data, "us", { id: "a1", name: "Giulia Bianchi", number: "4", libero: false });
  data = addPlayer(data, "opp", opponentPlayer("7"));
  for (let i = 0; i < points; i++) data = addRally(data, { actor: "us", how: "attack", player: "a1" }, T0 + i * 1000, `r${i}`);
  return data;
}

function saved(data: ScoutData, version: number): MatchScout {
  return { ...data, matchId: "m1", version, updatedBy: null, updatedAt: "2026-10-17T09:00:00.000Z" };
}

const backup = (data: ScoutData, baseVersion: number | null, dirty: boolean): LocalBackup => ({ data, baseVersion, dirty, savedAt: T0 });

test.describe("confronto tra versioni", () => {
  test("le chiavi in ordine diverso danno lo stesso contenuto (il database può riordinarle)", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 1, x: 2 }], c: null } })).toBe(canonicalJson({ a: { c: null, d: [1, { x: 2, y: 1 }] }, b: 1 }));
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  test("uno scout salvato (con versione, data e autore) coincide con lo stesso contenuto, e non con uno diverso", () => {
    const data = sample();
    expect(sameScout(saved(data, 3), data)).toBe(true);
    // Il database restituisce le chiavi in un altro ordine.
    const reordered = JSON.parse(JSON.stringify({ finished: data.finished, events: data.events, roster: data.roster, settings: data.settings })) as ScoutData;
    expect(sameScout(reordered, data)).toBe(true);
    expect(sameScout(sample(4), data)).toBe(false);
    expect(sameScout({ ...data, finished: true }, data)).toBe(false);
    expect(Object.keys(scoutContent(saved(data, 1))).sort()).toEqual(["events", "finished", "roster", "settings"]);
  });
});

test.describe("copia nel telefono", () => {
  test("si legge solo ciò che è valido; il resto vale «nessuna copia»", () => {
    expect(backupKey("m1")).toBe("volley-scout-m1");
    expect(parseBackup(null)).toBeNull();
    expect(parseBackup("")).toBeNull();
    expect(parseBackup("non è json")).toBeNull();
    expect(parseBackup("[1,2]")).toBeNull();
    expect(parseBackup(JSON.stringify({ data: { settings: {} }, dirty: true }))).toBeNull();

    const data = sample();
    const parsed = parseBackup(JSON.stringify({ data, baseVersion: 4, dirty: true, savedAt: 123 }));
    expect(parsed).toMatchObject({ baseVersion: 4, dirty: true, savedAt: 123 });
    expect(parsed?.data).toEqual(data);
  });

  test("versione base e stato «da salvare» ripuliti", () => {
    const data = sample();
    expect(parseBackup(JSON.stringify({ data, baseVersion: 0, dirty: true }))?.baseVersion).toBeNull();
    expect(parseBackup(JSON.stringify({ data, baseVersion: 2.5, dirty: true }))?.baseVersion).toBeNull();
    expect(parseBackup(JSON.stringify({ data, baseVersion: "3", dirty: "yes" }))).toMatchObject({ baseVersion: null, dirty: false });
  });
});

test.describe("da quale versione si riparte", () => {
  const server = saved(sample(3), 5);

  test("senza modifiche in sospeso conta il server (o si parte da zero)", () => {
    expect(decideStart(null, null)).toBe("new");
    expect(decideStart(server, null)).toBe("server");
    expect(decideStart(server, backup(sample(6), 5, false))).toBe("server");
    expect(decideStart(null, backup(sample(6), 5, false))).toBe("new");
  });

  test("con modifiche in sospeso si riparte dalla copia se il server non è cambiato", () => {
    expect(decideStart(server, backup(sample(6), 5, true))).toBe("local");
    expect(decideStart(null, backup(sample(6), 5, true))).toBe("local");
    expect(decideStart(null, backup(sample(6), null, true))).toBe("local");
  });

  test("se il server è cambiato nel frattempo si chiede; se è già uguale non c'è nulla da scegliere", () => {
    expect(decideStart(server, backup(sample(6), 4, true))).toBe("conflict");
    expect(decideStart(server, backup(sample(6), null, true))).toBe("conflict");
    expect(decideStart(server, backup(sample(3), 4, true))).toBe("server");
  });
});

test.describe("testi del registro", () => {
  const data = sample();

  test("nomi corti, con il nome intero quando due coincidono", () => {
    const giulia = { id: "1", name: "Giulia Bianchi", number: "4", libero: false };
    const gianna = { id: "2", name: "Giulia Brambilla", number: "5", libero: false };
    const sara = { id: "3", name: "Sara", number: null, libero: false };
    expect(shortName(giulia, [giulia, sara])).toBe("Giulia B.");
    expect(shortName(giulia, [giulia, gianna])).toBe("Giulia Bianchi");
    expect(shortName(sara, [giulia, sara])).toBe("Sara");
    expect(shortName({ ...giulia, name: "  Maria  Anna   rossi " }, [])).toBe("Maria R.");
  });

  test("ordine per maglia, chi non ce l'ha in fondo", () => {
    const players = [
      { id: "a", name: "Zoe", number: null, libero: false },
      { id: "b", name: "Bea", number: "12", libero: false },
      { id: "c", name: "Ada", number: "3", libero: false },
      { id: "d", name: "Eva", number: "3", libero: false },
    ];
    expect(sortPlayers(players).map((p) => p.id)).toEqual(["c", "d", "b", "a"]);
  });

  test("chi ha agito: nome e maglia per noi, solo maglia per loro, «Non indicata» se non si sa", () => {
    expect(playerLabel(data.roster, "us", "a1")).toBe("Giulia Bianchi (4)");
    expect(playerLabel(data.roster, "opp", "opp-7")).toBe("n. 7");
    expect(playerLabel(data.roster, "us", null)).toBe("Non indicata");
    expect(playerLabel(data.roster, "us", "sconosciuta")).toBe("Non indicata");
    expect(sideLabel("us")).toBe("Noi");
    expect(sideLabel("opp", "possessive")).toBe("loro");
  });

  test("testo di uno scambio: punto, errore, muro con chi attaccava, fallo di squadra", () => {
    let d = addRally(data, { actor: "opp", how: "serveError", player: "opp-7" }, T0, "e1");
    d = addRally(d, { actor: "us", how: "block", player: "a1", victim: "opp-7" }, T0, "e2");
    d = addRally(d, { actor: "us", how: "rotationFault", player: null }, T0, "e3");
    const rallies = deriveScout(d).rallies;
    const error = rallyText(rallies[3], d.roster);
    expect(error).toEqual({ winner: "us", label: "Battuta sbagliata", who: "n. 7", victim: null });
    const block = rallyText(rallies[4], d.roster);
    expect(block).toMatchObject({ winner: "us", label: "Muro", who: "Giulia Bianchi (4)", victim: "n. 7" });
    const fault = rallyText(rallies[5], d.roster);
    expect(fault).toMatchObject({ winner: "opp", label: "Rotazione / posizione", who: "Squadra" });
  });

  test("numeri di maglia scritti a mano", () => {
    expect(parseJerseyNumbers("1 4, 7;9")).toEqual(["1", "4", "7", "9"]);
    expect(parseJerseyNumbers("7 7 07")).toEqual(["7"]);
    expect(parseJerseyNumbers("  ")).toEqual([]);
    expect(parseJerseyNumbers("a b 12 345")).toEqual(["12", "34"]);
  });
});


test.describe("stato di una partita nell'elenco", () => {
  test("nessun punto, in corso, conclusa", () => {
    expect(summarizeScout(null)).toMatchObject({ state: "none", rallies: 0, lastSet: null });
    expect(summarizeScout(sample(0))).toMatchObject({ state: "none" });

    const live = summarizeScout(sample(3));
    expect(live).toMatchObject({ state: "live", rallies: 3, lastSet: { n: 1, score: { us: 3, opp: 0 } }, setsWon: { us: 0, opp: 0 } });

    // Un set chiuso 25-0: si va al 2°, con la partita ancora in corso.
    let data = sample(0);
    for (let i = 0; i < 25; i++) data = addRally(data, { actor: "us", how: "attack", player: null }, T0 + i, `s${i}`);
    data = endSet(data, "opp", T0 + 100, "end1");
    expect(summarizeScout(data)).toMatchObject({ state: "live", setsWon: { us: 1, opp: 0 }, sets: [{ us: 25, opp: 0 }] });
    expect(summarizeScout({ ...data, finished: true })).toMatchObject({ state: "done" });
  });

  test("solo campionato e amichevoli di U14/U15", () => {
    expect(isScoutable({ team: "u14u15", isTournament: false })).toBe(true);
    expect(isScoutable({ team: "u14u15", isTournament: true })).toBe(false);
    expect(isScoutable({ team: "minivolley", isTournament: false })).toBe(false);
  });
});

test.describe("archivio in memoria: versioni e partite eliminate", () => {
  const match: MatchInput = {
    team: "u14u15",
    category: "U15",
    opponent: "Degano",
    isHome: true,
    location: "Palestra",
    matchDate: "2026-10-17T18:00",
    isFriendly: false,
    isTournament: false,
    meetingTime: null,
    meetingLocation: null,
    notes: null,
    calledUpAthleteIds: [],
    setScores: null,
    resultSetsWon: null,
    resultSetsLost: null,
    tournamentGames: null,
  };

  test("si salva solo se la versione dichiarata è quella attuale", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const { id } = await repo.createMatch(match, null);
    const data = sample(2);

    expect(await repo.getMatchScout(id)).toBeNull();

    // Prima volta: nessuna base. Una seconda «prima volta» trova già lo scout.
    const first = await repo.saveMatchScout(id, data, null, null);
    expect(first).toMatchObject({ ok: true, scout: { version: 1, matchId: id } });
    const again = await repo.saveMatchScout(id, sample(3), null, null);
    expect(again).toMatchObject({ ok: false, current: { version: 1 } });

    const second = await repo.saveMatchScout(id, sample(3), null, 1);
    expect(second).toMatchObject({ ok: true, scout: { version: 2 } });
    const stale = await repo.saveMatchScout(id, sample(4), null, 1);
    expect(stale).toMatchObject({ ok: false, current: { version: 2 } });
    if (!stale.ok) expect(stale.current?.events).toHaveLength(3);

    const current = await repo.getMatchScout(id);
    expect(current?.version).toBe(2);
    expect(current?.events).toHaveLength(3);
  });

  test("quello che si legge è una copia: modificarla non tocca l'archivio", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const { id } = await repo.createMatch(match, null);
    await repo.saveMatchScout(id, sample(2), null, null);
    const read = await repo.getMatchScout(id);
    read!.events.pop();
    read!.roster.us.length = 0;
    expect((await repo.getMatchScout(id))?.events).toHaveLength(2);
    expect((await repo.getMatchScout(id))?.roster.us).toHaveLength(1);
    const list = await repo.listMatchScouts();
    list[0].events.length = 0;
    expect((await repo.getMatchScout(id))?.events).toHaveLength(2);
  });

  test("eliminare la partita elimina il suo scout; si può anche togliere da solo", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const one = await repo.createMatch(match, null);
    const two = await repo.createMatch({ ...match, opponent: "Altra" }, null);
    await repo.saveMatchScout(one.id, sample(1), null, null);
    await repo.saveMatchScout(two.id, sample(1), null, null);
    expect(await repo.listMatchScouts()).toHaveLength(2);

    await repo.deleteMatch(one.id);
    expect((await repo.listMatchScouts()).map((s) => s.matchId)).toEqual([two.id]);

    await repo.deleteMatchScout(two.id);
    expect(await repo.listMatchScouts()).toHaveLength(0);
    await repo.deleteMatchScout(two.id); // già tolto: nessun errore

    // Dopo la cancellazione si ricomincia dalla versione 1.
    expect(await repo.saveMatchScout(two.id, sample(1), null, null)).toMatchObject({ ok: true, scout: { version: 1 } });
  });
});

test.describe("tabella dello scout non ancora creata", () => {
  test("si riconosce l'errore di Postgres e di Supabase, e nessun altro", () => {
    expect(isScoutTableMissing(new Error('relation "public.match_scouts" does not exist'))).toBe(true);
    expect(isScoutTableMissing(new Error("Could not find the table 'public.match_scouts' in the schema cache"))).toBe(true);
    expect(isScoutTableMissing(new Error("PGRST205: match_scouts"))).toBe(true);
    expect(isScoutTableMissing('relation "match_scouts" does not exist')).toBe(true);

    // Un errore su un'altra tabella, o di altro tipo, non è questo.
    expect(isScoutTableMissing(new Error('relation "public.matches" does not exist'))).toBe(false);
    expect(isScoutTableMissing(new Error("duplicate key value violates unique constraint on match_scouts"))).toBe(false);
    expect(isScoutTableMissing(new Error("connection refused"))).toBe(false);
    expect(isScoutTableMissing(null)).toBe(false);
    expect(isScoutTableMissing(undefined)).toBe(false);
    expect(isScoutTableMissing({ message: "match_scouts does not exist" })).toBe(false);
  });
});
