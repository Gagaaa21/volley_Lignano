import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { newFamilyToken } from "@/lib/availability/token";
import type { AthleteInput, MatchInput } from "@/lib/types";

/**
 * L'archivio dei link per i genitori e delle non disponibilità (lo stesso che usa la modalità prova). Con Supabase il
 * comportamento è lo stesso (vedi schema.sql).
 */

const matchInput: MatchInput = {
  team: "u14u15",
  category: "U14",
  opponent: "Degano",
  isHome: false,
  location: "Palestra",
  matchDate: "2026-11-21T18:00",
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
};

const athleteInput = (fullName: string): AthleteInput => ({
  fullName,
  team: "u14u15",
  category: "U14",
  group: null,
  jerseyNumber: null,
  isActive: true,
  notes: null,
});

test.describe("link dei genitori nell'archivio", () => {
  test("si crea una volta sola: chiedendolo ancora si riceve lo stesso codice", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);

    const first = await repo.ensureAthleteFamilyLink(anna.id, "codice-uno");
    expect(first.token).toBe("codice-uno");
    expect(first.rotatedAt).toBeNull();

    const again = await repo.ensureAthleteFamilyLink(anna.id, "codice-due");
    expect(again.token).toBe("codice-uno");
    expect(await repo.listAthleteFamilyLinks()).toHaveLength(1);
  });

  test("dal codice si arriva a quell'atleta e a nessun'altra; un codice che non c'è non dà niente", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    const bea = await repo.createAthlete(athleteInput("Bea Rossi"), null);
    const a = await repo.ensureAthleteFamilyLink(anna.id, newFamilyToken());
    const b = await repo.ensureAthleteFamilyLink(bea.id, newFamilyToken());

    expect((await repo.findAthleteByFamilyToken(a.token))?.fullName).toBe("Anna Bianchi");
    expect((await repo.findAthleteByFamilyToken(b.token))?.fullName).toBe("Bea Rossi");
    expect(await repo.findAthleteByFamilyToken(newFamilyToken())).toBeNull();
    expect(await repo.findAthleteByFamilyToken("")).toBeNull();
  });

  test("rigenerarlo cambia il codice: il vecchio smette subito di funzionare", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    const old = await repo.ensureAthleteFamilyLink(anna.id, "vecchio");

    const fresh = await repo.rotateAthleteFamilyLink(anna.id, "nuovo");
    expect(fresh.token).toBe("nuovo");
    expect(fresh.rotatedAt).not.toBeNull();
    expect(fresh.createdAt).toBe(old.createdAt);
    expect(await repo.findAthleteByFamilyToken("vecchio")).toBeNull();
    expect((await repo.findAthleteByFamilyToken("nuovo"))?.id).toBe(anna.id);
    expect(await repo.listAthleteFamilyLinks()).toHaveLength(1);

    // Rigenerare chi non l'aveva ancora lo crea.
    const bea = await repo.createAthlete(athleteInput("Bea Rossi"), null);
    expect((await repo.rotateAthleteFamilyLink(bea.id, "primo")).token).toBe("primo");
  });

  test("senza l'atleta non c'è un link da creare", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    await expect(repo.ensureAthleteFamilyLink("non-esiste", "x")).rejects.toThrow(/Atleta non trovata/);
    await expect(repo.rotateAthleteFamilyLink("non-esiste", "x")).rejects.toThrow(/Atleta non trovata/);
  });

  test("quello che si riceve è una copia: cambiarla non cambia l'archivio", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    const link = await repo.ensureAthleteFamilyLink(anna.id, "codice");
    link.token = "manomesso";
    expect((await repo.listAthleteFamilyLinks())[0].token).toBe("codice");
    const found = await repo.findAthleteByFamilyToken("codice");
    if (found) found.fullName = "Altro";
    expect((await repo.getAthlete(anna.id))?.fullName).toBe("Anna Bianchi");
  });
});

