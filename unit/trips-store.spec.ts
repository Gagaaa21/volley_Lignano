import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { addVehicle } from "@/lib/trips/rules";
import { emptyTripData, type MatchTripData } from "@/lib/trips/types";
import type { AthleteInput, MatchInput } from "@/lib/types";

/**
 * Il salvataggio delle trasferte nell'archivio di prova (lo stesso che usa la modalità prova): una riga per partita con la
 * sua versione, e la rubrica dei genitori una riga per atleta. Con Supabase il comportamento è lo stesso (vedi schema.sql).
 */

const matchInput: MatchInput = {
  team: "u14u15",
  category: "U15",
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

const athleteInput: AthleteInput = {
  fullName: "Anna Bianchi",
  team: "u14u15",
  category: "U15",
  group: null,
  jerseyNumber: null,
  isActive: true,
  notes: null,
};

function withVehicle(driver: string): MatchTripData {
  const result = addVehicle(
    emptyTripData(),
    { kind: "auto", ownerName: null, driverName: driver, driverPhone: null, seats: 3, departureTime: null, departurePlace: null, notes: null },
    "v1",
  );
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

test.describe("trasferte nell'archivio", () => {
  test("la prima volta si crea alla versione 1; ogni salvataggio dichiara la versione su cui si basa", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);

    const first = await repo.saveMatchTrip(match.id, withVehicle("Mario"), "staff-1", null);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.trip.version).toBe(1);
    expect(first.trip.updatedBy).toBe("staff-1");

    const second = await repo.saveMatchTrip(match.id, withVehicle("Luca"), "staff-2", 1);
    expect(second.ok && second.trip.version).toBe(2);

    // Chi si basava ancora sulla versione 1 non scrive e riceve quella attuale.
    const stale = await repo.saveMatchTrip(match.id, withVehicle("Paolo"), "staff-3", 1);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.current?.vehicles[0].driverName).toBe("Luca");
    expect((await repo.getMatchTrip(match.id))?.vehicles[0].driverName).toBe("Luca");

    // Crearla due volte come «prima volta» non sovrascrive.
    const again = await repo.saveMatchTrip(match.id, withVehicle("Paolo"), null, null);
    expect(again.ok).toBe(false);
  });

  test("una trasferta cancellata nel frattempo non si ricrea per sbaglio con una versione vecchia", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);
    await repo.saveMatchTrip(match.id, withVehicle("Mario"), null, null);
    await repo.deleteMatchTrip(match.id);
    expect(await repo.getMatchTrip(match.id)).toBeNull();
    const result = await repo.saveMatchTrip(match.id, withVehicle("Luca"), null, 1);
    expect(result).toEqual({ ok: false, current: null });
  });

  test("l'archivio restituisce copie: cambiarle non cambia quello che c'è salvato", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);
    await repo.saveMatchTrip(match.id, withVehicle("Mario"), null, null);
    const read = await repo.getMatchTrip(match.id);
    read!.vehicles[0].driverName = "Cambiato fuori";
    expect((await repo.getMatchTrip(match.id))?.vehicles[0].driverName).toBe("Mario");
    expect((await repo.listMatchTrips()).map((t) => t.matchId)).toEqual([match.id]);
  });

  test("eliminando la partita se ne va anche la sua trasferta", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const match = await repo.createMatch(matchInput, null);
    await repo.saveMatchTrip(match.id, withVehicle("Mario"), null, null);
    await repo.deleteMatch(match.id);
    expect(await repo.listMatchTrips()).toEqual([]);
  });

  test("rubrica: una riga per atleta; senza numeri la riga non c'è; eliminando l'atleta se ne vanno anche i suoi numeri", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const athlete = await repo.createAthlete(athleteInput, null);

    expect(await repo.saveAthleteContacts(athlete.id, [{ name: "Giulia", phone: "333 1112222", relation: "mamma" }], "staff-1")).toMatchObject({
      athleteId: athlete.id,
      updatedBy: "staff-1",
    });
    await repo.saveAthleteContacts(athlete.id, [{ name: "Paolo", phone: "340 7654321", relation: null }], null);
    const rubrica = await repo.listAthleteContacts();
    expect(rubrica).toHaveLength(1);
    expect(rubrica[0].contacts.map((c) => c.name)).toEqual(["Paolo"]);

    expect(await repo.saveAthleteContacts(athlete.id, [], null)).toBeNull();
    expect(await repo.listAthleteContacts()).toEqual([]);

    await repo.saveAthleteContacts(athlete.id, [{ name: "Giulia", phone: "333 1112222", relation: null }], null);
    await repo.deleteAthlete(athlete.id);
    expect(await repo.listAthleteContacts()).toEqual([]);
  });

  test("la pagina Manutenzione conta anche le due tabelle nuove", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const overview = await repo.getStorageOverview();
    const tables = overview.tables.map((t) => t.table);
    expect(tables).toContain("match_trips");
    expect(tables).toContain("athlete_contacts");
  });

  test("un archivio di prova salvato prima delle trasferte non ha i due elenchi: si parte da vuoti", async () => {
    const store = createEmptyStore() as unknown as Record<string, unknown>;
    delete store.matchTrips;
    delete store.athleteContacts;
    const repo = createMemoryRepo(store as unknown as ReturnType<typeof createEmptyStore>);
    expect(await repo.listMatchTrips()).toEqual([]);
    expect(await repo.listAthleteContacts()).toEqual([]);
  });
});
