import { expect, test } from "@playwright/test";
import { autoMatch, findCandidates, isOurTeam, nameSimilarity, nameTokens, ourSide } from "@/lib/federation/matching";
import { computeProposals, orientResult, sameResult } from "@/lib/federation/proposals";
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
    venue: null,
    homeSets: null,
    awaySets: null,
    sets: null,
    status: "da disputare",
    ...overrides,
  };
}

/** Gara giocata: 3-1 per la squadra di casa. */
const PLAYED = {
  homeSets: 3,
  awaySets: 1,
  sets: [
    { home: 25, away: 20 },
    { home: 22, away: 25 },
    { home: 25, away: 18 },
    { home: 25, away: 15 },
  ],
  status: "risultato ufficioso",
};

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

function propose(matches: Match[], officials: OfficialMatch[], decisions: FederationDecision[] = []) {
  return computeProposals({ category: "U15", girone: girone(officials), aliases: ALIASES, matches, decisions });
}

function decision(overrides: Partial<FederationDecision>): FederationDecision {
  return {
    category: "U15",
    externalId: "15001",
    decision: "linked",
    matchId: "m1",
    decidedBy: null,
    decidedAt: "2026-10-19T00:00:00Z",
    ...overrides,
  };
}

test.describe("riconoscimento dei nomi", () => {
  test("toglie sigle e parole generiche", () => {
    expect(nameTokens("A.S.D. Pol. Polisigma S.C.S.D.")).toEqual(["polisigma"]);
    expect(nameTokens("Città di Àquila")).toEqual(["citta", "aquila"]);
  });

  test("il nome scritto a mano combacia con squadra o società", () => {
    expect(nameSimilarity("Degano", ["DEGANO ROJALKENNEDY", "S.C.S.D. ROJALKENNEDY"])).toBe(1);
    expect(nameSimilarity("Rojalkennedy", ["DEGANO ROJALKENNEDY"])).toBe(1);
    expect(nameSimilarity("Cividale", ["ASFJR 1971", "VOLLEY CIVIDALE A.S.D."])).toBe(1);
    expect(nameSimilarity("Pav Bressa", ["Pizza D'Oro-PAV BRESSA"])).toBe(1);
    expect(nameSimilarity("Faedis", ["FACTORY VOLLEY FAEDIS", "PALLAVOLO FAEDIS"])).toBe(1);
  });

  test("nomi diversi non combaciano", () => {
    expect(nameSimilarity("Udine", ["BLU TEAM", null])).toBe(0);
    expect(nameSimilarity("Chei de Vile", ["DEGANO ROJALKENNEDY"])).toBe(0);
    expect(nameSimilarity("", ["BLU TEAM"])).toBe(0);
  });

  test("riconosce la nostra squadra dagli alias, non altre", () => {
    expect(isOurTeam("CDA VOLLEY LIGNANO", ALIASES)).toBe(true);
    expect(isOurTeam("cda volley lignano a.s.d.", ALIASES)).toBe(true);
    expect(isOurTeam("LIGNANO BEACH VOLLEY", ALIASES)).toBe(false);
    expect(isOurTeam("DEGANO ROJALKENNEDY", ALIASES)).toBe(false);
    expect(isOurTeam("DEGANO ROJALKENNEDY", [])).toBe(false);
  });

  test("lato della gara: casa, trasferta o nessuno", () => {
    expect(ourSide(official(), ALIASES)).toBe("home");
    expect(ourSide(official({ home: "BLU TEAM", away: "CDA VOLLEY LIGNANO" }), ALIASES)).toBe("away");
    expect(ourSide(official({ home: "BLU TEAM", away: "CHEI DE VILE" }), ALIASES)).toBeNull();
    expect(ourSide(official({ home: "CDA VOLLEY LIGNANO", away: "CDA VOLLEY LIGNANO" }), ALIASES)).toBeNull();
  });
});

test.describe("abbinamento partita ↔ gara", () => {
  test("stessa avversaria, stessa data, stesso lato", () => {
    expect(autoMatch(official(), [siteMatch()], ALIASES)?.id).toBe("m1");
  });

  test("un recupero di pochi giorni si riconosce, uno lontano no", () => {
    expect(autoMatch(official(), [siteMatch({ matchDate: "2026-10-21T11:00" })], ALIASES)?.id).toBe("m1");
    expect(autoMatch(official(), [siteMatch({ matchDate: "2026-10-25T11:00" })], ALIASES)).toBeNull();
  });

  test("casa e trasferta devono coincidere", () => {
    expect(autoMatch(official(), [siteMatch({ isHome: false })], ALIASES)).toBeNull();
  });

  test("un'altra avversaria non si abbina", () => {
    expect(autoMatch(official(), [siteMatch({ opponent: "Faedis" })], ALIASES)).toBeNull();
  });

  test("con due partite ugualmente plausibili non indovina", () => {
    const two = [siteMatch({ id: "a" }), siteMatch({ id: "b", matchDate: "2026-10-19T11:00" })];
    expect(findCandidates(official(), two, ALIASES)).toHaveLength(2);
    expect(autoMatch(official(), two, ALIASES)).toBeNull();
  });
});

