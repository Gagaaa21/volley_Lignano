import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { computeCalendarImport, matchInputFromOfficial } from "@/lib/federation/calendarImport";
import { ourSide } from "@/lib/federation/matching";
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

test.describe("calendario ufficiale: partite cambiate sul portale", () => {
  test("stessa data e ora (anche nel formato con i secondi del database): nessun avviso", () => {
    expect(run([siteMatch()], [official()]).changes).toHaveLength(0);
    expect(run([siteMatch({ matchDate: "2026-10-18T11:00:00" })], [official()]).changes).toHaveLength(0);
  });

  test("ora o giorno diversi: la partita compare tra quelle cambiate, e non tra quelle da aggiungere", () => {
    const result = run([siteMatch({ matchDate: "2026-10-18T10:00" })], [official()]);
    expect(result.items).toHaveLength(0);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({ opponent: "DEGANO ROJALKENNEDY", side: "home" });
    expect(result.changes[0].match.id).toBe("m1");
    expect(result.changes[0].official.date).toBe("2026-10-18T11:00");
    expect(result.changes[0].changed).toEqual({ date: true, opponent: false, side: false });

    const nextDay = run([siteMatch({ matchDate: "2026-10-17T11:00" })], [official()]);
    expect(nextDay.changes).toHaveLength(1);
  });

  test("una partita abbinata da un admin si segnala anche con la data molto diversa", () => {
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
    expect(result.changes.map((change) => change.match.id)).toEqual(["m9"]);
  });

  test("già giocata (risultato nel sito o sul portale): niente da correggere", () => {
    const played = siteMatch({
      matchDate: "2026-10-17T11:00",
      setScores: [{ us: 25, them: 10 }],
      resultSetsWon: 1,
      resultSetsLost: 0,
    });
    expect(run([played], [official()]).changes).toHaveLength(0);
    const officialPlayed = official({ homeSets: 3, awaySets: 0, sets: [{ home: 25, away: 10 }] });
    expect(run([siteMatch({ matchDate: "2026-10-17T11:00" })], [officialPlayed]).changes).toHaveLength(0);
  });

  test("una partita simile ma non abbinata resta un dubbio da aggiungere, non una data cambiata", () => {
    const result = run([siteMatch({ matchDate: "2026-10-28T11:00" })], [official()]);
    expect(result.changes).toHaveLength(0);
    expect(result.items[0].kind).toBe("maybe-duplicate");
  });
});

test.describe("calendario ufficiale: avversaria o campo cambiati sul portale", () => {
  test("stessa data ma un'altra avversaria con lo stesso numero di gara: si segnala, non è solo un problema di data", () => {
    // Il sito ha «Degano» il 18/10; il portale ora dice che la gara 15001 è contro un'altra squadra.
    const result = run([siteMatch()], [official({ away: "BLU TEAM", awayClub: "A.S.D. BLU TEAM" })]);
    expect(result.items).toHaveLength(1); // la partita col vecchio nome non è più riconosciuta da sola
    const linked = run(
      [siteMatch()],
      [official({ away: "BLU TEAM", awayClub: "A.S.D. BLU TEAM" })],
      [
        {
          category: "U15",
          externalId: "15001",
          decision: "linked",
          matchId: "m1",
          decidedBy: null,
          decidedAt: "2026-10-01T00:00:00Z",
        },
      ],
    );
    expect(linked.items).toHaveLength(0);
    expect(linked.changes).toHaveLength(1);
    expect(linked.changes[0].changed).toEqual({ date: false, opponent: true, side: false });
    expect(linked.changes[0].opponent).toBe("BLU TEAM");
  });

  test("da casa a trasferta con lo stesso numero di gara: si segnala", () => {
    const decisions: FederationDecision[] = [
      { category: "U15", externalId: "15008", decision: "linked", matchId: "m1", decidedBy: null, decidedAt: "" },
    ];
    // Il sito ha la partita in casa contro BLU TEAM; il portale ora dice trasferta (stessa avversaria e data).
    const site = siteMatch({ opponent: "BLU TEAM", isHome: true, matchDate: "2026-10-31T16:00" });
    const result = run([site], [AWAY], decisions);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].changed).toEqual({ date: false, opponent: false, side: true });
  });

  test("il nome scritto a modo tuo non basta a far segnalare una partita giusta", () => {
    const decisions: FederationDecision[] = [
      { category: "U15", externalId: "15001", decision: "linked", matchId: "m1", decidedBy: null, decidedAt: "" },
    ];
    expect(run([siteMatch({ opponent: "Degano" })], [official()], decisions).changes).toHaveLength(0);
    expect(run([siteMatch({ opponent: "A.S.D. Degano Rojalkennedy" })], [official()], decisions).changes).toHaveLength(
      0,
    );
  });

  test("partita abbinata a un numero di gara che ora è di altre squadre: si segnala come non più in calendario", () => {
    const decisions: FederationDecision[] = [
      { category: "U15", externalId: "15002", decision: "linked", matchId: "m1", decidedBy: null, decidedAt: "" },
    ];
    // La gara 15002 esiste ancora ma è BLU TEAM - CHEI DE VILE (senza di noi).
    const result = run([siteMatch()], [official(), OTHER], decisions);
    expect(result.orphans.map((orphan) => [orphan.externalId, orphan.match.id])).toEqual([["15002", "m1"]]);
    // Un numero di gara che sparisce del tutto dai dati letti non si considera (potrebbe essere una lettura incompleta).
    expect(run([siteMatch()], [official()], decisions).orphans).toHaveLength(0);
    // Con un risultato già scritto non c'è più nulla da segnalare.
    const played = siteMatch({ setScores: [{ us: 25, them: 10 }], resultSetsWon: 1, resultSetsLost: 0 });
    expect(run([played], [official(), OTHER], decisions).orphans).toHaveLength(0);
  });
});

