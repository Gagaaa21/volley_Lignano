import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { addPlayer, addRally, newScoutData, opponentPlayer, endSet } from "@/lib/scout/actions";
import { parseJerseyNumbers, playerLabel, rallyText, shortName, sideLabel, sortPlayers } from "@/lib/scout/describe";
import { deriveScout } from "@/lib/scout/derive";
import { isScoutable, summarizeScout } from "@/lib/scout/match";
import { isScoutTableMissing } from "@/lib/scout/missing";
import { scoutDataSchema } from "@/lib/scout/schema";
import { backupKey, canonicalJson, mergeRoster, parseBackup, planStart, prefixLength, reconcile, sameScout, scoutContent, type LocalBackup } from "@/lib/scout/sync";
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

/** Una storia: lo scout di base più questi scambi (id e istante), tutti di chi attacca. */
function history(base: ScoutData, tail: { id: string; at: number }[], actor: "us" | "opp" = "us"): ScoutData {
  let data = base;
  for (const { id, at } of tail) data = addRally(data, { actor, how: "attack", player: actor === "us" ? "a1" : null }, at, id);
  return data;
}

test.describe("unire due versioni", () => {
  const base = sample(2); // r0, r1: la parte comune

  test("hanno gli stessi scambi: si tiene questo dispositivo, senza perdere nessuna giocatrice", () => {
    const server = history(base, [{ id: "s0", at: T0 + 10_000 }]);
    const mine = addPlayer(server, "us", { id: "a2", name: "Sara Rossi", number: "7", libero: false });
    const verdict = reconcile(server, mine);
    expect(verdict.kind).toBe("same");
    if (verdict.kind === "conflict") return;
    expect(verdict.data.roster.us.map((p) => p.id)).toEqual(["a1", "a2"]);
    expect(verdict.data.events).toHaveLength(3);
  });

  test("questo dispositivo ha in più (il salvataggio era arrivato ma la risposta no): si tiene, non si chiede", () => {
    const server = sample(3);
    const mine = sample(6);
    const verdict = reconcile(server, mine);
    expect(verdict.kind).toBe("mine");
    if (verdict.kind === "conflict") return;
    expect(verdict.data.events).toHaveLength(6);
    expect(prefixLength(server.events, mine.events)).toBe(3);
  });

  test("il server ha in più (questo dispositivo era rimasto indietro): si adotta il server, niente di proprio da perdere", () => {
    const verdict = reconcile(sample(6), sample(3));
    expect(verdict.kind).toBe("server");
    if (verdict.kind === "conflict") return;
    expect(verdict.data.events).toHaveLength(6);
  });

  test("cose diverse ma di momenti diversi (due dispositivi uno dopo l'altro): si uniscono, in ordine di tempo", () => {
    const server = history(base, [{ id: "s0", at: T0 + 10_000 }, { id: "s1", at: T0 + 11_000 }]);
    const mine = history(base, [{ id: "m0", at: T0 + 20_000 }, { id: "m1", at: T0 + 21_000 }], "opp");
    const verdict = reconcile(server, mine);
    expect(verdict.kind).toBe("merged");
    if (verdict.kind === "conflict") return;
    expect(verdict.data.events.map((e) => e.id)).toEqual(["r0", "r1", "s0", "s1", "m0", "m1"]);
    // Al contrario (è questo dispositivo ad aver segnato prima) l'ordine segue il tempo, non chi è «mio».
    const reversed = reconcile(mine, server);
    expect(reversed.kind).toBe("merged");
    if (reversed.kind === "conflict") return;
    expect(reversed.data.events.map((e) => e.id)).toEqual(["r0", "r1", "s0", "s1", "m0", "m1"]);
    // Il risultato è uno scout valido: partita e punteggio si ricavano.
    expect(deriveScout(verdict.data).rallies).toHaveLength(6);
  });

  test("cose diverse negli stessi momenti (due persone che segnano insieme): si chiede", () => {
    const server = history(base, [{ id: "s0", at: T0 + 10_000 }, { id: "s1", at: T0 + 12_000 }]);
    const mine = history(base, [{ id: "m0", at: T0 + 11_000 }, { id: "m1", at: T0 + 13_000 }], "opp");
    expect(reconcile(server, mine).kind).toBe("conflict");
  });

  test("uno scambio corretto da una parte (stesso id, contenuto diverso) non passa inosservato: si chiede", () => {
    const original = history(base, [{ id: "s0", at: T0 + 10_000 }]);
    const corrected = scoutContent({ ...original, events: original.events.map((e) => (e.id === "s0" && e.type === "rally" ? { ...e, how: "block" as const } : e)) });
    expect(prefixLength(original.events, corrected.events)).toBe(2);
    expect(reconcile(original, corrected).kind).toBe("conflict");
  });

  test("la rosa si unisce sempre", () => {
    const a = { us: [{ id: "a1", name: "Giulia", number: "4", libero: false }], opp: [] };
    const b = { us: [{ id: "a2", name: "Sara", number: "7", libero: false }, { id: "a1", name: "Giulia B.", number: "4", libero: false }], opp: [opponentPlayer("3")] };
    const merged = mergeRoster(a, b);
    expect(merged.us.map((p) => p.id)).toEqual(["a1", "a2"]);
    expect(merged.us[0].name).toBe("Giulia");
    expect(merged.opp.map((p) => p.id)).toEqual(["opp-3"]);
  });
});

