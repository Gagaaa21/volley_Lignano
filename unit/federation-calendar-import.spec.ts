import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { computeCalendarImport, matchInputFromOfficial } from "@/lib/federation/calendarImport";
import { parseGirone } from "@/lib/federation/parse";
import type { FederationDecision, Girone, OfficialMatch } from "@/lib/federation/types";
import type { Match } from "@/lib/types";

const ALIASES = ["CDA VOLLEY LIGNANO"];

function official(overrides: Partial<OfficialMatch> = {}): OfficialMatch {
  return {
    externalId: "15001",
    round: 1,
    date: "2026-10-18T11:00",
    home: "CDA VOLLEY LIGNANO",
    away: "DEGANO ROJALKENNEDY",
    homeClub: "SSD VOLLEY TALMASSONS A R.L.",
    awayClub: "S.C.S.D. ROJALKENNEDY",
    venue: "Palestra Comunale (campo B), LIGNANO SABBIADORO UD, Viale Europa 144",
    homeSets: null,
    awaySets: null,
    sets: null,
    status: "da disputare",
    ...overrides,
  };
}

function siteMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    team: "u14u15",
    category: "U15",
    opponent: "Degano",
    isHome: true,
    location: "Palestra Comunale",
    matchDate: "2026-10-18T11:00",
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
    createdBy: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function girone(matches: OfficialMatch[]): Girone {
  return { matches, standings: [] };
}

function run(matches: Match[], officials: OfficialMatch[], decisions: FederationDecision[] = []) {
  return computeCalendarImport({ category: "U15", girone: girone(officials), aliases: ALIASES, matches, decisions });
}

// Altre gare del girone, senza la nostra squadra, e due gare nostre.
const OTHER = official({ externalId: "15002", home: "BLU TEAM", away: "CHEI DE VILE" });
const AWAY = official({
  externalId: "15008",
  round: 3,
  date: "2026-10-31T16:00",
  home: "BLU TEAM",
  away: "CDA VOLLEY LIGNANO",
  venue: "Palestra comunale, PAVIA DI UDINE UD, Via Carnia, 10",
});

