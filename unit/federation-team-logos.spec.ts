import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import type { StandingRow } from "@/lib/federation/types";
import { logoProxyUrl, opponentLogoFor, pickOpponentLogo, type LogoTeam } from "@/lib/federation/teamLogos";

/** Il logo dell'avversaria dal girone: abbinamento dei nomi, logo scelto a mano, ambiguità e memoria delle classifiche. */

const DEGANO = "https://udine.federvolley.it/logos/degano.png";
const CIVIDALE = "https://udine.federvolley.it/logos/cividale.png";

const rows: LogoTeam[] = [
  { team: "DEGANO ROJALKENNEDY", logoUrl: DEGANO },
  { team: "VOLLEY CIVIDALE A.S.D.", logoUrl: CIVIDALE },
  { team: "FUTURA-LIBERTAS", logoUrl: null },
  { team: "PAV BRESSA - Multiservice", logoUrl: null },
  { team: "CDA VOLLEY LIGNANO", logoUrl: "https://udine.federvolley.it/logos/lignano.png" },
];

const OURS = ["CDA VOLLEY LIGNANO"];

test.describe("abbinamento del nome con la classifica", () => {
  test("un nome corto o scritto un po' diverso trova la squadra del girone, e il logo passa dal nostro sito", () => {
    expect(pickOpponentLogo(rows, "Degano", { ourAliases: OURS })).toBe(logoProxyUrl(DEGANO));
    expect(pickOpponentLogo(rows, "DEGANO ROJALKENNEDY", { ourAliases: OURS })).toBe(logoProxyUrl(DEGANO));
    expect(pickOpponentLogo(rows, "Pol. Cividale", { ourAliases: OURS })).toBe(logoProxyUrl(CIVIDALE));
    expect(pickOpponentLogo(rows, "  cividale  ", { ourAliases: OURS })).toBe(logoProxyUrl(CIVIDALE));
  });

  test("l'indirizzo del portale si codifica: finisce nella richiesta al nostro sito", () => {
    const url = "https://udine.federvolley.it/img/logo.aspx?id=12&x=a b";
    expect(logoProxyUrl(url)).toBe(`/api/federation/logo?u=${encodeURIComponent(url)}`);
    expect(logoProxyUrl(url)).not.toContain("&x=");
  });

  test("la nostra squadra non è mai l'avversaria", () => {
    expect(pickOpponentLogo(rows, "Lignano", { ourAliases: OURS })).toBeNull();
    // Senza dire chi siamo, invece, la trova come qualunque altra.
    expect(pickOpponentLogo(rows, "Lignano")).toBe(logoProxyUrl("https://udine.federvolley.it/logos/lignano.png"));
  });

  test("il logo scelto a mano vale più di quello del portale, anche se il portale non ne ha", () => {
    const manual = (team: string) => (team === "FUTURA-LIBERTAS" ? "/_next/static/media/futura.png" : team === "DEGANO ROJALKENNEDY" ? "/_next/static/media/degano.png" : null);
    expect(pickOpponentLogo(rows, "Futura Libertas", { ourAliases: OURS, manualLogo: manual })).toBe("/_next/static/media/futura.png");
    expect(pickOpponentLogo(rows, "Degano", { ourAliases: OURS, manualLogo: manual })).toBe("/_next/static/media/degano.png");
  });

  test("una squadra senza logo, o che nel girone non c'è, non ne ha uno (restano le iniziali)", () => {
    expect(pickOpponentLogo(rows, "Pav Bressa", { ourAliases: OURS })).toBeNull();
    expect(pickOpponentLogo(rows, "Pol. Esempio", { ourAliases: OURS })).toBeNull();
    expect(pickOpponentLogo(rows, "", { ourAliases: OURS })).toBeNull();
    expect(pickOpponentLogo(rows, "A.S.D.", { ourAliases: OURS })).toBeNull();
  });

  test("più squadre ugualmente somiglianti: non si sceglie, salvo che una abbia proprio quelle parole", () => {
    const twins: LogoTeam[] = [
      { team: "UDINE BLU", logoUrl: "https://udine.federvolley.it/logos/blu.png" },
      { team: "UDINE ROSSA", logoUrl: "https://udine.federvolley.it/logos/rossa.png" },
    ];
    expect(pickOpponentLogo(twins, "Udine")).toBeNull();
    expect(pickOpponentLogo(twins, "Udine Blu")).toBe(logoProxyUrl("https://udine.federvolley.it/logos/blu.png"));
    const withSame: LogoTeam[] = [{ team: "UDINE", logoUrl: "https://udine.federvolley.it/logos/udine.png" }, ...twins];
    expect(pickOpponentLogo(withSame, "Udine")).toBe(logoProxyUrl("https://udine.federvolley.it/logos/udine.png"));
  });
});

