import bcrypt from "bcryptjs";
import { ADMIN_PAGES } from "@/lib/types";
import type {
  Athlete,
  AthleteInput,
  AttendanceSession,
  AttendanceSessionInput,
  Match,
  MatchInput,
  MatchLineup,
  MatchLineupInput,
  PushSubscriptionRecord,
  StaffMember,
  TrainingBlock,
  TrainingBlockInput,
  TrainingOccurrencePlan,
  TrainingPlan,
  TrainingPlanInput,
  TrainingRule,
  TrainingRuleInput,
} from "@/lib/types";
import type { MatchFilter, NewStaffInput, Repo, TeamFilter, TrainingFilter } from "@/lib/db/repo";

/**
 * In-memory demo backend, used automatically when Supabase env vars are not
 * configured. Lets the site be previewed locally without a database — starts
 * empty except for the seeded DEV account. Data resets on server restart.
 *
 * Anche la "modalità prova" del developer (src/lib/db/testMode.ts) usa questa
 * stessa implementazione, ma su un archivio separato: createMemoryRepo() è
 * per questo una fabbrica parametrizzata sullo store, non un singleton fisso.
 *
 * Next.js compiles Route Handlers (app/api/.../route.ts) as bundles separate
 * from pages and Server Actions, each getting its own module instantiation —
 * plain top-level `const` arrays here would then desync (a match created via
 * a page action would be invisible to an API route reading the "same"
 * module). Anchoring each store on `globalThis` keeps it a true singleton for
 * the whole Node.js process, regardless of which bundle touches it.
 */

export interface MemoryStore {
  trainings: TrainingRule[];
  matches: Match[];
  matchLineups: MatchLineup[];
  trainingBlocks: TrainingBlock[];
  trainingPlans: TrainingPlan[];
  trainingOccurrencePlans: TrainingOccurrencePlan[];
  athletes: Athlete[];
  attendanceSessions: AttendanceSession[];
  pushSubscriptions: PushSubscriptionRecord[];
  staff: StaffMember[];
  staffSeeded: boolean;
}

export function createEmptyStore(): MemoryStore {
  return {
    trainings: [],
    matches: [],
    matchLineups: [],
    trainingBlocks: [],
    trainingPlans: [],
    trainingOccurrencePlans: [],
    athletes: [],
    attendanceSessions: [],
    pushSubscriptions: [],
    staff: [],
    staffSeeded: false,
  };
}

const globalForMemoryDb = globalThis as unknown as { __volleyMemoryStore?: MemoryStore };

const demoStore: MemoryStore =
  globalForMemoryDb.__volleyMemoryStore ?? (globalForMemoryDb.__volleyMemoryStore = createEmptyStore());

function uid() {
  return crypto.randomUUID();
}