test.describe("calendario ufficiale: partite che mancano nel sito", () => {
  test("tutte nuove quando il sito è vuoto; le gare senza la nostra squadra non contano", () => {
    const result = run([], [official(), OTHER, AWAY]);
    expect(result.total).toBe(2);
    expect(result.alreadyPresent).toBe(0);
    expect(result.items.map((item) => [item.official.externalId, item.kind, item.side, item.opponent])).toEqual([
      ["15001", "new", "home", "DEGANO ROJALKENNEDY"],
      ["15008", "new", "away", "BLU TEAM"],
    ]);
  });

  test("una partita già nel sito (anche con nome scritto a modo tuo) non viene riproposta", () => {
    const result = run([siteMatch()], [official(), AWAY]);
    expect(result.alreadyPresent).toBe(1);
    expect(result.items.map((item) => item.official.externalId)).toEqual(["15008"]);
  });

  test("una gara già abbinata da un admin non viene riproposta, anche con data molto diversa", () => {
    const moved = siteMatch({ id: "m9", matchDate: "2026-12-20T11:00", opponent: "Altro nome" });
    const decisions: FederationDecision[] = [
      {
        category: "U15",
        externalId: "15001",
        decision: "linked",
        matchId: "m9",
        decidedBy: null,
        decidedAt: "2026-10-01T00:00:00Z",
      },
    ];
    const result = run([moved], [official()], decisions);
    expect(result.items).toHaveLength(0);
    expect(result.alreadyPresent).toBe(1);
  });

  test("stessa avversaria ma data molto spostata: si segnala il dubbio invece di duplicare", () => {
    const moved = siteMatch({ matchDate: "2026-10-28T11:00" });
    const result = run([moved], [official()]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe("maybe-duplicate");
    expect(result.items[0].similar?.id).toBe("m1");
  });

  test("partita dell'altra categoria, amichevole o torneo: non contano", () => {
    const result = run(
      [
        siteMatch({ id: "a", category: "U14" }),
        siteMatch({ id: "b", isFriendly: true }),
        siteMatch({ id: "c", isTournament: true }),
        siteMatch({ id: "d", team: "minivolley", category: null }),
      ],
      [official()],
    );
    expect(result.items.map((item) => item.kind)).toEqual(["new"]);
  });

  test("una partita del sito non si usa per due gare diverse", () => {
    // Due gare contro la stessa avversaria in giorni vicini, una sola partita nel sito.
    const second = official({ externalId: "15024", date: "2026-10-20T11:00" });
    const result = run([siteMatch()], [official(), second]);
    expect(result.alreadyPresent).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});

test.describe("partita creata dalla gara ufficiale", () => {
  test("in casa: dati del portale, niente risultato né convocazioni", () => {
    const input = matchInputFromOfficial("U15", official(), "home");
    expect(input).toMatchObject({
      team: "u14u15",
      category: "U15",
      opponent: "DEGANO ROJALKENNEDY",
      isHome: true,
      isFriendly: false,
      isTournament: false,
      location: "Palestra Comunale (campo B), LIGNANO SABBIADORO UD, Viale Europa 144",
      matchDate: "2026-10-18T11:00",
      meetingTime: null,
      setScores: null,
      resultSetsWon: null,
      resultSetsLost: null,
      calledUpAthleteIds: [],
    });
  });

  test("in trasferta: l'avversaria è la squadra di casa", () => {
    const input = matchInputFromOfficial("U15", AWAY, "away");
    expect(input.opponent).toBe("BLU TEAM");
    expect(input.isHome).toBe(false);
  });

  test("senza palestra nel portale il luogo (obbligatorio) ha un segnaposto", () => {
    expect(matchInputFromOfficial("U15", official({ venue: null }), "home").location).toBe("Lignano Sabbiadoro");
    expect(matchInputFromOfficial("U15", AWAY, "away").location).not.toBe("");
    expect(
      matchInputFromOfficial("U15", official({ venue: "  ", home: "BLU TEAM", away: "CDA VOLLEY LIGNANO" }), "away")
        .location,
    ).toBe("Da definire");
  });
});

test.describe("calendario ufficiale: U15 girone A (pagina vera del portale)", () => {
  // Le 10 gare di CDA Volley Lignano, come nel file «Gare.xls» esportato dal portale.
  const EXPECTED = [
    ["15001", "2026-10-18T11:00", "home", "DEGANO ROJALKENNEDY"],
    ["15004", "2026-10-25T11:00", "home", "CHEI DE VILE"],
    ["15008", "2026-10-31T16:00", "away", "BLU TEAM"],
    ["15009", "2026-11-08T11:00", "away", "ASFJR 1971"],
    ["15012", "2026-11-15T11:00", "home", "FACTORY VOLLEY FAEDIS"],
    ["15016", "2026-11-22T11:00", "away", "DEGANO ROJALKENNEDY"],
    ["15019", "2026-11-28T16:00", "away", "CHEI DE VILE"],
    ["15023", "2026-12-06T11:00", "home", "BLU TEAM"],
    ["15024", "2026-12-13T11:00", "home", "ASFJR 1971"],
    ["15027", "2026-12-20T11:00", "away", "FACTORY VOLLEY FAEDIS"],
  ];

  test("con il sito vuoto mancano tutte e 10, uguali al file esportato dal portale", () => {
    const html = readFileSync(
      join(__dirname, "..", "e2e", "fixtures", "federation", "u15-girone-a-non-iniziato.html"),
      "utf8",
    );
    const { girone: parsed } = parseGirone(html);
    const result = run([], parsed.matches);
    expect(result.total).toBe(10);
    expect(
      result.items.map((item) => [item.official.externalId, item.official.date, item.side, item.opponent]),
    ).toEqual(EXPECTED);
    expect(result.items.every((item) => item.kind === "new")).toBe(true);
  });
});
