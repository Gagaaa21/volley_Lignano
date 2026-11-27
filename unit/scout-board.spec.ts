import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { addPlayer, addRally, addTimeout, newScoutData, opponentPlayer, setLineup, updateSettings } from "@/lib/scout/actions";
import { BOARD_SCOUT_KEY, boardSnapshotFrom, clearBoardScore, publishBoardScore, toBoardScore } from "@/lib/scout/boardSnapshot";
import { PUBLIC_LIVE_SCOUT_KEY } from "@/lib/scout/publicSnapshot";
import type { MatchScout, ScoutData } from "@/lib/scout/types";
import { LIVE_SCORE_TTL_MS } from "@/lib/types";

/**
 * La copia del punteggio per il tabellone della palestra: c'è anche con la diretta spenta, dentro solo squadre, punti, set,
 * chi batte e time-out (mai una giocatrice), e non tocca mai la copia del sito pubblico.
 */

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);
const MATCH = { team: "u14u15" as const, category: "U15" as const, opponent: "Pol. Esempio" };
const UPDATED = "2026-10-17T09:30:00.000Z";

/** Uno scout con la diretta spenta, la nostra formazione (con i nomi accesi: non devono comunque uscire) e qualche punto. */
function scout(us: number, opp: number, options: { publicLive?: boolean } = {}): MatchScout {
  let data: ScoutData = newScoutData({ us: [], opp: [] }, { publicLive: options.publicLive ?? false, publicNames: true });
  for (const [id, number] of [["p7", "7"], ["p12", "12"], ["p3", "3"], ["p9", "9"], ["p15", "15"], ["p4", "4"], ["p1", "1"]] as const) {
    data = addPlayer(data, "us", { id, name: `Giocatrice ${number}`, number, libero: id === "p1" });
  }
  data = addPlayer(data, "opp", opponentPlayer("8"));
  data = setLineup(data, "us", { positions: ["p7", "p12", "p3", "p9", "p15", "p4"], libero: "p1", hosts: ["p3", "p4"] }, T0, "l1");
  for (let i = 0; i < us; i++) data = addRally(data, { actor: "us", how: "attack", player: "p7" }, T0 + 1000 + i * 1000, `u${i}`);
  for (let i = 0; i < opp; i++) data = addRally(data, { actor: "opp", how: "attack", player: null }, T0 + 100_000 + i * 1000, `o${i}`);
  return { ...data, matchId: "m1", version: 1, updatedBy: null, updatedAt: UPDATED };
}

test("anche con la diretta spenta: punti, set, chi batte e time-out; nessuna giocatrice, nessun numero di squadra", () => {
  const withTimeout: MatchScout = { ...scout(5, 3), ...addTimeout(scout(5, 3), "opp", T0 + 200_000, "to1") };
  const board = toBoardScore(withTimeout, MATCH);
  expect(board).toMatchObject({
    team: "u14u15",
    category: "U15",
    home: { name: "Volley Lignano", score: 5, sets: 0 },
    away: { name: "Pol. Esempio", score: 3, sets: 0 },
    timeouts: { home: 0, away: 1 },
    finished: false,
    updatedAt: UPDATED,
  });
  expect(board?.serving).not.toBeNull();
  expect(Object.keys(board!).sort()).toEqual(["away", "category", "finished", "home", "serving", "setRules", "sets", "team", "timeouts", "updatedAt"]);
  expect(JSON.stringify(board)).not.toMatch(/Giocatrice|"p7"|lineup|subs|setStats|matchStats|recap|info/);
});

test("prima del primo punto: 0–0 «non iniziata»; fuori dall'orario della partita niente", () => {
  expect(toBoardScore(scout(0, 0), MATCH)).toMatchObject({ notStarted: true, home: { score: 0 }, away: { score: 0 } });
  const dated = { ...MATCH, matchDate: "2026-10-17T18:00" };
  expect(toBoardScore(scout(2, 1), dated)).not.toBeNull();
  expect(toBoardScore({ ...scout(2, 1), updatedAt: "2026-10-19T09:30:00.000Z" }, dated)).toBeNull();
});

test("la copia si salva e si toglie da sola, non tocca quella del sito pubblico, e scade dopo qualche ora", async () => {
  const repo = createMemoryRepo(createEmptyStore());
  await publishBoardScore(repo, scout(4, 2), MATCH);
  const raw = await repo.getAppSetting(BOARD_SCOUT_KEY);
  expect(boardSnapshotFrom(raw, Date.parse(UPDATED) + 1000)).toMatchObject({ home: { score: 4 }, away: { score: 2 } });
  expect(boardSnapshotFrom(raw, Date.parse(UPDATED) + LIVE_SCORE_TTL_MS + 1)).toBeNull();
  // Con la diretta spenta il sito pubblico non riceve niente.
  expect(await repo.getAppSetting(PUBLIC_LIVE_SCOUT_KEY)).toBeNull();

  // Lo scout di un'altra partita non toglie questa; quello della stessa sì.
  await clearBoardScore(repo, "altra");
  expect(boardSnapshotFrom(await repo.getAppSetting(BOARD_SCOUT_KEY), Date.parse(UPDATED))).not.toBeNull();
  await clearBoardScore(repo, "m1");
  expect(boardSnapshotFrom(await repo.getAppSetting(BOARD_SCOUT_KEY), Date.parse(UPDATED))).toBeNull();
  // Valori mancanti o rovinati: niente.
  expect(boardSnapshotFrom(null)).toBeNull();
  expect(boardSnapshotFrom("{rotto")).toBeNull();
});

test("con la diretta accesa la copia del tabellone è la stessa: la diretta non cambia niente qui", () => {
  const off = toBoardScore(scout(6, 4), MATCH);
  const on = toBoardScore({ ...scout(6, 4, { publicLive: true }) }, MATCH);
  expect(on).toEqual(off);
  // E si spegne la diretta a metà: il tabellone continua.
  const switched = { ...scout(6, 4, { publicLive: true }) };
  expect(toBoardScore({ ...switched, ...updateSettings(switched, { publicLive: false }) }, MATCH)).toEqual(off);
});
