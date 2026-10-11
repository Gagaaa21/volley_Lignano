import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { addPlayer, addRally, endSet, newScoutData, opponentPlayer, updateSettings } from "@/lib/scout/actions";
import { scoutDataSchema } from "@/lib/scout/schema";
import { latestPublicLive, toPublicScoutScore } from "@/lib/scout/publicScore";
import { backupKey, parseBackup, sameScout, scoutContent } from "@/lib/scout/sync";
import type { ScoutData } from "@/lib/scout/types";
import { LIVE_SCORE_TTL_MS, type MatchInput, type PublicLiveScore } from "@/lib/types";

/** Punteggio live dallo Scout: cosa esce sul sito, cosa non esce mai, e come si sceglie tra Scout e Live score. */

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);
const MATCH = { team: "u14u15" as const, category: "U15" as const, opponent: "Pol. Esempio" };

function base(): ScoutData {
  let data = newScoutData({ us: [], opp: [] });
  data = addPlayer(data, "us", { id: "a1", name: "Giulia Bianchi", number: "4", libero: false });
  data = addPlayer(data, "opp", opponentPlayer("7"));
  return data;
}

/** `us` punti nostri e `opp` loro, nell'ordine: prima tutti i nostri, poi i loro. */
function play(data: ScoutData, us: number, opp: number, startAt = 0): ScoutData {
  let next = data;
  for (let i = 0; i < us; i++) next = addRally(next, { actor: "us", how: "attack", player: "a1" }, T0 + (startAt + i) * 1000, `u${startAt}-${i}`);
  for (let i = 0; i < opp; i++) next = addRally(next, { actor: "opp", how: "attack", player: null }, T0 + (startAt + us + i) * 1000, `o${startAt}-${i}`);
  return next;
}

const live = (data: ScoutData, updatedAt = "2026-10-17T09:30:00.000Z") =>
  toPublicScoutScore({ ...data, updatedAt }, MATCH);

test.describe("punteggio live dallo scout", () => {
  test("spento di default: non esce niente, anche con dei punti", () => {
    expect(base().settings.publicLive).toBe(false);
    expect(live(play(base(), 5, 3))).toBeNull();
  });

  test("acceso ma senza punti: non compare ancora", () => {
    expect(live(updateSettings(base(), { publicLive: true }))).toBeNull();
  });

  test("acceso: squadre, punti del set, set vinti e chi batte", () => {
    const data = play(updateSettings(base(), { publicLive: true }), 5, 3);
    const result = live(data);
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      team: "u14u15",
      category: "U15",
      home: { name: "Volley Lignano", score: 5, sets: 0 },
      away: { name: "Pol. Esempio", score: 3, sets: 0 },
      sets: [],
      finished: false,
      updatedAt: "2026-10-17T09:30:00.000Z",
    });
    // L'ultimo punto è loro: battono loro.
    expect(result?.serving).toBe("away");
  });

  test("chi batte segue l'ultimo punto", () => {
    const data = play(updateSettings(base(), { publicLive: true }), 0, 2);
    expect(live(play(data, 1, 0, 10))?.serving).toBe("home");
  });

  test("con un set chiuso il punteggio riparte da zero e il set entra nello storico", () => {
    let data = play(updateSettings(base(), { publicLive: true }), 25, 20);
    data = endSet(data, "opp", T0 + 90_000, "end1");
    const result = live(data);
    expect(result?.sets).toEqual([{ home: 25, away: 20 }]);
    expect(result?.home).toMatchObject({ score: 0, sets: 1 });
    expect(result?.away).toMatchObject({ score: 0, sets: 0 });
    // Nel nuovo set batte chi è stato scelto a fine set.
    expect(result?.serving).toBe("away");
    expect(result?.finished).toBe(false);
  });

  test("a partita decisa: finita, set vinti, nessuno che batte", () => {
    let data = updateSettings(base(), { publicLive: true, format: "bo3" });
    for (let set = 1; set <= 2; set++) {
      data = play(data, 25, 10, set * 100);
      data = endSet(data, "us", T0 + set * 200_000, `end${set}`);
    }
    const result = live(data);
    expect(result?.finished).toBe(true);
    expect(result?.home.sets).toBe(2);
    expect(result?.away.sets).toBe(0);
    expect(result?.sets).toEqual([
      { home: 25, away: 10 },
      { home: 25, away: 10 },
    ]);
    expect(result?.serving).toBeNull();
  });

  test("partita chiusa a mano: l'ultimo set non chiuso entra comunque nel riepilogo", () => {
    const data = { ...play(updateSettings(base(), { publicLive: true }), 12, 9), finished: true };
    const result = live(data);
    expect(result?.finished).toBe(true);
    expect(result?.sets).toEqual([{ home: 12, away: 9 }]);
    expect(result?.serving).toBeNull();
  });

  test("senza nome dell'avversaria si scrive «Avversaria»", () => {
    const data = play(updateSettings(base(), { publicLive: true }), 1, 0);
    expect(toPublicScoutScore({ ...data, updatedAt: "2026-10-17T09:30:00.000Z" }, { ...MATCH, opponent: "  " })?.away.name).toBe("Avversaria");
  });

  test("non esce mai niente che riguardi le giocatrici", () => {
    const data = play(updateSettings(base(), { publicLive: true }), 8, 6);
    const json = JSON.stringify(live(data));
    expect(json).not.toContain("Giulia");
    expect(json).not.toContain("Bianchi");
    expect(json).not.toContain("a1");
    expect(json).not.toContain("roster");
    expect(json).not.toContain("attack");
    expect(Object.keys(live(data) ?? {}).sort()).toEqual(["away", "category", "finished", "home", "serving", "sets", "team", "updatedAt"]);
  });
});

