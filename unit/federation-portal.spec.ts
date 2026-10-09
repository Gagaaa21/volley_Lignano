import { expect, test } from "@playwright/test";
import { computePortalView, linkableGames, portalTodoCount } from "@/lib/federation/portal";
import type { FederationDecision, OfficialMatch } from "@/lib/federation/types";
import type { Match } from "@/lib/types";

/** Vista unica del portale: ogni gara ufficiale ha un solo stato, così la
 * stessa partita non compare mai in due elenchi con due domande diverse. */

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

/** La stessa gara, giocata: 3-1 per la squadra di casa (noi). */
function played(overrides: Partial<OfficialMatch> = {}): OfficialMatch {
  return official({
    homeSets: 3,
    awaySets: 1,
    sets: [
      { home: 25, away: 20 },
      { home: 22, away: 25 },
      { home: 25, away: 18 },
      { home: 25, away: 15 },
    ],
    status: "risultato ufficioso",
    ...overrides,
  });
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

function view(matches: Match[], officials: OfficialMatch[], decisions: FederationDecision[] = []) {
  return computePortalView({
    category: "U15",
    girone: { matches: officials, standings: [] },
    aliases: ALIASES,
    matches,
    decisions,
  });
}

function statusOf(result: ReturnType<typeof view>, externalId: string) {
  return result.games.find((game) => game.official.externalId === externalId)?.status;
}

test.describe("portale: un solo stato per gara", () => {
  test("gara da giocare già nel sito e uguale: in ordine, niente da fare", () => {
    const result = view([siteMatch()], [official()]);
    expect(statusOf(result, "15001")).toBe("ok");
    expect(result.games[0].match?.id).toBe("m1");
    expect(portalTodoCount(result)).toBe(0);
  });

  test("gara da giocare che manca: da aggiungere, ma non è una cosa da sistemare", () => {
    const result = view([], [official()]);
    expect(statusOf(result, "15001")).toBe("to-add");
    expect(portalTodoCount(result)).toBe(0);
  });

  test("data cambiata sul portale: «changed» con la partita del sito", () => {
    const result = view([siteMatch({ matchDate: "2026-10-18T15:00" })], [official()]);
    expect(statusOf(result, "15001")).toBe("changed");
    expect(result.games[0].changed).toEqual({ date: true, opponent: false, side: false });
    expect(portalTodoCount(result)).toBe(1);
  });

  test("giocata, partita del sito senza risultato: risultato da confermare", () => {
    const result = view([siteMatch()], [played()]);
    expect(statusOf(result, "15001")).toBe("result");
    expect(result.games[0].result).toMatchObject({ us: 3, them: 1 });
    expect(portalTodoCount(result)).toBe(1);
  });

  test("giocata, risultato del sito diverso: «conflict»; uguale: in ordine", () => {
    const different = view(
      [siteMatch({ resultSetsWon: 3, resultSetsLost: 0, setScores: [{ us: 25, them: 10 }, { us: 25, them: 10 }, { us: 25, them: 10 }] })],
      [played()],
    );
    expect(statusOf(different, "15001")).toBe("conflict");
    const same = view(
      [
        siteMatch({
          resultSetsWon: 3,
          resultSetsLost: 1,
          setScores: [
            { us: 25, them: 20 },
            { us: 22, them: 25 },
            { us: 25, them: 18 },
            { us: 25, them: 15 },
          ],
        }),
      ],
      [played()],
    );
    expect(statusOf(same, "15001")).toBe("ok");
  });

  test("giocata e nel sito non c'è: compare una volta sola, come «played-missing» (non anche da aggiungere)", () => {
    const result = view([], [played()]);
    expect(result.games).toHaveLength(1);
    expect(statusOf(result, "15001")).toBe("played-missing");
    expect(portalTodoCount(result)).toBe(1);
  });

  test("risultato senza parziali: si aspetta, non è una cosa da sistemare", () => {
    const result = view([siteMatch()], [played({ sets: null })]);
    expect(statusOf(result, "15001")).toBe("waiting-sets");
    expect(portalTodoCount(result)).toBe(0);
  });

  test("partita simile una settimana dopo: «maybe-same», e quella partita non è anche «senza gara»", () => {
    const moved = siteMatch({ id: "moved", matchDate: "2026-10-25T11:00" });
    const result = view([moved], [official()]);
    expect(statusOf(result, "15001")).toBe("maybe-same");
    expect(result.games[0].similar?.id).toBe("moved");
    expect(result.orphans).toHaveLength(0);
    expect(portalTodoCount(result)).toBe(1);
  });

  test("partita del sito senza nessuna gara ufficiale: si conta tra le cose da sistemare", () => {
    const ghost = siteMatch({ id: "ghost", opponent: "Squadra fantasma", matchDate: "2026-11-20T18:00" });
    const result = view([ghost], [official({ externalId: "15002", home: "BLU TEAM", away: "CHEI DE VILE" })]);
    expect(result.orphans.map((orphan) => orphan.match.id)).toEqual(["ghost"]);
    expect(portalTodoCount(result)).toBe(1);
  });

  test("gara ignorata da un admin: «dismissed», non si conta", () => {
    const result = view(
      [],
      [played()],
      [
        {
          category: "U15",
          externalId: "15001",
          decision: "dismissed",
          matchId: null,
          decidedBy: null,
          decidedAt: "2026-10-19T10:00:00Z",
        },
      ],
    );
    expect(statusOf(result, "15001")).toBe("dismissed");
    expect(portalTodoCount(result)).toBe(0);
  });

  test("gare a cui si può collegare una partita del sito: solo quelle che nel sito non ci sono", () => {
    const result = view(
      [siteMatch()],
      [
        official(),
        official({ externalId: "15002", date: "2026-11-01T11:00", away: "BLU TEAM", awayClub: null }),
        played({ externalId: "15003", date: "2026-10-11T11:00", away: "CHEI DE VILE", awayClub: null }),
      ],
    );
    expect(linkableGames(result).map((game) => game.official.externalId).sort()).toEqual(["15002", "15003"]);
  });
});
