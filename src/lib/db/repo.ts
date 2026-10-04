import type {
  FederationDecision,
  FederationDecisionInput,
  FederationSnapshot,
  FederationSource,
  FederationSourceInput,
} from "@/lib/federation/types";
import type {
  AdminPage,
  Athlete,
  AthleteInput,
  AttendanceSession,
  AttendanceSessionInput,
  LiveScoreState,
  Match,
  MatchInput,
  MatchLineup,
  MatchLineupInput,
  MatchPrediction,
  MatchPredictionInput,
  PhysicalTest,
  PhysicalTestInput,
  PushSubscriptionRecord,
  StaffMember,
  StaffRole,
  StorageOverview,
  TrainingOccurrencePlan,
  TrainingPlan,
  TrainingPlanInput,
  TrainingRule,
  TrainingRuleInput,
  TrainingTeam,
} from "@/lib/types";

type Category = import("@/lib/types").Category;

export interface MatchFilter {
  category?: Category;
  from?: string; // ISO date, inclusive
  to?: string; // ISO date, inclusive
  team?: TrainingTeam;
}

export interface TrainingFilter {
  team?: TrainingTeam;
}

export interface TeamFilter {
  team?: TrainingTeam;
}

export interface NewStaffInput {
  username: string;
  passwordHash: string;
  fullName: string;
  role: StaffRole;
  mustChangePassword: boolean;
  allowedPages: AdminPage[];
  allowedTeams: TrainingTeam[];
  createdBy: string | null;
}

export interface StaffPermissionsInput {
  allowedPages: AdminPage[];
  allowedTeams: TrainingTeam[];
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

  // Risultati e classifiche ufficiali dalla federazione (src/lib/federation).
  // Fonti e ultimo contenuto letto non sono mai sandboxati in modalità prova
  // (dati esterni); le decisioni degli admin sì, perché riguardano partite.
  /** Sempre una riga per categoria, con i valori predefiniti dove manca. */
  listFederationSources(): Promise<FederationSource[]>;
  saveFederationSource(category: Category, input: FederationSourceInput): Promise<FederationSource>;
  listFederationSnapshots(): Promise<FederationSnapshot[]>;
  saveFederationSnapshot(snapshot: FederationSnapshot): Promise<void>;
  listFederationDecisions(): Promise<FederationDecision[]>;
  /** Una sola decisione per (categoria, gara): sostituisce la precedente. */
  setFederationDecision(input: FederationDecisionInput): Promise<void>;
  clearFederationDecision(category: Category, externalId: string): Promise<void>;

  // Formazioni partita per set (riservate allo staff)
  listMatchLineups(): Promise<MatchLineup[]>;
  getMatchLineup(matchId: string): Promise<MatchLineup | null>;
  saveMatchLineup(
    matchId: string,
    input: MatchLineupInput,
    updatedBy: string | null,
  ): Promise<MatchLineup>;

  // Pronostici partita: un pronostico per (matchId, staffId), sovrascritto
  // modificandolo (vedi src/lib/predictions.ts per come viene giudicato).
  listPredictions(filter?: { matchId?: string }): Promise<MatchPrediction[]>;
  getPrediction(matchId: string, staffId: string): Promise<MatchPrediction | null>;
  upsertPrediction(
    matchId: string,
    staffId: string,
    input: MatchPredictionInput,
  ): Promise<MatchPrediction>;

  // Staff
  listStaff(): Promise<StaffMember[]>;
  getStaffById(id: string): Promise<StaffMember | null>;
  getStaffByUsername(username: string): Promise<StaffMember | null>;
  createStaff(input: NewStaffInput): Promise<StaffMember>;
  updateStaffProfile(
    id: string,
    input: { username: string; fullName: string; hiddenFromAdmins: boolean },
  ): Promise<StaffMember>;
  setStaffPassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void>;
  updateStaffPermissions(id: string, input: StaffPermissionsInput): Promise<void>;
  markGuideSeen(id: string): Promise<void>;
  deleteStaff(id: string): Promise<void>;

  // Schede allenamento (composizione ordinata di blocchi, incorporati nella scheda)
  listTrainingPlans(filter?: TeamFilter): Promise<TrainingPlan[]>;
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
  listAthletes(filter?: TeamFilter): Promise<Athlete[]>;
  getAthlete(id: string): Promise<Athlete | null>;
  createAthlete(input: AthleteInput, createdBy: string | null): Promise<Athlete>;
  createAthletesBulk(inputs: AthleteInput[], createdBy: string | null): Promise<Athlete[]>;
  updateAthlete(id: string, input: AthleteInput): Promise<Athlete>;
  deleteAthlete(id: string): Promise<void>;

  // Registro presenze
  listAttendanceSessions(filter?: TeamFilter): Promise<AttendanceSession[]>;
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

  // Test fisici: predisposizione per registrare risultati di test fisici
  // (es. altezza di salto) per singola atleta, da confrontare nel tempo.
  listPhysicalTests(filter?: TeamFilter): Promise<PhysicalTest[]>;
  getPhysicalTest(id: string): Promise<PhysicalTest | null>;
  createPhysicalTest(input: PhysicalTestInput, createdBy: string | null): Promise<PhysicalTest>;
  updatePhysicalTest(id: string, input: PhysicalTestInput): Promise<PhysicalTest>;
  deletePhysicalTest(id: string): Promise<void>;

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

  // Tabellone live (allenamento): stato salvato in automatico solo per
  // qualche ora, per non perdere tutto se la pagina si ricarica. null se
  // non c'è nulla di salvato o se il salvataggio è più vecchio di
  // LIVE_SCORE_TTL_MS.
  getLiveScoreState(): Promise<LiveScoreState | null>;
  saveLiveScoreState(state: LiveScoreState): Promise<void>;
  clearLiveScoreState(): Promise<void>;
}
