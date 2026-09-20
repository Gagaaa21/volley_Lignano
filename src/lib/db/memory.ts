import bcrypt from "bcryptjs";
import type {
  Athlete,
  AthleteInput,
  AttendanceSession,
  AttendanceSessionInput,
  Match,
  MatchInput,
  PushSubscriptionRecord,
  StaffMember,
  TrainingBlock,
  TrainingBlockInput,
  TrainingPlan,
  TrainingPlanInput,
  TrainingRule,
  TrainingRuleInput,
} from "@/lib/types";
import type { MatchFilter, NewStaffInput, Repo } from "@/lib/db/repo";

/**
 * In-memory demo backend, used automatically when Supabase env vars are not
 * configured. Lets the site be previewed locally without a database — starts
 * empty except for the seeded DEV account. Data resets on server restart.
 */

function uid() {
  return crypto.randomUUID();
}

const trainings: TrainingRule[] = [];

const matches: Match[] = [];

const trainingBlocks: TrainingBlock[] = [];

const trainingPlans: TrainingPlan[] = [];

const athletes: Athlete[] = [];

const attendanceSessions: AttendanceSession[] = [];

const pushSubscriptions: PushSubscriptionRecord[] = [];

const staff: StaffMember[] = [];
let staffSeeded = false;

async function ensureStaffSeeded() {
  if (staffSeeded) return;
  staffSeeded = true;
  const passwordHash = await bcrypt.hash("Gaga211", 10);
  staff.push({
    id: uid(),
    username: "Gaga",
    passwordHash,
    fullName: "Gaga",
    role: "dev",
    mustChangePassword: true,
    hasSeenGuide: false,
    createdBy: null,
    createdAt: new Date().toISOString(),
  });
}

export const memoryRepo: Repo = {
  async listTrainings() {
    return [...trainings].sort((a, b) => a.startTime.localeCompare(b.startTime));
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

  async listTrainingPlans() {
    return [...trainingPlans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  async listAthletes() {
    return [...athletes].sort((a, b) => a.fullName.localeCompare(b.fullName));
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

  async listAttendanceSessions() {
    return [...attendanceSessions].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
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
      pushSubscriptions[idx] = { ...pushSubscriptions[idx], p256dh: input.p256dh, auth: input.auth };
      return;
    }
    pushSubscriptions.push({
      id: uid(),
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      createdAt: new Date().toISOString(),
    });
  },
  async deletePushSubscriptionByEndpoint(endpoint) {
    const idx = pushSubscriptions.findIndex((s) => s.endpoint === endpoint);
    if (idx !== -1) pushSubscriptions.splice(idx, 1);
  },
};
