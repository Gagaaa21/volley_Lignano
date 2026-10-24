import { expect, test } from "@playwright/test";
import {
  callUpsNotice,
  deletedMatchNotice,
  matchChangeNotice,
  matchNoticeTag,
  matchNoticeUrl,
  matchupLabel,
  newMatchNotice,
  resultNotice,
} from "@/lib/matchNotices";
import type { MatchInput } from "@/lib/types";

/** Le notifiche delle partite dicono che cosa è cambiato, e non partono se non è cambiato niente che interessi alle famiglie. */

function match(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    team: "u14u15",
    category: "U15",
    opponent: "Pol. Codroipo",
    isHome: false,
    isFriendly: false,
    isTournament: false,
    location: "Palazzetto di Codroipo",
    matchDate: "2026-10-28T18:00",
    meetingTime: null,
    meetingLocation: null,
    notes: null,
    calledUpAthleteIds: [],
    setScores: null,
    resultSetsWon: null,
    resultSetsLost: null,
    tournamentGames: null,
    ...overrides,
  };
}

test.describe("chi gioca e dove porta la notifica", () => {
  test("«vs» in casa, «@» in trasferta, il nome del torneo da solo, l'amichevole davanti", () => {
    expect(matchupLabel(match())).toBe("Under 15 @ Pol. Codroipo");
    expect(matchupLabel(match({ isHome: true }))).toBe("Under 15 vs Pol. Codroipo");
    expect(matchupLabel(match({ isFriendly: true, isHome: true }))).toBe("Amichevole Under 15 vs Pol. Codroipo");
    expect(matchupLabel(match({ isTournament: true, opponent: "Triangolare di Natale" }))).toBe("Under 15 · Triangolare di Natale");
  });

  test("il link apre il calendario sul mese della partita e sulla sua categoria; il tag è uno per partita", () => {
    expect(matchNoticeUrl(match())).toBe("/?month=2026-10&cat=U15");
    expect(matchNoticeUrl(match({ category: "U14", matchDate: "2026-11-02T17:30" }))).toBe("/?month=2026-11&cat=U14");
    expect(matchNoticeUrl(match({ team: "minivolley", category: null }))).toBe("/minivolley?month=2026-10");
    expect(matchNoticeTag("abc")).toBe("partita-abc");
  });

  test("partita nuova e partita tolta", () => {
    expect(newMatchNotice(match())).toEqual({ title: "Nuova partita", body: "Under 15 @ Pol. Codroipo · mer 28 ottobre, 18:00 · Palazzetto di Codroipo" });
    expect(deletedMatchNotice(match()).body).toBe("Under 15 @ Pol. Codroipo · mer 28 ottobre, 18:00: non è più in calendario.");
  });
});

test.describe("partita modificata: si dice che cosa è cambiato", () => {
  test("solo l'orario: «Cambio orario», con quello nuovo e quello di prima", () => {
    expect(matchChangeNotice(match(), match({ matchDate: "2026-10-28T17:30" }))).toEqual({
      title: "Cambio orario",
      body: "Under 15 @ Pol. Codroipo · si gioca alle 17:30 (prima 18:00)",
    });
  });

  test("la data (con o senza l'orario)", () => {
    expect(matchChangeNotice(match(), match({ matchDate: "2026-10-31T18:00" }))).toEqual({
      title: "Cambio data",
      body: "Under 15 @ Pol. Codroipo · si gioca sab 31 ottobre, 18:00 (prima mer 28 ottobre)",
    });
    expect(matchChangeNotice(match(), match({ matchDate: "2026-10-31T16:00" }))?.body).toBe(
      "Under 15 @ Pol. Codroipo · si gioca sab 31 ottobre, 16:00 (prima mer 28 ottobre, 18:00)",
    );
  });

  test("il luogo, il ritrovo e una nota nuova; data e orario si ricordano sempre", () => {
    expect(matchChangeNotice(match(), match({ location: "Palestra Comunale di Codroipo" }))).toEqual({
      title: "Cambio luogo",
      body: "Under 15 @ Pol. Codroipo · mer 28 ottobre, 18:00 · nuovo luogo: Palestra Comunale di Codroipo",
    });
    expect(matchChangeNotice(match(), match({ meetingTime: "17:00", meetingLocation: "Parcheggio del palazzetto" }))).toEqual({
      title: "Ritrovo aggiornato",
      body: "Under 15 @ Pol. Codroipo · mer 28 ottobre, 18:00 · ritrovo alle 17:00 a Parcheggio del palazzetto",
    });
    expect(matchChangeNotice(match({ meetingTime: "17:00" }), match())?.body).toContain("ritrovo come la partita");
    expect(matchChangeNotice(match(), match({ notes: "Portare la seconda maglia" }))).toEqual({
      title: "Nota sulla partita",
      body: "Under 15 @ Pol. Codroipo · mer 28 ottobre, 18:00 · nota: Portare la seconda maglia",
    });
  });

  test("più cose insieme: il titolo le elenca", () => {
    const notice = matchChangeNotice(match(), match({ matchDate: "2026-10-28T17:30", location: "Palestra B", meetingTime: "17:00" }));
    expect(notice?.title).toBe("Cambiano orario, luogo e ritrovo");
    expect(notice?.body).toBe("Under 15 @ Pol. Codroipo · si gioca alle 17:30 (prima 18:00) · nuovo luogo: Palestra B · ritrovo alle 17:00");
  });

  test("casa o trasferta, amichevole, avversaria: «Partita aggiornata»", () => {
    expect(matchChangeNotice(match(), match({ isHome: true }))).toEqual({
      title: "Partita aggiornata",
      body: "Under 15 vs Pol. Codroipo · mer 28 ottobre, 18:00 · ora in casa",
    });
    expect(matchChangeNotice(match(), match({ opponent: "Pol. Codroipo B" }))?.body).toBe("Under 15 @ Pol. Codroipo B · mer 28 ottobre, 18:00");
  });

  test("niente notifica se non cambia niente che interessi: stesso valore, spazi in più, nota tolta", () => {
    expect(matchChangeNotice(match(), match())).toBeNull();
    expect(matchChangeNotice(match(), match({ location: " Palazzetto di Codroipo ", meetingLocation: "", notes: "" }))).toBeNull();
    expect(matchChangeNotice(match({ notes: "Vecchia nota" }), match({ notes: null }))).toBeNull();
    // Le convocazioni e il risultato hanno le loro notifiche.
    expect(matchChangeNotice(match(), match({ calledUpAthleteIds: ["a1"], resultSetsWon: 3, resultSetsLost: 0 }))).toBeNull();
  });

  test("una nota lunga si accorcia", () => {
    const notes = "Portare ".repeat(30);
    const body = matchChangeNotice(match(), match({ notes }))!.body;
    expect(body.length).toBeLessThan(150);
    expect(body.endsWith("…")).toBe(true);
  });
});