function standing(team: string, logoUrl: string | null): StandingRow {
  return { position: 1, team, points: 0, played: 0, won: 0, lost: 0, setsFor: 0, setsAgainst: 0, pointsFor: 0, pointsAgainst: 0, penalty: 0, logoUrl };
}

const snapshot = (category: "U14" | "U15", standings: StandingRow[]) => ({
  category,
  girone: { matches: [], standings },
  fetchedAt: "2026-10-17T09:00:00.000Z",
  lastError: null,
  lastErrorAt: null,
});

test.describe("lettura dalle classifiche salvate", () => {
  test("trova il logo nel girone della categoria, e solo lì (senza categoria li guarda tutti)", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    await repo.saveFederationSnapshot(snapshot("U15", [standing("DEGANO ROJALKENNEDY", DEGANO), standing("CDA VOLLEY LIGNANO", null)]));
    await repo.saveFederationSnapshot(snapshot("U14", [standing("VOLLEY CIVIDALE A.S.D.", CIVIDALE)]));
    expect(await opponentLogoFor(repo, "U15", "Degano")).toBe(logoProxyUrl(DEGANO));
    expect(await opponentLogoFor(repo, "U14", "Degano")).toBeNull();
    expect(await opponentLogoFor(repo, null, "Cividale")).toBe(logoProxyUrl(CIVIDALE));
    expect(await opponentLogoFor(repo, "U15", "Lignano")).toBeNull();
    expect(await opponentLogoFor(repo, "U15", "  ")).toBeNull();
  });

  test("senza classifiche salvate niente logo, e nessun errore", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    expect(await opponentLogoFor(repo, "U15", "Degano")).toBeNull();
  });

  test("le classifiche si tengono in memoria 10 minuti, poi si rileggono", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    await repo.saveFederationSnapshot(snapshot("U15", [standing("DEGANO ROJALKENNEDY", DEGANO)]));
    const t0 = Date.UTC(2026, 9, 17, 10, 0, 0);
    expect(await opponentLogoFor(repo, "U15", "Degano", { now: t0 })).toBe(logoProxyUrl(DEGANO));
    // La classifica cambia (nuovo logo), ma dentro i 10 minuti si legge quella di prima.
    await repo.saveFederationSnapshot(snapshot("U15", [standing("DEGANO ROJALKENNEDY", CIVIDALE)]));
    expect(await opponentLogoFor(repo, "U15", "Degano", { now: t0 + 9 * 60_000 })).toBe(logoProxyUrl(DEGANO));
    expect(await opponentLogoFor(repo, "U15", "Degano", { now: t0 + 10 * 60_000 + 1 })).toBe(logoProxyUrl(CIVIDALE));
  });

  test("ogni archivio ha la sua memoria: due repository non si mescolano", async () => {
    const a = createMemoryRepo(createEmptyStore());
    const b = createMemoryRepo(createEmptyStore());
    await a.saveFederationSnapshot(snapshot("U15", [standing("DEGANO ROJALKENNEDY", DEGANO)]));
    expect(await opponentLogoFor(a, "U15", "Degano")).toBe(logoProxyUrl(DEGANO));
    expect(await opponentLogoFor(b, "U15", "Degano")).toBeNull();
  });

  test("se la lettura fallisce niente logo, e si riprova solo dopo un minuto", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    let calls = 0;
    const failing = {
      listFederationSnapshots: async () => {
        calls += 1;
        throw new Error("tabella mancante");
      },
      listFederationSources: repo.listFederationSources,
    };
    const originalError = console.error;
    console.error = () => {};
    try {
      const t0 = Date.UTC(2026, 9, 17, 10, 0, 0);
      expect(await opponentLogoFor(failing, "U15", "Degano", { now: t0 })).toBeNull();
      expect(await opponentLogoFor(failing, "U15", "Degano", { now: t0 + 30_000 })).toBeNull();
      expect(calls).toBe(1);
      expect(await opponentLogoFor(failing, "U15", "Degano", { now: t0 + 61_000 })).toBeNull();
      expect(calls).toBe(2);
    } finally {
      console.error = originalError;
    }
  });
});
