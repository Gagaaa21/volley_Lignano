import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { addPlayer, addRally, addTimeout, newScoutData, opponentPlayer, updateSettings } from "@/lib/scout/actions";
import { clearPublicScore, PUBLIC_LIVE_SCOUT_KEY, publishPublicScore, readPublicScoutSnapshot } from "@/lib/scout/publicSnapshot";
import type { MatchScout, ScoutData } from "@/lib/scout/types";
import { LIVE_SCORE_TTL_MS } from "@/lib/types";

/** La copia compatta del punteggio live: cosa contiene, quando vale e quando si ripiega sulla lettura completa. */

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);
const MATCH = { team: "u14u15" as const, category: "U15" as const, opponent: "Pol. Esempio" };
const UPDATED_AT = "2026-10-17T09:30:00.000Z";

function scoutData(points: { us: number; opp: number }, publicLive = true): ScoutData {
  let data = newScoutData({ us: [], opp: [] });
  data = addPlayer(data, "us", { id: "a1", name: "Giulia Bianchi", number: "4", libero: false });
  data = addPlayer(data, "opp", opponentPlayer("7"));
  data = updateSettings(data, { publicLive });
  for (let i = 0; i < points.us; i++) data = addRally(data, { actor: "us", how: "attack", player: "a1" }, T0 + i * 1000, `u${i}`);
  for (let i = 0; i < points.opp; i++) data = addRally(data, { actor: "opp", how: "attack", player: null }, T0 + (points.us + i) * 1000, `o${i}`);
  return data;
}

const scoutOf = (matchId: string, data: ScoutData, updatedAt = UPDATED_AT): MatchScout => ({ ...data, matchId, version: 1, updatedBy: null, updatedAt });

test.describe("copia compatta del punteggio live", () => {
  test("se non è mai stata scritta, o non si legge, chi legge ripiega sulla lettura completa (undefined)", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    expect(await readPublicScoutSnapshot(repo)).toBeUndefined();
    await repo.setAppSetting(PUBLIC_LIVE_SCOUT_KEY, "non è json");
    expect(await readPublicScoutSnapshot(repo)).toBeUndefined();
    await repo.setAppSetting(PUBLIC_LIVE_SCOUT_KEY, JSON.stringify({ matchId: "m1", live: { team: "u14u15" } }));
    expect(await readPublicScoutSnapshot(repo)).toBeUndefined();
  });

  test("andata e ritorno: poche centinaia di byte e mai nomi, numeri di maglia o scambi", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    await publishPublicScore(repo, scoutOf("m1", addTimeout(scoutData({ us: 3, opp: 1 }), "opp", T0 + 60_000, "t1")), MATCH);

    const raw = (await repo.getAppSetting(PUBLIC_LIVE_SCOUT_KEY))!;
    expect(raw.length).toBeLessThan(700);
    for (const secret of ["Giulia", "Bianchi", "roster", "events", "player", "rally", "attack", "n. 7"]) expect(raw).not.toContain(secret);

    expect(await readPublicScoutSnapshot(repo, Date.parse(UPDATED_AT) + 60_000)).toMatchObject({
      team: "u14u15",
      category: "U15",
      home: { name: "Volley Lignano", score: 3, sets: 0 },
      away: { name: "Pol. Esempio", score: 1, sets: 0 },
      // L'ultimo punto è loro: battono loro.
      serving: "away",
      timeouts: { home: 0, away: 1 },
      finished: false,
      updatedAt: UPDATED_AT,
    });
  });

  test("il set point viaggia nella copia", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    await publishPublicScore(repo, scoutOf("m1", scoutData({ us: 24, opp: 20 })), MATCH);
    expect((await readPublicScoutSnapshot(repo, Date.parse(UPDATED_AT)))?.point).toEqual({ side: "home", kind: "set" });
  });

  test("punteggio spento: la copia dice «niente» (null), senza ripiegare sulla lettura completa", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const now = Date.parse(UPDATED_AT);
    await publishPublicScore(repo, scoutOf("m1", scoutData({ us: 3, opp: 1 })), MATCH);
    expect(await readPublicScoutSnapshot(repo, now)).not.toBeNull();

    // Spento dallo Scout: il salvataggio dopo toglie il punteggio.
    await publishPublicScore(repo, scoutOf("m1", scoutData({ us: 3, opp: 1 }, false)), MATCH);
    expect(await readPublicScoutSnapshot(repo, now)).toBeNull();
  });

  test("acceso ma senza ancora un punto: nella copia c'è la partita «non iniziata» a 0–0, che diventa quella vera al primo punto", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const now = Date.parse(UPDATED_AT);
    await publishPublicScore(repo, scoutOf("m1", scoutData({ us: 0, opp: 0 })), MATCH);
    expect(await readPublicScoutSnapshot(repo, now)).toMatchObject({
      home: { name: "Volley Lignano", score: 0, sets: 0 },
      away: { name: "Pol. Esempio", score: 0, sets: 0 },
      serving: null,
      finished: false,
      notStarted: true,
    });

    await publishPublicScore(repo, scoutOf("m1", scoutData({ us: 1, opp: 0 })), MATCH);
    const started = await readPublicScoutSnapshot(repo, now);
    expect(started?.home.score).toBe(1);
    expect(started).not.toHaveProperty("notStarted");

    // Scout azzerato (di nuovo senza punti) ma ancora acceso: torna «non iniziata»; spento, niente.
    await publishPublicScore(repo, scoutOf("m1", scoutData({ us: 0, opp: 0 })), MATCH);
    expect((await readPublicScoutSnapshot(repo, now))?.notStarted).toBe(true);
    await publishPublicScore(repo, scoutOf("m1", scoutData({ us: 0, opp: 0 }, false)), MATCH);
    expect(await readPublicScoutSnapshot(repo, now)).toBeNull();
  });

  test("una partita non toglie il punteggio di un'altra", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const now = Date.parse(UPDATED_AT);
    await publishPublicScore(repo, scoutOf("m1", scoutData({ us: 3, opp: 1 })), MATCH);

    // Un'altra partita con il live spento salva: la prima resta in diretta.
    await publishPublicScore(repo, scoutOf("m2", scoutData({ us: 5, opp: 5 }, false)), MATCH);
    await clearPublicScore(repo, "m2");
    expect((await readPublicScoutSnapshot(repo, now))?.home.score).toBe(3);

    // Se è l'altra a mettere il suo punteggio, vale l'ultima che salva.
    await publishPublicScore(repo, scoutOf("m2", scoutData({ us: 7, opp: 6 })), MATCH);
    expect((await readPublicScoutSnapshot(repo, now))?.home.score).toBe(7);

    // Cancellata la partita (o azzerato lo scout) se ne va il suo punteggio, non quello di altri.
    await clearPublicScore(repo, "m1");
    expect((await readPublicScoutSnapshot(repo, now))?.home.score).toBe(7);
    await clearPublicScore(repo, "m2");
    expect(await readPublicScoutSnapshot(repo, now)).toBeNull();
  });

  test("ferma da più di tre ore non conta più", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    await publishPublicScore(repo, scoutOf("m1", scoutData({ us: 3, opp: 1 })), MATCH);
    const saved = Date.parse(UPDATED_AT);
    expect(await readPublicScoutSnapshot(repo, saved + LIVE_SCORE_TTL_MS - 1000)).not.toBeNull();
    expect(await readPublicScoutSnapshot(repo, saved + LIVE_SCORE_TTL_MS + 1000)).toBeNull();
  });
});
