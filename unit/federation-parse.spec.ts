import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { decodeEntities, parseGirone, validateGirone } from "@/lib/federation/parse";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "e2e", "fixtures", "federation", name), "utf8");

test.describe("lettura del girone: U15 girone A non ancora iniziato", () => {
  const result = parseGirone(fixture("u15-girone-a-non-iniziato.html"));

  test("legge tutte le gare e la classifica", () => {
    expect(result.hasResultsTable).toBe(true);
    expect(result.hasStandingsTable).toBe(true);
    expect(result.skippedRows).toBe(0);
    expect(result.girone.matches).toHaveLength(30);
    expect(result.girone.standings).toHaveLength(6);
    expect(validateGirone(result)).toBeNull();
  });

  test("la prima gara di Lignano: data, squadre, palestra, nessun risultato", () => {
    const match = result.girone.matches.find((m) => m.externalId === "15001")!;
    expect(match).toMatchObject({
      round: 1,
      date: "2026-10-18T11:00",
      home: "CDA VOLLEY LIGNANO",
      away: "DEGANO ROJALKENNEDY",
      homeClub: "SSD VOLLEY TALMASSONS A R.L.",
      awayClub: "S.C.S.D. ROJALKENNEDY",
      homeSets: null,
      awaySets: null,
      sets: null,
      status: "da disputare",
    });
    expect(match.venue).toBe("Palestra Comunale (campo B), LIGNANO SABBIADORO UD, Viale Europa 144");
  });

  test("Lignano gioca 10 gare, 5 in casa", () => {
    const ours = result.girone.matches.filter(
      (m) => m.home === "CDA VOLLEY LIGNANO" || m.away === "CDA VOLLEY LIGNANO",
    );
    expect(ours).toHaveLength(10);
    expect(ours.filter((m) => m.home === "CDA VOLLEY LIGNANO")).toHaveLength(5);
  });

  test("la classifica ha sei squadre a zero punti", () => {
    expect(result.girone.standings.map((s) => s.team).sort()).toEqual([
      "ASFJR 1971",
      "BLU TEAM",
      "CDA VOLLEY LIGNANO",
      "CHEI DE VILE",
      "DEGANO ROJALKENNEDY",
      "FACTORY VOLLEY FAEDIS",
    ]);
    expect(result.girone.standings.every((s) => s.points === 0 && s.played === 0)).toBe(true);
    expect(result.girone.standings.map((s) => s.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

test.describe("lettura del girone: gare giocate", () => {
  const result = parseGirone(fixture("girone-con-partite-giocate.html"));

  test("legge risultati, parziali e stato", () => {
    expect(validateGirone(result)).toBeNull();
    const straight = result.girone.matches.find((m) => m.externalId === "5")!;
    expect(straight).toMatchObject({
      home: "ROJALKENNEDY EMPORIO ADV",
      away: "Pizza D'Oro-PAV BRESSA",
      homeSets: 3,
      awaySets: 0,
      status: "risultato ufficioso",
    });
    expect(straight.sets).toEqual([
      { home: 25, away: 16 },
      { home: 25, away: 15 },
      { home: 25, away: 10 },
    ]);
  });

  test("una partita a cinque set conserva i parziali nell'ordine di gioco", () => {
    const fiveSets = result.girone.matches.find((m) => m.externalId === "6")!;
    expect(fiveSets).toMatchObject({ homeSets: 2, awaySets: 3, status: "risultato ufficioso" });
    expect(fiveSets.sets).toEqual([
      { home: 28, away: 26 },
      { home: 29, away: 27 },
      { home: 19, away: 25 },
      { home: 15, away: 25 },
      { home: 9, away: 15 },
    ]);
  });

  test("una gara non giocata non ha risultato; lo stato «arbitro designato» resta «da disputare»", () => {
    const pending = result.girone.matches.filter((m) => m.homeSets === null);
    expect(pending.length).toBeGreaterThanOrEqual(3);
    expect(pending.every((m) => m.sets === null)).toBe(true);
    expect(new Set(pending.map((m) => m.status))).toEqual(new Set(["da disputare"]));
  });

  test("la classifica legge punti, set e punti fatti", () => {
    const first = result.girone.standings[0];
    expect(first.position).toBe(1);
    expect(first.team).toBe("ROJALKENNEDY EMPORIO ADV");
    expect(first).toMatchObject({
      points: 9,
      played: 3,
      won: 3,
      lost: 0,
      setsFor: 9,
      setsAgainst: 2,
      pointsFor: 268,
      pointsAgainst: 189,
    });
  });

  test("nessun nome di arbitro in ciò che si legge", () => {
    expect(JSON.stringify(result.girone).toLowerCase()).not.toContain("arbitro");
  });
});

test.describe("controlli di sicurezza sui dati letti", () => {
  test("una pagina senza le tabelle attese viene rifiutata", () => {
    const result = parseGirone("<html><body><h1>Manutenzione in corso</h1></body></html>");
    expect(validateGirone(result)).toMatch(/non contiene le tabelle/);
  });

  test("tabelle vuote vengono rifiutate", () => {
    const result = parseGirone(
      '<table class="tbl tbl-risultati"><tr><th>Gara</th></tr></table><table class="tbl tbl-classifica"><tr><th>Pos.</th></tr></table>',
    );
    expect(validateGirone(result)).not.toBeNull();
  });

  test("un risultato con parziali incoerenti non propone i set", () => {
    const html = `<table class="tbl tbl-risultati"><tr><th>Gara</th></tr>
      <tr><td>1</td><td>1</td><td>18/10/26 11:00</td><td>A</td><td>B</td><td class="risultato">3 - 0</td>
      <td class="risultato-dettagli"><span class="parziali">25-10</span><span class="parziali">10-25</span></td><td></td></tr></table>`;
    const match = parseGirone(html).girone.matches[0];
    expect(match.homeSets).toBe(3);
    expect(match.sets).toBeNull();
  });

  test("date non valide si saltano e si contano", () => {
    const html = `<table class="tbl tbl-risultati"><tr><th>Gara</th></tr>
      <tr><td>1</td><td>1</td><td>31/02/26 11:00</td><td>A</td><td>B</td><td>-</td><td></td><td></td></tr>
      <tr><td>2</td><td>1</td><td>da definire</td><td>A</td><td>B</td><td>-</td><td></td><td></td></tr>
      <tr><td>3</td><td>1</td><td>18/10/26 11:00</td><td>A</td><td>B</td><td>-</td><td></td><td></td></tr></table>`;
    const result = parseGirone(html);
    expect(result.girone.matches).toHaveLength(1);
    expect(result.skippedRows).toBe(2);
  });

  test("decodifica delle entità", () => {
    expect(decodeEntities("1&#176; &amp; Pizza D&#39;Oro &agrave; &#x41;")).toBe("1° & Pizza D'Oro à A");
  });
});