test.describe("calendario U14 girone A rivisto dalla federazione (ver2)", () => {
  const fixture = (name: string) => readFileSync(join(__dirname, "..", "e2e", "fixtures", "federation", name), "utf8");
  const v1 = parseGirone(fixture("u14-girone-a-calendario-v1.html")).girone;
  const v2 = parseGirone(fixture("u14-girone-a-calendario-v2.html")).girone;

  /** Come l'importazione: una partita per gara di Lignano del primo calendario, abbinata al suo numero. */
  function siteFromV1() {
    const matches: Match[] = [];
    const decisions: FederationDecision[] = [];
    for (const game of v1.matches) {
      const side = ourSide(game, ALIASES);
      if (!side) continue;
      const id = `site-${game.externalId}`;
      matches.push({ ...siteMatch(), ...matchInputFromOfficial("U14", game, side), id } as Match);
      decisions.push({
        category: "U14",
        externalId: game.externalId,
        decision: "linked",
        matchId: id,
        decidedBy: null,
        decidedAt: "",
      });
    }
    return { matches, decisions };
  }

  // Le 8 gare di CDA Volley Lignano nel PDF «Calendario Under 14 Femminile girone A ver2» della federazione.
  const PDF_V2 = [
    ["14000", "2026-10-25T11:00", "away", "ROJALKENNEDY ASSICOOP"],
    ["14004", "2026-10-31T15:30", "home", "VILLADIES"],
    ["14008", "2026-11-07T15:30", "away", "PAV BRESSA - Multiservice"],
    ["14013", "2026-11-14T15:30", "home", "SPORTING CLUB"],
    ["14018", "2026-11-21T16:00", "away", "HORIZON ANTARTIK"],
    ["14020", "2026-11-28T15:30", "home", "FUTURA-LIBERTAS"],
    ["14027", "2026-12-05T17:30", "away", "PROJECT VOLLEY OLIMPIA"],
    ["14035", "2026-12-19T15:30", "home", "GESTECO VOLLEYBAS"],
  ];

  test("la lettura del sito coincide con il PDF ufficiale ver2", () => {
    const ours = v2.matches
      .map((game) => ({ game, side: ourSide(game, ALIASES) }))
      .filter((entry) => entry.side)
      .map(({ game, side }) => [game.externalId, game.date, side, side === "home" ? game.away : game.home]);
    expect(ours).toEqual(PDF_V2);
  });

  test("le partite create dal primo calendario non coincidono più: tre cambiano avversaria, data e palestra", () => {
    const { matches, decisions } = siteFromV1();
    const result = computeCalendarImport({ category: "U14", girone: v2, aliases: ALIASES, matches, decisions });
    expect(result.items).toHaveLength(0);
    expect(result.alreadyPresent).toBe(8);
    expect(result.orphans).toHaveLength(0);
    expect(
      result.changes.map((change) => [
        change.official.externalId,
        change.match.opponent,
        change.opponent,
        change.changed,
      ]),
    ).toEqual([
      ["14000", "PAV BRESSA - Multiservice", "ROJALKENNEDY ASSICOOP", { date: true, opponent: true, side: false }],
      ["14008", "PROJECT VOLLEY OLIMPIA", "PAV BRESSA - Multiservice", { date: true, opponent: true, side: false }],
      ["14027", "ROJALKENNEDY ASSICOOP", "PROJECT VOLLEY OLIMPIA", { date: true, opponent: true, side: false }],
    ]);
  });

  test("chi aveva aggiornato solo la data (versione precedente del sito) vede ancora l'avversaria sbagliata", () => {
    const { matches, decisions } = siteFromV1();
    // Come dopo il vecchio «Aggiorna la data»: data nuova, avversaria e palestra vecchie.
    const patched = matches.map((match) => {
      const game = v2.matches.find((official) => `site-${official.externalId}` === match.id)!;
      return { ...match, matchDate: game.date };
    });
    const result = computeCalendarImport({
      category: "U14",
      girone: v2,
      aliases: ALIASES,
      matches: patched,
      decisions,
    });
    expect(result.changes.map((change) => [change.official.externalId, change.changed])).toEqual([
      ["14000", { date: false, opponent: true, side: false }],
      ["14008", { date: false, opponent: true, side: false }],
      ["14027", { date: false, opponent: true, side: false }],
    ]);
  });

  /**
   * Il sito pubblicato a ottobre: tre partite giuste (14004, 14018, 14035) e due create dal primo
   * calendario con la data già corretta dal vecchio «Aggiorna la data» ma avversaria e palestra vecchie.
   */
  function productionLike(linked: boolean) {
    const { matches, decisions } = siteFromV1();
    const keep = new Set(["14004", "14018", "14035", "14000", "14008"]);
    const kept = matches
      .filter((match) => keep.has(match.id.replace("site-", "")))
      .map((match) => {
        const game = v2.matches.find((official) => `site-${official.externalId}` === match.id)!;
        return { ...match, matchDate: game.date };
      });
    const ids = new Set(kept.map((match) => match.id));
    return {
      matches: kept,
      decisions: linked ? decisions.filter((decision) => ids.has(decision.matchId ?? "")) : [],
    };
  }

  test("sito reale, partite abbinate: due da correggere e tre da aggiungere", () => {
    const { matches, decisions } = productionLike(true);
    const result = computeCalendarImport({ category: "U14", girone: v2, aliases: ALIASES, matches, decisions });
    expect(result.alreadyPresent).toBe(5);
    expect(result.items.map((item) => [item.official.externalId, item.kind])).toEqual([
      ["14013", "new"],
      ["14020", "new"],
      ["14027", "new"],
    ]);
    expect(result.changes.map((change) => [change.official.externalId, change.changed])).toEqual([
      ["14000", { date: false, opponent: true, side: false }],
      ["14008", { date: false, opponent: true, side: false }],
    ]);
    expect(result.orphans).toHaveLength(0);
  });

  test("sito reale, partite mai abbinate: si segnalano comunque, senza creare doppioni", () => {
    const { matches, decisions } = productionLike(false);
    const result = computeCalendarImport({ category: "U14", girone: v2, aliases: ALIASES, matches, decisions });
    // Le tre giuste sono riconosciute da sole; le altre cinque gare mancano.
    expect(result.alreadyPresent).toBe(3);
    expect(result.items.map((item) => [item.official.externalId, item.kind])).toEqual([
      ["14000", "new"],
      ["14008", "maybe-duplicate"],
      ["14013", "new"],
      ["14020", "new"],
      ["14027", "new"],
    ]);
    // La partita contro il PROJECT OLIMPIA del 7/11 non corrisponde a nessuna gara ufficiale di Lignano.
    expect(result.orphans.map((orphan) => [orphan.externalId, orphan.match.opponent])).toEqual([
      [null, "PROJECT VOLLEY OLIMPIA"],
    ]);
  });

  test("allineate le tre partite al portale, non resta nulla da segnalare", () => {
    const { matches, decisions } = siteFromV1();
    const aligned = matches.map((match) => {
      const game = v2.matches.find((official) => `site-${official.externalId}` === match.id)!;
      const side = ourSide(game, ALIASES)!;
      return { ...match, ...matchInputFromOfficial("U14", game, side) };
    });
    const result = computeCalendarImport({
      category: "U14",
      girone: v2,
      aliases: ALIASES,
      matches: aligned,
      decisions,
    });
    expect(result.changes).toHaveLength(0);
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