test.describe("risultato e convocazioni", () => {
  const none = { setScores: null, resultSetsWon: null, resultSetsLost: null, tournamentGames: null };

  test("il risultato: vinta o persa, con i parziali; niente se non c'è o è lo stesso", () => {
    const won = { ...none, setScores: [{ us: 25, them: 20 }, { us: 22, them: 25 }, { us: 25, them: 18 }, { us: 25, them: 21 }], resultSetsWon: 3, resultSetsLost: 1 };
    expect(resultNotice(match(), none, won)).toEqual({ title: "Vinta 3-1", body: "Under 15 @ Pol. Codroipo · mer 28 ottobre (25-20 22-25 25-18 25-21)" });
    const lost = { ...none, setScores: [{ us: 20, them: 25 }, { us: 18, them: 25 }, { us: 21, them: 25 }], resultSetsWon: 0, resultSetsLost: 3 };
    expect(resultNotice(match(), none, lost)?.title).toBe("Persa 0-3");
    expect(resultNotice(match(), won, won)).toBeNull();
    expect(resultNotice(match(), won, none)).toBeNull();
  });

  test("i risultati di un torneo, partita per partita", () => {
    const games = {
      ...none,
      tournamentGames: [
        { id: "g1", opponent: "Latisana", setScores: [{ us: 25, them: 20 }, { us: 25, them: 22 }] },
        { id: "g2", opponent: "Concordia", setScores: [{ us: 20, them: 25 }, { us: 25, them: 23 }, { us: 13, them: 15 }] },
        { id: "g3", opponent: "Da giocare", setScores: [] },
      ],
    };
    expect(resultNotice(match({ isTournament: true, opponent: "Triangolare" }), none, games)).toEqual({
      title: "Risultati del torneo",
      body: "Under 15 · Triangolare: vinta 2-0 con Latisana, persa 1-2 con Concordia",
    });
  });

  test("le convocazioni: quante e il ritrovo, mai i nomi; niente se la lista è la stessa o vuota", () => {
    expect(callUpsNotice(match({ meetingTime: "17:00" }), [], ["a1", "a2", "a3"])).toEqual({
      title: "Convocazioni pronte",
      body: "Under 15 @ Pol. Codroipo · mer 28 ottobre, 18:00 · 3 convocate · ritrovo alle 17:00",
    });
    expect(callUpsNotice(match(), ["a1", "a2"], ["a2", "a3"])?.title).toBe("Convocazioni aggiornate");
    expect(callUpsNotice(match(), ["a1"], ["a1"])?.body).toBeUndefined();
    expect(callUpsNotice(match(), ["a1", "a2"], ["a2", "a1"])).toBeNull();
    expect(callUpsNotice(match(), ["a1"], [])).toBeNull();
    expect(callUpsNotice(match(), [], ["a1"])?.body).toContain("1 convocata");
  });
});