test.describe("punteggio live: Scout o Live score", () => {
  const score = (updatedAt: string, label: string): PublicLiveScore => ({
    team: "u14u15",
    category: null,
    home: { name: label, color: "#000", score: 1, sets: 0 },
    away: { name: "X", color: "#fff", score: 0, sets: 0 },
    serving: null,
    sets: [],
    finished: false,
    updatedAt,
  });

  test("vale quello aggiornato per ultimo", () => {
    const old = score("2026-10-17T09:00:00.000Z", "vecchio");
    const recent = score("2026-10-17T09:05:00.000Z", "recente");
    expect(latestPublicLive(old, recent)?.home.name).toBe("recente");
    expect(latestPublicLive(recent, old)?.home.name).toBe("recente");
  });

  test("se ce n'è uno solo vale quello, se non ce n'è nessuno niente", () => {
    const only = score("2026-10-17T09:00:00.000Z", "solo");
    expect(latestPublicLive(only, null)).toBe(only);
    expect(latestPublicLive(null, only)).toBe(only);
    expect(latestPublicLive(null, null)).toBeNull();
  });
});

test.describe("punteggio live: salvataggio", () => {
  test("uno scout salvato prima di questa funzione vale «spento»", () => {
    const old = { settings: { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" }, roster: { us: [], opp: [] }, events: [], finished: false };
    const parsed = scoutDataSchema.parse(old);
    expect(parsed.settings.publicLive).toBe(false);
    expect(scoutContent(old as unknown as ScoutData).settings.publicLive).toBe(false);
  });

  test("lo schema accetta e conserva il valore acceso", () => {
    const data = updateSettings(base(), { publicLive: true });
    expect(scoutDataSchema.parse(data).settings.publicLive).toBe(true);
  });

  test("accenderlo cambia il contenuto: il salvataggio parte", () => {
    const off = base();
    const on = updateSettings(off, { publicLive: true });
    expect(sameScout(off, on)).toBe(false);
    expect(sameScout(on, updateSettings(base(), { publicLive: true }))).toBe(true);
  });

  test("una copia nel telefono fatta prima di questa funzione si legge ancora", () => {
    const raw = JSON.stringify({
      data: { settings: { format: "bo5", setPoints: 25, lastSetPoints: 15, firstServer: "us" }, roster: { us: [], opp: [] }, events: [], finished: false },
      baseVersion: 2,
      dirty: true,
      savedAt: 1,
    });
    expect(backupKey("m1")).toBe("volley-scout-m1");
    expect(parseBackup(raw)?.data.settings.publicLive).toBe(false);
  });
});

test.describe("punteggio live: archivio in memoria", () => {
  const matchInput = (opponent: string): MatchInput => ({
    team: "u14u15",
    category: "U15",
    opponent,
    matchDate: "2026-10-17T15:00:00",
    location: "Palestra",
    isHome: true,
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
  });

  test("restituisce solo lo scout con il live acceso e salvato da poco", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const a = await repo.createMatch(matchInput("Prima"), null);
    const b = await repo.createMatch(matchInput("Seconda"), null);
    const c = await repo.createMatch(matchInput("Terza"), null);
    expect(await repo.getPublicLiveScout()).toBeNull();

    // Spento: niente.
    await repo.saveMatchScout(a.id, play(base(), 3, 1), null, null);
    expect(await repo.getPublicLiveScout()).toBeNull();

    // Acceso: esce, con la sua partita.
    await repo.saveMatchScout(b.id, play(updateSettings(base(), { publicLive: true }), 3, 1), null, null);
    const found = await repo.getPublicLiveScout();
    expect(found?.match.opponent).toBe("Seconda");
    expect(found?.scout.settings.publicLive).toBe(true);

    // Due accesi: l'ultimo salvato.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repo.saveMatchScout(c.id, play(updateSettings(base(), { publicLive: true }), 1, 1), null, null);
    expect((await repo.getPublicLiveScout())?.match.opponent).toBe("Terza");

    // Spegnerlo: torna l'altro.
    const current = await repo.getMatchScout(c.id);
    await repo.saveMatchScout(c.id, updateSettings(base(), { publicLive: false }), null, current?.version ?? null);
    expect((await repo.getPublicLiveScout())?.match.opponent).toBe("Seconda");
  });

  test("uno scout fermo da più di tre ore non conta", async () => {
    const store = createEmptyStore();
    const repo = createMemoryRepo(store);
    const match = await repo.createMatch(matchInput("Vecchia"), null);
    await repo.saveMatchScout(match.id, play(updateSettings(base(), { publicLive: true }), 3, 1), null, null);
    expect(await repo.getPublicLiveScout()).not.toBeNull();
    store.matchScouts[0].updatedAt = new Date(Date.now() - LIVE_SCORE_TTL_MS - 60_000).toISOString();
    expect(await repo.getPublicLiveScout()).toBeNull();
  });

  test("cancellare la partita toglie anche il punteggio live", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput("Da cancellare"), null);
    await repo.saveMatchScout(match.id, play(updateSettings(base(), { publicLive: true }), 3, 1), null, null);
    await repo.deleteMatch(match.id);
    expect(await repo.getPublicLiveScout()).toBeNull();
  });
});