test.describe("unire due versioni: nessuno scambio si perde mai senza chiedere", () => {
  /** Un generatore di numeri casuali ripetibile (stessa serie a ogni esecuzione). */
  function random(seed: number) {
    let x = seed;
    return () => {
      x = (x * 1664525 + 1013904223) % 4294967296;
      return x / 4294967296;
    };
  }

  test("qualunque coppia di storie: se non si chiede, tutti gli scambi di entrambe ci sono e lo scout resta valido", () => {
    const rnd = random(20261017);
    let asked = 0;
    let kept = 0;
    for (let round = 0; round < 400; round++) {
      const common = Math.floor(rnd() * 5);
      const base = sample(common);
      const makeTail = (prefix: string, count: number, from: number) =>
        Array.from({ length: count }, (_, i) => ({
          // Ogni tanto uno scambio ha lo stesso id dell'altra storia: scritto in due modi.
          id: rnd() < 0.15 ? `shared-${i}` : `${prefix}${i}`,
          at: T0 + from + i * 1000 + Math.floor(rnd() * 400),
        }));
      const serverTail = makeTail("s", Math.floor(rnd() * 4), 100_000 + Math.floor(rnd() * 8) * 1000);
      const mineTail = makeTail("m", Math.floor(rnd() * 4), 100_000 + Math.floor(rnd() * 8) * 1000);
      const server = history(base, serverTail);
      const mine = history(base, mineTail, rnd() < 0.5 ? "us" : "opp");
      const verdict = reconcile(server, mine);
      if (verdict.kind === "conflict") {
        asked++;
        continue;
      }
      kept++;
      expect(scoutDataSchema.safeParse(verdict.data).success, `round ${round}: ${verdict.kind}`).toBe(true);
      const ids = new Set(verdict.data.events.map((e) => e.id));
      const wanted = verdict.kind === "merged" ? [...server.events, ...mine.events] : verdict.kind === "mine" ? mine.events : verdict.kind === "server" ? server.events : [...mine.events];
      for (const event of wanted) expect(ids.has(event.id), `round ${round}: manca ${event.id} (${verdict.kind})`).toBe(true);
      // Quello che manca in un'esito «mio»/«server» è solo ciò che l'altra versione non aveva in più.
      if (verdict.kind === "mine") expect(prefixLength(server.events, verdict.data.events)).toBe(server.events.length);
      if (verdict.kind === "server") expect(prefixLength(mine.events, verdict.data.events)).toBe(mine.events.length);
    }
    // Il test prova davvero i due casi.
    expect(asked).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);
  });
});

test.describe("da quale versione si riparte", () => {
  const server = saved(sample(3), 5);

  test("senza modifiche in sospeso conta il server (o si parte da zero)", () => {
    expect(planStart(null, null)).toEqual({ kind: "new" });
    expect(planStart(server, null)).toEqual({ kind: "server" });
    expect(planStart(server, backup(sample(6), 5, false))).toEqual({ kind: "server" });
    expect(planStart(null, backup(sample(6), 5, false))).toEqual({ kind: "new" });
  });

  test("con modifiche in sospeso si riparte dalla copia se il server non è cambiato", () => {
    for (const [srv, bak] of [
      [server, backup(sample(6), 5, true)],
      [null, backup(sample(6), 5, true)],
      [null, backup(sample(6), null, true)],
    ] as const) {
      const plan = planStart(srv, bak);
      expect(plan.kind).toBe("local");
      if (plan.kind === "local") {
        expect(plan.merged).toBe(false);
        expect(plan.data.events).toHaveLength(6);
      }
    }
  });

  test("se il server è cambiato nel frattempo ma ha solo meno cose (risposta persa), si riparte dalla copia senza chiedere", () => {
    // Il server è alla versione 5 con 3 scambi; la copia ne ha 6 e si basava sulla 4: il 4° salvataggio era arrivato, la risposta no.
    const plan = planStart(server, backup(sample(6), 4, true));
    expect(plan.kind).toBe("local");
    if (plan.kind === "local") expect(plan.data.events).toHaveLength(6);
    // Anche se la copia non sa su che versione si basava.
    expect(planStart(server, backup(sample(6), null, true)).kind).toBe("local");
  });

  test("se il server ha più della copia, conta il server (la copia era rimasta indietro); se è già uguale non c'è nulla da scegliere", () => {
    expect(planStart(saved(sample(6), 7), backup(sample(3), 4, true))).toEqual({ kind: "server" });
    expect(planStart(server, backup(sample(3), 4, true))).toEqual({ kind: "server" });
  });

  test("cose di momenti diversi si uniscono; solo cose diverse negli stessi momenti chiedono di scegliere", () => {
    const base = sample(2);
    const remote = saved(history(base, [{ id: "s0", at: T0 + 10_000 }]), 8);
    const later = history(base, [{ id: "m0", at: T0 + 20_000 }], "opp");
    const merged = planStart(remote, backup(later, 7, true));
    expect(merged.kind).toBe("local");
    if (merged.kind === "local") {
      expect(merged.merged).toBe(true);
      expect(merged.data.events.map((e) => e.id)).toEqual(["r0", "r1", "s0", "m0"]);
    }
    const overlapping = history(base, [{ id: "m0", at: T0 + 10_500 }], "opp");
    const remoteLate = saved(history(base, [{ id: "s0", at: T0 + 10_000 }, { id: "s1", at: T0 + 11_000 }]), 8);
    expect(planStart(remoteLate, backup(overlapping, 7, true))).toEqual({ kind: "conflict" });
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
