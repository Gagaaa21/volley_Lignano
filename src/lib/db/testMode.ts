import "server-only";
import { createEmptyStore, createMemoryRepo, type MemoryStore } from "@/lib/db/memory";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
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
 *
 * Persistenza: quando Supabase è configurato, l'archivio sandbox vive come
 * blob JSON nella tabella test_mode_store, non in globalThis — su Vercel
 * richieste diverse possono finire su istanze serverless diverse, che non
 * condividono la memoria di processo, quindi un archivio solo in-memory
 * apparirebbe vuoto o incompleto a seconda dell'istanza (dati che
 * "spariscono", pagine 404). In modalità demo locale (Supabase non
 * configurato) resta su globalThis: un solo processo, nessun problema.
 */

const TEST_STORE_ROW_ID = "singleton";

const globalForTestDb = globalThis as unknown as { __volleyTestStore?: MemoryStore };

function getLocalStore(): MemoryStore {
  return globalForTestDb.__volleyTestStore ?? (globalForTestDb.__volleyTestStore = createEmptyStore());
}

async function loadStore(): Promise<MemoryStore> {
  if (!isSupabaseConfigured()) return getLocalStore();
  const { data, error } = await getSupabaseAdmin()
    .from("test_mode_store")
    .select("data")
    .eq("id", TEST_STORE_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return { ...createEmptyStore(), ...((data?.data as Partial<MemoryStore>) ?? {}) };
}

async function saveStore(store: MemoryStore): Promise<void> {
  if (!isSupabaseConfigured()) return; // già lo stesso oggetto condiviso via globalThis
  const { error } = await getSupabaseAdmin()
    .from("test_mode_store")
    .upsert({ id: TEST_STORE_ROW_ID, data: store, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function resetTestStore(): Promise<void> {
  const empty = createEmptyStore();
  if (!isSupabaseConfigured()) {
    Object.assign(getLocalStore(), empty);
    return;
  }
  await saveStore(empty);
}

function cloneAll<T>(items: T[]): T[] {
  return items.map((item) => structuredClone(item));
}

export async function seedTestStoreFromRepo(realRepo: Repo): Promise<void> {
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

  const store = createEmptyStore();
  store.trainings = cloneAll(trainings);
  store.matches = cloneAll(matches);
  store.matchLineups = cloneAll(matchLineups);
  store.trainingBlocks = cloneAll(trainingBlocks);
  store.trainingPlans = cloneAll(trainingPlans);
  store.trainingOccurrencePlans = cloneAll(trainingOccurrencePlans);
  store.athletes = cloneAll(athletes);
  store.attendanceSessions = cloneAll(attendanceSessions);

  if (!isSupabaseConfigured()) {
    Object.assign(getLocalStore(), store);
    return;
  }
  await saveStore(store);
}

/** Metodi del repo sandboxato che modificano l'archivio: dopo ognuno la
 * versione aggiornata viene ripersistita, così ogni istanza serverless la
 * rilegge alla richiesta successiva invece di vedere solo la propria copia
 * in memoria. */
const WRITE_METHODS = new Set<keyof Repo>([
  "createTraining",
  "updateTraining",
  "deleteTraining",
  "createMatch",
  "updateMatch",
  "deleteMatch",
  "saveMatchLineup",
  "createTrainingBlock",
  "updateTrainingBlock",
  "deleteTrainingBlock",
  "createTrainingPlan",
  "updateTrainingPlan",
  "deleteTrainingPlan",
  "setTrainingOccurrencePlan",
  "removeTrainingOccurrencePlan",
  "createAthlete",
  "createAthletesBulk",
  "updateAthlete",
  "deleteAthlete",
  "createAttendanceSession",
  "updateAttendanceSession",
  "deleteAttendanceSession",
]);

// Staff e iscrizioni push non sono mai sandboxati.
const ALWAYS_REAL_METHODS = new Set<keyof Repo>([
  "listStaff",
  "getStaffById",
  "getStaffByUsername",
  "createStaff",
  "updateStaffProfile",
  "setStaffPassword",
  "markGuideSeen",
  "deleteStaff",
  "listPushSubscriptions",
  "upsertPushSubscription",
  "deletePushSubscriptionByEndpoint",
  "getStorageOverview",
]);

export async function getTestRepo(realRepo: Repo): Promise<Repo> {
  const store = await loadStore();
  const sandboxed = createMemoryRepo(store);

  const result = {} as Record<keyof Repo, unknown>;
  for (const key of Object.keys(sandboxed) as (keyof Repo)[]) {
    if (ALWAYS_REAL_METHODS.has(key)) {
      result[key] = realRepo[key];
      continue;
    }
    const original = sandboxed[key] as (...args: unknown[]) => Promise<unknown>;
    if (!WRITE_METHODS.has(key)) {
      result[key] = original;
      continue;
    }
    result[key] = async (...args: unknown[]) => {
      const value = await original(...args);
      await saveStore(store);
      return value;
    };
  }
  return result as unknown as Repo;
}