test.describe("non disponibilità nell'archivio", () => {
  test("una riga per partita e atleta: segnarla di nuovo la aggiorna, non la duplica", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);

    const first = await repo.setMatchUnavailability({
      matchId: match.id,
      athleteId: anna.id,
      reason: "malata",
      note: null,
      reportedBy: "parent",
      updatedBy: null,
    });
    expect(first.reason).toBe("malata");
    expect(first.reportedAt).toBeTruthy();

    const second = await repo.setMatchUnavailability({
      matchId: match.id,
      athleteId: anna.id,
      reason: "famiglia",
      note: "matrimonio",
      reportedBy: "staff",
      updatedBy: "staff-1",
    });
    expect(second.reportedBy).toBe("staff");

    const all = await repo.listMatchUnavailability();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ reason: "famiglia", note: "matrimonio", reportedBy: "staff", updatedBy: "staff-1" });
  });

  test("si filtra per partite o per atleta; un elenco di partite vuoto non dà niente", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const m1 = await repo.createMatch(matchInput, null);
    const m2 = await repo.createMatch({ ...matchInput, opponent: "Cividale" }, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    const bea = await repo.createAthlete(athleteInput("Bea Rossi"), null);
    const mark = (matchId: string, athleteId: string) =>
      repo.setMatchUnavailability({ matchId, athleteId, reason: null, note: null, reportedBy: "parent", updatedBy: null });
    await mark(m1.id, anna.id);
    await mark(m1.id, bea.id);
    await mark(m2.id, anna.id);

    expect(await repo.listMatchUnavailability()).toHaveLength(3);
    expect(await repo.listMatchUnavailability({ matchIds: [m1.id] })).toHaveLength(2);
    expect(await repo.listMatchUnavailability({ matchIds: [m1.id, m2.id] })).toHaveLength(3);
    expect(await repo.listMatchUnavailability({ athleteId: anna.id })).toHaveLength(2);
    expect(await repo.listMatchUnavailability({ matchIds: [m2.id], athleteId: bea.id })).toHaveLength(0);
    expect(await repo.listMatchUnavailability({ matchIds: [] })).toEqual([]);
  });

  test("si toglie con clear; toglierne una che non c'è non fa niente", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    await repo.setMatchUnavailability({ matchId: match.id, athleteId: anna.id, reason: null, note: null, reportedBy: "parent", updatedBy: null });
    await repo.clearMatchUnavailability(match.id, anna.id);
    expect(await repo.listMatchUnavailability()).toEqual([]);
    await repo.clearMatchUnavailability(match.id, anna.id);
  });

  test("servono la partita e l'atleta: come in database, senza una delle due non si scrive", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    const base = { reason: null, note: null, reportedBy: "parent", updatedBy: null } as const;
    await expect(repo.setMatchUnavailability({ ...base, matchId: "non-esiste", athleteId: anna.id })).rejects.toThrow(/Partita non trovata/);
    await expect(repo.setMatchUnavailability({ ...base, matchId: match.id, athleteId: "non-esiste" })).rejects.toThrow(/Atleta non trovata/);
  });

  test("a cascata: eliminata la partita vanno via le sue segnalazioni, eliminata l'atleta il link e le sue segnalazioni", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const m1 = await repo.createMatch(matchInput, null);
    const m2 = await repo.createMatch({ ...matchInput, opponent: "Cividale" }, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    const bea = await repo.createAthlete(athleteInput("Bea Rossi"), null);
    const mark = (matchId: string, athleteId: string) =>
      repo.setMatchUnavailability({ matchId, athleteId, reason: null, note: null, reportedBy: "parent", updatedBy: null });
    await mark(m1.id, anna.id);
    await mark(m2.id, anna.id);
    await mark(m2.id, bea.id);
    const annaLink = await repo.ensureAthleteFamilyLink(anna.id, newFamilyToken());
    await repo.ensureAthleteFamilyLink(bea.id, newFamilyToken());

    await repo.deleteMatch(m1.id);
    expect((await repo.listMatchUnavailability()).map((row) => `${row.matchId}/${row.athleteId}`).sort()).toEqual(
      [`${m2.id}/${anna.id}`, `${m2.id}/${bea.id}`].sort(),
    );

    await repo.deleteAthlete(anna.id);
    expect((await repo.listMatchUnavailability()).map((row) => row.athleteId)).toEqual([bea.id]);
    expect((await repo.listAthleteFamilyLinks()).map((link) => link.athleteId)).toEqual([bea.id]);
    expect(await repo.findAthleteByFamilyToken(annaLink.token)).toBeNull();
  });

  test("un archivio salvato prima di questa funzione (senza i due elenchi) si legge lo stesso", async () => {
    const store = createEmptyStore() as unknown as Record<string, unknown>;
    delete store.athleteFamilyLinks;
    delete store.matchUnavailability;
    const repo = createMemoryRepo(store as unknown as ReturnType<typeof createEmptyStore>);
    expect(await repo.listAthleteFamilyLinks()).toEqual([]);
    expect(await repo.listMatchUnavailability()).toEqual([]);
  });
});
