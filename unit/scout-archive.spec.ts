import { expect, test } from "@playwright/test";
import { addPlayer, addRally, newScoutData } from "@/lib/scout/actions";
import { addToArchive, archiveKey, isArchiveStale, MAX_ARCHIVE, parseArchive, withoutOldest, type ArchiveEntry } from "@/lib/scout/archive";
import { buildExport, exportFileName, parseImport } from "@/lib/scout/backupFile";
import type { ScoutData } from "@/lib/scout/types";

/** Le copie di recupero dello scout e il file di copia: regole pure, senza browser. */

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function sample(points: number): ScoutData {
  let data = newScoutData({ us: [], opp: [] });
  data = addPlayer(data, "us", { id: "a1", name: "Giulia Bianchi", number: "4", libero: false });
  for (let i = 0; i < points; i++) data = addRally(data, { actor: "us", how: "attack", player: "a1" }, T0 + i * 1000, `r${i}`);
  return data;
}

const entry = (id: string, at: number, data: ScoutData, reason: ArchiveEntry["reason"] = "set"): ArchiveEntry => ({ id, at, reason, data });

test.describe("copie di recupero", () => {
  test("la chiave è una per partita, e diversa da quella della copia delle modifiche non salvate", () => {
    expect(archiveKey("m1")).toBe("volley-scout-archive-m1");
    expect(archiveKey("m1")).not.toBe(archiveKey("m2"));
  });

  test("si legge solo ciò che è valido, dalla più recente; il resto si ignora", () => {
    expect(parseArchive(null)).toEqual([]);
    expect(parseArchive("non è json")).toEqual([]);
    expect(parseArchive('{"a":1}')).toEqual([]);
    const raw = JSON.stringify([
      entry("vecchia", T0, sample(2), "set"),
      { id: "rotta", at: T0 + 5, reason: "set", data: { settings: {} } },
      entry("nuova", T0 + 10_000, sample(4), "conflitto"),
      { id: "senza-data", reason: "set", data: sample(1) },
      entry("strana", T0 + 20_000, sample(3), "boh" as ArchiveEntry["reason"]),
    ]);
    const list = parseArchive(raw);
    expect(list.map((item) => item.id)).toEqual(["strana", "nuova", "vecchia"]);
    // Un motivo che non si riconosce vale «versione scartata»: la copia non si butta via per questo.
    expect(list[0].reason).toBe("conflitto");
    expect(list[1].data.events).toHaveLength(4);
  });

  test("una copia identica a una già presente non si ripete; oltre il massimo si perdono le più vecchie", () => {
    let list: ArchiveEntry[] = [];
    list = addToArchive(list, entry("a", T0, sample(2)));
    list = addToArchive(list, entry("b", T0 + 1, sample(3)));
    list = addToArchive(list, entry("c", T0 + 2, sample(2), "azzeramento"));
    // La terza ha lo stesso contenuto della prima: sta in testa una volta sola.
    expect(list.map((item) => item.id)).toEqual(["c", "b"]);
    expect(list[0].reason).toBe("azzeramento");

    let many: ArchiveEntry[] = [];
    for (let i = 0; i < MAX_ARCHIVE + 3; i++) many = addToArchive(many, entry(`x${i}`, T0 + i, sample(i + 1)));
    expect(many).toHaveLength(MAX_ARCHIVE);
    expect(many[0].id).toBe(`x${MAX_ARCHIVE + 2}`);
    expect(many.some((item) => item.id === "x0")).toBe(false);
  });

  test("se manca lo spazio si butta via la più vecchia, mai la più recente", () => {
    const list = [entry("nuova", T0 + 3, sample(3)), entry("media", T0 + 2, sample(2)), entry("vecchia", T0 + 1, sample(1))];
    expect(withoutOldest(list).map((item) => item.id)).toEqual(["nuova", "media"]);
    expect(withoutOldest(withoutOldest(withoutOldest(list)))).toEqual([]);
  });

  test("le copie di una partita passata (più di 90 giorni) o vuote si possono buttare via", () => {
    const now = T0 + 200 * DAY;
    expect(isArchiveStale([], now)).toBe(true);
    expect(isArchiveStale([entry("a", T0, sample(2))], now)).toBe(true);
    expect(isArchiveStale([entry("a", now - 10 * DAY, sample(2))], now)).toBe(false);
  });
});

test.describe("copia come file", () => {
  test("si scarica con partita, data e contenuto, e si rilegge uguale", () => {
    const data = sample(3);
    const exported = buildExport("m1", data, new Date(Date.UTC(2026, 9, 17, 16, 30)));
    expect(exported).toMatchObject({ app: "volley-lignano-scout", version: 1, matchId: "m1" });
    const result = parseImport(JSON.stringify(exported));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.matchId).toBe("m1");
      expect(result.data.events).toHaveLength(3);
      expect(result.data.roster.us[0].name).toBe("Giulia Bianchi");
    }
  });

  test("si accetta anche uno scout «nudo», e si rifiuta quello che non lo è, dicendo perché", () => {
    const bare = parseImport(JSON.stringify(sample(2)));
    expect(bare).toMatchObject({ ok: true, matchId: null });
    for (const text of ["", "non è json", "[1,2]", JSON.stringify({ app: "volley-lignano-scout", data: { settings: {} } }), JSON.stringify({ settings: {} })]) {
      const result = parseImport(text);
      expect(result.ok, text).toBe(false);
      if (!result.ok) expect(result.error).toContain("copia dello Scout");
    }
  });

  test("il nome del file è semplice: niente accenti né simboli", () => {
    const when = new Date(2026, 9, 17, 18, 5);
    expect(exportFileName("U15 vs Città di Lignano · 2ª gara", when)).toBe("scout-u15-vs-citta-di-lignano-2-gara-2026-10-17-1805.json");
    expect(exportFileName("???", when)).toBe("scout-partita-2026-10-17-1805.json");
  });
});
