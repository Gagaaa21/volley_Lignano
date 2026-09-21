import "server-only";
import { createEmptyStore, createMemoryRepo, type MemoryStore } from "@/lib/db/memory";
import type { Repo } from "@/lib/db/repo";

/**
 * Modalità prova (solo developer): un archivio separato, isolato dai dati
 * reali, seminato con una copia di quelli reali quando la modalità viene
 * attivata. Tutte le operazioni sui dati di dominio (allenamenti, partite,
 * formazioni, schede, presenze, atlete) durante la modalità prova finiscono
 * qui invece che sul database vero — all'uscita basta svuotarlo perché ogni
 * modifica sparisca senza aver mai toccato i dati reali. Staff e iscrizioni
 * push restano sempre sul repo reale (mai sandboxati): la modalità prova
 * serve a testare il calendario, non l'accesso degli account.
 */

const globalForTestDb = globalThis as unknown as { __volleyTestStore?: MemoryStore };

function getTestStore(): MemoryStore {
  return globalForTestDb.__volleyTestStore ?? (globalForTestDb.__volleyTestStore = createEmptyStore());
}

export function resetTestStore(): void {
  Object.assign(getTestStore(), createEmptyStore());
}

function cloneAll<T>(items: T[]): T[] {
  return items.map((item) => structuredClone(item));
}

export async function seedTestStoreFromRepo(realRepo: Repo): Promise<void> {
  const store = getTestStore();
  const [trainings, matches, trainingBlocks, trainingPlans, trainingOccurrencePlans, athletes, attendanceSessions] =
    await Promise.all([
      realRepo.listTrainings(),
      realRepo.listMatches(),
      realRepo.listTrainingBlocks(),
      realRepo.listTrainingPlans(),
      realRepo.listTrainingOccurrencePlans(),
      realRepo.listAthletes(),
      realRepo.listAttendanceSessions(),
    ]);
  const matchLineups = (await Promise.all(matches.map((m) => realRepo.getMatchLineup(m.id)))).filter(
    (l): l is NonNullable<typeof l> => Boolean(l),
  );

  store.trainings = cloneAll(trainings);
  store.matches = cloneAll(matches);
  store.matchLineups = cloneAll(matchLineups);
  store.trainingBlocks = cloneAll(trainingBlocks);
  store.trainingPlans = cloneAll(trainingPlans);
  store.trainingOccurrencePlans = cloneAll(trainingOccurrencePlans);
  store.athletes = cloneAll(athletes);
  store.attendanceSessions = cloneAll(attendanceSessions);
}

export function getTestRepo(realRepo: Repo): Repo {
  const sandboxed = createMemoryRepo(getTestStore());
  return {
    ...sandboxed,
    // Staff e iscrizioni push non sono mai sandboxati.
    listStaff: realRepo.listStaff,
    getStaffById: realRepo.getStaffById,
    getStaffByUsername: realRepo.getStaffByUsername,
    createStaff: realRepo.createStaff,
    updateStaffProfile: realRepo.updateStaffProfile,
    setStaffPassword: realRepo.setStaffPassword,
    markGuideSeen: realRepo.markGuideSeen,
    deleteStaff: realRepo.deleteStaff,
    listPushSubscriptions: realRepo.listPushSubscriptions,
    upsertPushSubscription: realRepo.upsertPushSubscription,
    deletePushSubscriptionByEndpoint: realRepo.deletePushSubscriptionByEndpoint,
    getStorageOverview: realRepo.getStorageOverview,
  };
}