export function createMemoryRepo(store: MemoryStore): Repo {
  const trainings = store.trainings;
  const matches = store.matches;
  const matchLineups = store.matchLineups;
  const trainingBlocks = store.trainingBlocks;
  const trainingPlans = store.trainingPlans;
  const trainingOccurrencePlans = store.trainingOccurrencePlans;
  const athletes = store.athletes;
  const attendanceSessions = store.attendanceSessions;
  const pushSubscriptions = store.pushSubscriptions;
  const staff = store.staff;

  async function ensureStaffSeeded() {
    if (store.staffSeeded) return;
    store.staffSeeded = true;
    const passwordHash = await bcrypt.hash("Gaga211", 10);
    staff.push({
      id: uid(),
      username: "Gaga",
      passwordHash,
      fullName: "Gaga",
      role: "dev",
      mustChangePassword: true,
      hasSeenGuide: false,
      allowedPages: ADMIN_PAGES,
      createdBy: null,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    async listTrainings(filter?: TrainingFilter) {
      let result = [...trainings];
      if (filter?.team) result = result.filter((t) => t.team === filter.team);
      return result.sort((a, b) => a.startTime.localeCompare(b.startTime));
    },
    async getTraining(id) {
      return trainings.find((t) => t.id === id) ?? null;
    },
    async createTraining(input: TrainingRuleInput, createdBy) {
      const now = new Date().toISOString();
      const row: TrainingRule = { ...input, id: uid(), createdBy, createdAt: now, updatedAt: now };
      trainings.push(row);
      return row;
    },
    async updateTraining(id, input: TrainingRuleInput) {
      const idx = trainings.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error("Allenamento non trovato");
      trainings[idx] = { ...trainings[idx], ...input, updatedAt: new Date().toISOString() };
      return trainings[idx];
    },
    async deleteTraining(id) {
      const idx = trainings.findIndex((t) => t.id === id);
      if (idx !== -1) trainings.splice(idx, 1);
    },

    async listMatches(filter?: MatchFilter) {
      let result = [...matches];
      if (filter?.category) result = result.filter((m) => m.category === filter.category);
      if (filter?.from) result = result.filter((m) => m.matchDate.slice(0, 10) >= filter.from!);
      if (filter?.to) result = result.filter((m) => m.matchDate.slice(0, 10) <= filter.to!);
      if (filter?.team) result = result.filter((m) => m.team === filter.team);
      return result.sort((a, b) => a.matchDate.localeCompare(b.matchDate));
    },
    async getMatch(id) {
      return matches.find((m) => m.id === id) ?? null;
    },
    async createMatch(input: MatchInput, createdBy) {
      const now = new Date().toISOString();
      const row: Match = { ...input, id: uid(), createdBy, createdAt: now, updatedAt: now };
      matches.push(row);
      return row;
    },
    async updateMatch(id, input: MatchInput) {
      const idx = matches.findIndex((m) => m.id === id);
      if (idx === -1) throw new Error("Partita non trovata");
      matches[idx] = { ...matches[idx], ...input, updatedAt: new Date().toISOString() };
      return matches[idx];
    },
    async deleteMatch(id) {
      const idx = matches.findIndex((m) => m.id === id);
      if (idx !== -1) matches.splice(idx, 1);
      const lineupIdx = matchLineups.findIndex((l) => l.matchId === id);
      if (lineupIdx !== -1) matchLineups.splice(lineupIdx, 1);
    },

    async listMatchLineups() {
      return [...matchLineups];
    },
    async getMatchLineup(matchId) {
      return matchLineups.find((l) => l.matchId === matchId) ?? null;
    },
    async saveMatchLineup(matchId, input: MatchLineupInput, updatedBy) {
      const now = new Date().toISOString();
      const idx = matchLineups.findIndex((l) => l.matchId === matchId);
      const row: MatchLineup = { matchId, sets: input.sets, updatedBy, updatedAt: now };
      if (idx === -1) {
        matchLineups.push(row);
      } else {
        matchLineups[idx] = row;
      }
      return row;
    },

    async listStaff() {
      await ensureStaffSeeded();
      return [...staff].sort((a, b) => a.username.localeCompare(b.username));
    },
    async getStaffById(id) {
      await ensureStaffSeeded();
      return staff.find((s) => s.id === id) ?? null;
    },
    async getStaffByUsername(username) {
      await ensureStaffSeeded();
      return staff.find((s) => s.username.toLowerCase() === username.toLowerCase()) ?? null;
    },
    async createStaff(input: NewStaffInput) {
      await ensureStaffSeeded();
      const row: StaffMember = {
        ...input,
        id: uid(),
        hasSeenGuide: false,
        createdAt: new Date().toISOString(),
      };
      staff.push(row);
      return row;
    },
    async updateStaffProfile(id, input) {
      await ensureStaffSeeded();
      const idx = staff.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error("Utente non trovato");
      staff[idx] = { ...staff[idx], username: input.username, fullName: input.fullName };
      return staff[idx];
    },
    async setStaffPassword(id, passwordHash, mustChangePassword) {
      await ensureStaffSeeded();
      const idx = staff.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error("Utente non trovato");
      staff[idx] = { ...staff[idx], passwordHash, mustChangePassword };
    },
    async updateStaffPermissions(id, allowedPages) {
      await ensureStaffSeeded();
      const idx = staff.findIndex((s) => s.id === id);
      if (idx !== -1) staff[idx] = { ...staff[idx], allowedPages };
    },
    async markGuideSeen(id) {
      await ensureStaffSeeded();
      const idx = staff.findIndex((s) => s.id === id);
      if (idx !== -1) staff[idx] = { ...staff[idx], hasSeenGuide: true };
    },
    async deleteStaff(id) {
      await ensureStaffSeeded();
      const idx = staff.findIndex((s) => s.id === id);
      if (idx !== -1) staff.splice(idx, 1);
    },

    async listTrainingBlocks() {
      return [...trainingBlocks].sort((a, b) => a.title.localeCompare(b.title));
    },
    async getTrainingBlock(id) {
      return trainingBlocks.find((b) => b.id === id) ?? null;
    },
    async createTrainingBlock(input: TrainingBlockInput, createdBy) {
      const now = new Date().toISOString();
      const row: TrainingBlock = { ...input, id: uid(), createdBy, createdAt: now, updatedAt: now };
      trainingBlocks.push(row);
      return row;
    },
    async updateTrainingBlock(id, input: TrainingBlockInput) {
      const idx = trainingBlocks.findIndex((b) => b.id === id);
      if (idx === -1) throw new Error("Blocco non trovato");
      trainingBlocks[idx] = { ...trainingBlocks[idx], ...input, updatedAt: new Date().toISOString() };
      return trainingBlocks[idx];
    },
    async deleteTrainingBlock(id) {
      const idx = trainingBlocks.findIndex((b) => b.id === id);
      if (idx !== -1) trainingBlocks.splice(idx, 1);
      for (const plan of trainingPlans) {
        const pos = plan.blockIds.indexOf(id);
        if (pos !== -1) {
          plan.blockIds.splice(pos, 1);
          plan.updatedAt = new Date().toISOString();
        }
      }
    },

    async listTrainingPlans(filter?: TeamFilter) {
      let result = [...trainingPlans];
      if (filter?.team) result = result.filter((p) => p.team === filter.team);
      return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async getTrainingPlan(id) {
      return trainingPlans.find((p) => p.id === id) ?? null;
    },
    async createTrainingPlan(input: TrainingPlanInput, createdBy) {
      const now = new Date().toISOString();
      const row: TrainingPlan = { ...input, id: uid(), createdBy, createdAt: now, updatedAt: now };
      trainingPlans.push(row);
      return row;
    },
    async updateTrainingPlan(id, input: TrainingPlanInput) {
      const idx = trainingPlans.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error("Scheda non trovata");
      trainingPlans[idx] = { ...trainingPlans[idx], ...input, updatedAt: new Date().toISOString() };
      return trainingPlans[idx];
    },
    async deleteTrainingPlan(id) {
      const idx = trainingPlans.findIndex((p) => p.id === id);
      if (idx !== -1) trainingPlans.splice(idx, 1);
    },

    async listTrainingOccurrencePlans() {
      return [...trainingOccurrencePlans];
    },
    async getTrainingOccurrencePlan(trainingRuleId, occurrenceDate) {
      return (
        trainingOccurrencePlans.find(
          (o) => o.trainingRuleId === trainingRuleId && o.occurrenceDate === occurrenceDate,
        ) ?? null
      );
    },
    async setTrainingOccurrencePlan(trainingRuleId, occurrenceDate, planId, isPublic, createdBy) {
      const now = new Date().toISOString();
      const idx = trainingOccurrencePlans.findIndex(
        (o) => o.trainingRuleId === trainingRuleId && o.occurrenceDate === occurrenceDate,
      );
      if (idx !== -1) {
        trainingOccurrencePlans[idx] = {
          ...trainingOccurrencePlans[idx],
          planId,
          isPublic,
          updatedAt: now,
        };
        return trainingOccurrencePlans[idx];
      }
      const row: TrainingOccurrencePlan = {
        id: uid(),
        trainingRuleId,
        occurrenceDate,
        planId,
        isPublic,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };
      trainingOccurrencePlans.push(row);
      return row;
    },
    async removeTrainingOccurrencePlan(trainingRuleId, occurrenceDate) {
      const idx = trainingOccurrencePlans.findIndex(
        (o) => o.trainingRuleId === trainingRuleId && o.occurrenceDate === occurrenceDate,
      );
      if (idx !== -1) trainingOccurrencePlans.splice(idx, 1);
    },

    async listAthletes(filter?: TeamFilter) {
      let result = [...athletes];
      if (filter?.team) result = result.filter((a) => a.team === filter.team);
      return result.sort((a, b) => a.fullName.localeCompare(b.fullName));
    },
    async getAthlete(id) {
      return athletes.find((a) => a.id === id) ?? null;
    },
    async createAthlete(input: AthleteInput, createdBy) {
      const now = new Date().toISOString();
      const row: Athlete = { ...input, id: uid(), createdBy, createdAt: now, updatedAt: now };
      athletes.push(row);
      return row;
    },
    async createAthletesBulk(inputs: AthleteInput[], createdBy) {
      const now = new Date().toISOString();
      const rows: Athlete[] = inputs.map((input) => ({
        ...input,
        id: uid(),
        createdBy,
        createdAt: now,
        updatedAt: now,
      }));
      athletes.push(...rows);
      return rows;
    },
    async updateAthlete(id, input: AthleteInput) {
      const idx = athletes.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error("Atleta non trovata");
      athletes[idx] = { ...athletes[idx], ...input, updatedAt: new Date().toISOString() };
      return athletes[idx];
    },
    async deleteAthlete(id) {
      const idx = athletes.findIndex((a) => a.id === id);
      if (idx !== -1) athletes.splice(idx, 1);
    },

    async listAttendanceSessions(filter?: TeamFilter) {
      let result = [...attendanceSessions];
      if (filter?.team) result = result.filter((s) => s.team === filter.team);
      return result.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
    },
    async getAttendanceSession(id) {
      return attendanceSessions.find((s) => s.id === id) ?? null;
    },
    async getAttendanceSessionByOccurrence(trainingRuleId, sessionDate) {
      return (
        attendanceSessions.find(
          (s) => s.trainingRuleId === trainingRuleId && s.sessionDate === sessionDate,
        ) ?? null
      );
    },
    async createAttendanceSession(input: AttendanceSessionInput, createdBy) {
      const now = new Date().toISOString();
      const row: AttendanceSession = { ...input, id: uid(), createdBy, createdAt: now, updatedAt: now };
      attendanceSessions.push(row);
      return row;
    },
    async updateAttendanceSession(id, input: AttendanceSessionInput) {
      const idx = attendanceSessions.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error("Registro non trovato");
      attendanceSessions[idx] = {
        ...attendanceSessions[idx],
        ...input,
        updatedAt: new Date().toISOString(),
      };
      return attendanceSessions[idx];
    },
    async deleteAttendanceSession(id) {
      const idx = attendanceSessions.findIndex((s) => s.id === id);
      if (idx !== -1) attendanceSessions.splice(idx, 1);
    },

    async listPushSubscriptions() {
      return [...pushSubscriptions];
    },
    async upsertPushSubscription(input) {
      const idx = pushSubscriptions.findIndex((s) => s.endpoint === input.endpoint);
      if (idx !== -1) {
        pushSubscriptions[idx] = {
          ...pushSubscriptions[idx],
          p256dh: input.p256dh,
          auth: input.auth,
          staffId: input.staffId ?? null,
          team: input.team,
        };
        return;
      }
      pushSubscriptions.push({
        id: uid(),
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        staffId: input.staffId ?? null,
        team: input.team,
        createdAt: new Date().toISOString(),
      });
    },
    async deletePushSubscriptionByEndpoint(endpoint) {
      const idx = pushSubscriptions.findIndex((s) => s.endpoint === endpoint);
      if (idx !== -1) pushSubscriptions.splice(idx, 1);
    },

    async getStorageOverview() {
      const collections: Array<{ table: string; rows: unknown[] }> = [
        { table: "training_sessions", rows: trainings },
        { table: "matches", rows: matches },
        { table: "match_lineups", rows: matchLineups },
        { table: "training_blocks", rows: trainingBlocks },
        { table: "training_plans", rows: trainingPlans },
        { table: "training_occurrence_plans", rows: trainingOccurrencePlans },
        { table: "athletes", rows: athletes },
        { table: "attendance_sessions", rows: attendanceSessions },
        { table: "push_subscriptions", rows: pushSubscriptions },
        { table: "staff", rows: staff },
      ];
      return {
        tables: collections.map(({ table, rows }) => ({
          table,
          rowCount: rows.length,
          sizeBytes: Buffer.byteLength(JSON.stringify(rows)),
        })),
        generatedAt: new Date().toISOString(),
      };
    },
  };
}

export const memoryRepo: Repo = createMemoryRepo(demoStore);