test.describe("orientamento del risultato", () => {
  test("in casa il risultato resta com'è", () => {
    expect(orientResult(official(PLAYED), "home")).toEqual({
      us: 3,
      them: 1,
      sets: [
        { us: 25, them: 20 },
        { us: 22, them: 25 },
        { us: 25, them: 18 },
        { us: 25, them: 15 },
      ],
    });
  });

  test("in trasferta si ribalta, anche set per set", () => {
    const result = orientResult(official({ ...PLAYED, home: "BLU TEAM", away: "CDA VOLLEY LIGNANO" }), "away");
    expect(result).toMatchObject({ us: 1, them: 3 });
    expect(result?.sets?.[0]).toEqual({ us: 20, them: 25 });
  });

  test("gara non giocata: nessun risultato", () => {
    expect(orientResult(official(), "home")).toBeNull();
  });

  test("confronto con il risultato già inserito", () => {
    const result = orientResult(official(PLAYED), "home")!;
    const same = siteMatch({ resultSetsWon: 3, resultSetsLost: 1, setScores: result.sets });
    expect(sameResult(same, result)).toBe(true);
    expect(sameResult({ ...same, resultSetsWon: 3, resultSetsLost: 2 }, result)).toBe(false);
    const otherSets = [{ us: 25, them: 21 }, ...result.sets!.slice(1)];
    expect(sameResult({ ...same, setScores: otherSets }, result)).toBe(false);
  });
});

test.describe("proposte di risultato", () => {
  test("partita senza risultato e gara giocata: proposta «new»", () => {
    const { proposals } = propose([siteMatch()], [official(PLAYED)]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ kind: "new", linkedByAdmin: false, side: "home" });
    expect(proposals[0].match?.id).toBe("m1");
    expect(proposals[0].result).toMatchObject({ us: 3, them: 1 });
  });

  test("gara non ancora giocata: niente da proporre", () => {
    expect(propose([siteMatch()], [official()]).proposals).toEqual([]);
  });

  test("risultato già uguale: niente da proporre", () => {
    const result = orientResult(official(PLAYED), "home")!;
    const done = siteMatch({ resultSetsWon: 3, resultSetsLost: 1, setScores: result.sets });
    expect(propose([done], [official(PLAYED)]).proposals).toEqual([]);
  });

  test("risultato diverso scritto da voi: «conflict», e il vostro resta quello che è", () => {
    const mine = siteMatch({
      resultSetsWon: 3,
      resultSetsLost: 0,
      setScores: [
        { us: 25, them: 10 },
        { us: 25, them: 10 },
        { us: 25, them: 10 },
      ],
    });
    const { proposals } = propose([mine], [official(PLAYED)]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].kind).toBe("conflict");
    expect(proposals[0].match?.resultSetsLost).toBe(0);
  });

  test("risultato senza parziali leggibili: «no-sets»", () => {
    const { proposals } = propose(
      [siteMatch()],
      [official({ homeSets: 3, awaySets: 0, sets: null, status: "risultato ufficioso" })],
    );
    expect(proposals[0].kind).toBe("no-sets");
  });

  test("gara giocata senza partita nel sito: «unmatched», con le partite vicine da scegliere", () => {
    const near = siteMatch({ id: "near", opponent: "Altra", matchDate: "2026-10-22T11:00" });
    const far = siteMatch({ id: "far", opponent: "Altra", matchDate: "2026-12-22T11:00" });
    const { proposals } = propose([near, far], [official(PLAYED)]);
    expect(proposals[0].kind).toBe("unmatched");
    expect(proposals[0].candidates.map((m) => m.id)).toEqual(["near"]);
  });

  test("un abbinamento scelto da un admin vale anche se il nome non combacia", () => {
    const odd = siteMatch({ opponent: "Rojal", id: "m1" });
    const renamed = siteMatch({ id: "m1", opponent: "Squadra X" });
    expect(propose([renamed], [official(PLAYED)]).proposals[0].kind).toBe("unmatched");
    const linked = propose([renamed], [official(PLAYED)], [decision({})]);
    expect(linked.proposals[0]).toMatchObject({ kind: "new", linkedByAdmin: true });
    expect(odd.opponent).toBe("Rojal");
  });

  test("una gara ignorata non si ripropone e si può ripristinare", () => {
    const set = propose([siteMatch()], [official(PLAYED)], [decision({ decision: "dismissed", matchId: null })]);
    expect(set.proposals).toEqual([]);
    expect(set.dismissed).toHaveLength(1);
    expect(set.dismissed[0].official.externalId).toBe("15001");
  });

  test("amichevoli, tornei, altre categorie e Minivolley non hanno dati ufficiali", () => {
    const others = [
      siteMatch({ id: "a", isFriendly: true }),
      siteMatch({ id: "b", isTournament: true }),
      siteMatch({ id: "c", category: "U14" }),
      siteMatch({ id: "d", team: "minivolley", category: null }),
    ];
    const { proposals } = propose(others, [official(PLAYED)]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].kind).toBe("unmatched");
    expect(proposals[0].candidates).toEqual([]);
  });

  test("due gare non possono prendersi la stessa partita", () => {
    const firstLeg = official({ ...PLAYED, externalId: "1", date: "2026-10-18T11:00" });
    const secondLeg = official({ ...PLAYED, externalId: "2", date: "2026-10-20T11:00" });
    const { proposals } = propose([siteMatch()], [firstLeg, secondLeg]);
    const linked = proposals.filter((p) => p.match);
    expect(linked).toHaveLength(1);
  });

  test("alias sbagliato: nessuna proposta e segnalazione", () => {
    const set = computeProposals({
      category: "U15",
      girone: girone([official(PLAYED)]),
      aliases: ["NON ESISTE"],
      matches: [siteMatch()],
      decisions: [],
    });
    expect(set.proposals).toEqual([]);
    expect(set.aliasesNotFound).toBe(true);
  });
});
