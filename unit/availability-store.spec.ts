import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { newFamilyToken } from "@/lib/availability/token";
import type { MatchAvailabilityInput } from "@/lib/availability/types";
import type { AthleteInput, MatchInput } from "@/lib/types";

/**
 * L'archivio dei link per i genitori e delle risposte di presenza (lo stesso che usa la modalità prova). Con Supabase il
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

test.describe("risposte di presenza nell'archivio", () => {
  const answer = (matchId: string, athleteId: string, overrides: Partial<MatchAvailabilityInput> = {}): MatchAvailabilityInput => ({
    matchId,
    athleteId,
    status: "present",
    reason: null,
    note: null,
    answeredBy: "parent",
    updatedBy: null,
    ...overrides,
  });

  test("una sola risposta per partita e atleta: scriverne un'altra la sostituisce, non la duplica", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);

    const first = await repo.setMatchAvailability(answer(match.id, anna.id, { status: "absent", reason: "malata" }));
    expect(first).toMatchObject({ status: "absent", reason: "malata", answeredBy: "parent" });
    expect(first.updatedAt).toBeTruthy();

    // L'allenatore la cambia in «Ci sarà» (per esempio dopo un messaggio in chat): vale l'ultima, e si vede chi l'ha scritta.
    const second = await repo.setMatchAvailability(answer(match.id, anna.id, { status: "present", answeredBy: "staff", updatedBy: "staff-1" }));
    expect(second).toMatchObject({ status: "present", reason: null, answeredBy: "staff", updatedBy: "staff-1" });

    // E il genitore la rimette a «Non ci sarà», con motivo e nota.
    await repo.setMatchAvailability(answer(match.id, anna.id, { status: "absent", reason: "famiglia", note: "matrimonio" }));

    const all = await repo.listMatchAvailability();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ status: "absent", reason: "famiglia", note: "matrimonio", answeredBy: "parent", updatedBy: null });
  });

  test("si filtra per partite o per atleta; un elenco di partite vuoto non dà niente", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const m1 = await repo.createMatch(matchInput, null);
    const m2 = await repo.createMatch({ ...matchInput, opponent: "Cividale" }, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    const bea = await repo.createAthlete(athleteInput("Bea Rossi"), null);
    await repo.setMatchAvailability(answer(m1.id, anna.id, { status: "absent" }));
    await repo.setMatchAvailability(answer(m1.id, bea.id));
    await repo.setMatchAvailability(answer(m2.id, anna.id));

    expect(await repo.listMatchAvailability()).toHaveLength(3);
    expect(await repo.listMatchAvailability({ matchIds: [m1.id] })).toHaveLength(2);
    expect(await repo.listMatchAvailability({ matchIds: [m1.id, m2.id] })).toHaveLength(3);
    expect(await repo.listMatchAvailability({ athleteId: anna.id })).toHaveLength(2);
    expect(await repo.listMatchAvailability({ matchIds: [m2.id], athleteId: bea.id })).toHaveLength(0);
    expect(await repo.listMatchAvailability({ matchIds: [] })).toEqual([]);
  });

  test("si toglie con clear (l'atleta torna «senza risposta»); toglierne una che non c'è non fa niente", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    await repo.setMatchAvailability(answer(match.id, anna.id));
    await repo.clearMatchAvailability(match.id, anna.id);
    expect(await repo.listMatchAvailability()).toEqual([]);
    await repo.clearMatchAvailability(match.id, anna.id);
  });

  test("servono la partita e l'atleta: come in database, senza una delle due non si scrive", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    await expect(repo.setMatchAvailability(answer("non-esiste", anna.id))).rejects.toThrow(/Partita non trovata/);
    await expect(repo.setMatchAvailability(answer(match.id, "non-esiste"))).rejects.toThrow(/Atleta non trovata/);
  });

  test("quello che si riceve è una copia: cambiarla non cambia l'archivio", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    const saved = await repo.setMatchAvailability(answer(match.id, anna.id));
    saved.status = "absent";
    (await repo.listMatchAvailability())[0].note = "manomessa";
    expect((await repo.listMatchAvailability())[0]).toMatchObject({ status: "present", note: null });
  });

  test("a cascata: eliminata la partita vanno via le sue risposte, eliminata l'atleta il link e le sue risposte", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const m1 = await repo.createMatch(matchInput, null);
    const m2 = await repo.createMatch({ ...matchInput, opponent: "Cividale" }, null);
    const anna = await repo.createAthlete(athleteInput("Anna Bianchi"), null);
    const bea = await repo.createAthlete(athleteInput("Bea Rossi"), null);
    await repo.setMatchAvailability(answer(m1.id, anna.id, { status: "absent" }));
    await repo.setMatchAvailability(answer(m2.id, anna.id));
    await repo.setMatchAvailability(answer(m2.id, bea.id, { status: "absent" }));
    const annaLink = await repo.ensureAthleteFamilyLink(anna.id, newFamilyToken());
    await repo.ensureAthleteFamilyLink(bea.id, newFamilyToken());

    await repo.deleteMatch(m1.id);
    expect((await repo.listMatchAvailability()).map((row) => `${row.matchId}/${row.athleteId}`).sort()).toEqual(
      [`${m2.id}/${anna.id}`, `${m2.id}/${bea.id}`].sort(),
    );

    await repo.deleteAthlete(anna.id);
    expect((await repo.listMatchAvailability()).map((row) => row.athleteId)).toEqual([bea.id]);
    expect((await repo.listAthleteFamilyLinks()).map((link) => link.athleteId)).toEqual([bea.id]);
    expect(await repo.findAthleteByFamilyToken(annaLink.token)).toBeNull();
  });

  test("un archivio salvato prima di questa funzione (senza i due elenchi) si legge lo stesso", async () => {
    const store = createEmptyStore() as unknown as Record<string, unknown>;
    delete store.athleteFamilyLinks;
    delete store.matchAvailability;
    const repo = createMemoryRepo(store as unknown as ReturnType<typeof createEmptyStore>);
    expect(await repo.listAthleteFamilyLinks()).toEqual([]);
    expect(await repo.listMatchAvailability()).toEqual([]);
  });
});
