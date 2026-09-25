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
  StaffRole,
  StorageOverview,
  TrainingBlock,
  TrainingBlockInput,
  TrainingOccurrencePlan,
  TrainingPlan,
  TrainingPlanInput,
  TrainingRule,
  TrainingRuleInput,
  TrainingTeam,
} from "@/lib/types";

export interface MatchFilter {
  category?: import("@/lib/types").Category;
  from?: string; // ISO date, inclusive
  to?: string; // ISO date, inclusive
}

export interface TrainingFilter {
  team?: TrainingTeam;
}

export interface NewStaffInput {
  username: string;
  passwordHash: string;
  fullName: string;
  role: StaffRole;
  mustChangePassword: boolean;
  createdBy: string | null;
}

export interface Repo {
  // Trainings
  listTrainings(filter?: TrainingFilter): Promise<TrainingRule[]>;
  getTraining(id: string): Promise<TrainingRule | null>;
  createTraining(input: TrainingRuleInput, createdBy: string | null): Promise<TrainingRule>;
  updateTraining(id: string, input: TrainingRuleInput): Promise<TrainingRule>;
  deleteTraining(id: string): Promise<void>;

  // Matches
  listMatches(filter?: MatchFilter): Promise<Match[]>;
  getMatch(id: string): Promise<Match | null>;
  createMatch(input: MatchInput, createdBy: string | null): Promise<Match>;
  updateMatch(id: string, input: MatchInput): Promise<Match>;
  deleteMatch(id: string): Promise<void>;

  // Formazioni partita per set (riservate allo staff)
  listMatchLineups(): Promise<MatchLineup[]>;
  getMatchLineup(matchId: string): Promise<MatchLineup | null>;
  saveMatchLineup(
    matchId: string,
    input: MatchLineupInput,
    updatedBy: string | null,
  ): Promise<MatchLineup>;

  // Staff
  listStaff(): Promise<StaffMember[]>;
  getStaffById(id: string): Promise<StaffMember | null>;
  getStaffByUsername(username: string): Promise<StaffMember | null>;
  createStaff(input: NewStaffInput): Promise<StaffMember>;
  updateStaffProfile(id: string, input: { username: string; fullName: string }): Promise<StaffMember>;
  setStaffPassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void>;
  markGuideSeen(id: string): Promise<void>;
  deleteStaff(id: string): Promise<void>;

  // Blocchi allenamento riutilizzabili (libreria "puzzle")
  listTrainingBlocks(): Promise<TrainingBlock[]>;
  getTrainingBlock(id: string): Promise<TrainingBlock | null>;
  createTrainingBlock(input: TrainingBlockInput, createdBy: string | null): Promise<TrainingBlock>;
  updateTrainingBlock(id: string, input: TrainingBlockInput): Promise<TrainingBlock>;
  deleteTrainingBlock(id: string): Promise<void>;

  // Schede allenamento (composizione ordinata di blocchi)
  listTrainingPlans(): Promise<TrainingPlan[]>;
  getTrainingPlan(id: string): Promise<TrainingPlan | null>;
  createTrainingPlan(input: TrainingPlanInput, createdBy: string | null): Promise<TrainingPlan>;
  updateTrainingPlan(id: string, input: TrainingPlanInput): Promise<TrainingPlan>;
  deleteTrainingPlan(id: string): Promise<void>;

  // Scheda collegata a un singolo giorno di allenamento (vale solo per quella
  // data, anche se la regola è ricorrente)
  listTrainingOccurrencePlans(): Promise<TrainingOccurrencePlan[]>;
  getTrainingOccurrencePlan(
    trainingRuleId: string,
    occurrenceDate: string,
  ): Promise<TrainingOccurrencePlan | null>;
  setTrainingOccurrencePlan(
    trainingRuleId: string,
    occurrenceDate: string,
    planId: string,
    isPublic: boolean,
    createdBy: string | null,
  ): Promise<TrainingOccurrencePlan>;
  removeTrainingOccurrencePlan(trainingRuleId: string, occurrenceDate: string): Promise<void>;

  // Atlete
  listAthletes(): Promise<Athlete[]>;
  getAthlete(id: string): Promise<Athlete | null>;
  createAthlete(input: AthleteInput, createdBy: string | null): Promise<Athlete>;
  createAthletesBulk(inputs: AthleteInput[], createdBy: string | null): Promise<Athlete[]>;
  updateAthlete(id: string, input: AthleteInput): Promise<Athlete>;
  deleteAthlete(id: string): Promise<void>;

  // Registro presenze
  listAttendanceSessions(): Promise<AttendanceSession[]>;
  getAttendanceSession(id: string): Promise<AttendanceSession | null>;
  getAttendanceSessionByOccurrence(
    trainingRuleId: string,
    sessionDate: string,
  ): Promise<AttendanceSession | null>;
  createAttendanceSession(
    input: AttendanceSessionInput,
    createdBy: string | null,
  ): Promise<AttendanceSession>;
  updateAttendanceSession(id: string, input: AttendanceSessionInput): Promise<AttendanceSession>;
  deleteAttendanceSession(id: string): Promise<void>;

  // Iscrizioni notifiche push (PWA)
  listPushSubscriptions(): Promise<PushSubscriptionRecord[]>;
  upsertPushSubscription(input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    staffId?: string | null;
    team: TrainingTeam;
  }): Promise<void>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>;

  // Panoramica utilizzo storage (pagina Manutenzione, solo dev)
  getStorageOverview(): Promise<StorageOverview>;
}
