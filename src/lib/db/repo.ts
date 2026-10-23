import type {
  FederationDecision,
  FederationDecisionInput,
  FederationSnapshot,
  FederationSource,
  FederationSourceInput,
} from "@/lib/federation/types";
import type { MatchScout, MatchScoutInput, SaveMatchScoutResult } from "@/lib/scout/types";
import type { AthleteFamilyLink, MatchAvailability, MatchAvailabilityInput } from "@/lib/availability/types";
import type { AthleteContact, AthleteContacts, MatchTrip, MatchTripData, SaveMatchTripResult } from "@/lib/trips/types";
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
  TrainingOccurrenceOverride,
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
  /** Sostituisce le variazioni di singole date (orario/luogo solo quel giorno) di un allenamento. */
  setTrainingOccurrenceOverrides(id: string, overrides: TrainingOccurrenceOverride[]): Promise<TrainingRule>;
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

  // Impostazioni globali del sito (chiave → testo), es. l'ultima richiesta di
  // attivazione delle notifiche. Null se la chiave non è mai stata scritta.
  getAppSetting(key: string): Promise<string | null>;
  setAppSetting(key: string, value: string): Promise<void>;

  // Formazioni partita per set (riservate allo staff)
  listMatchLineups(): Promise<MatchLineup[]>;
  getMatchLineup(matchId: string): Promise<MatchLineup | null>;
  saveMatchLineup(
    matchId: string,
    input: MatchLineupInput,
    updatedBy: string | null,
  ): Promise<MatchLineup>;

  // Scout punto per punto delle partite (riservato allo staff). Il salvataggio
  // dichiara su quale versione si basa (null = prima volta): se nel frattempo
  // un altro dispositivo ha salvato, non scrive e restituisce la versione attuale.
  listMatchScouts(): Promise<MatchScout[]>;
  getMatchScout(matchId: string): Promise<MatchScout | null>;
  saveMatchScout(
    matchId: string,
    input: MatchScoutInput,
    updatedBy: string | null,
    baseVersion: number | null,
  ): Promise<SaveMatchScoutResult>;
  deleteMatchScout(matchId: string): Promise<void>;

  /**
   * Lo scout con il «Punteggio live» acceso e salvato di recente (entro
   * LIVE_SCORE_TTL_MS), insieme alla sua partita: serve al sito pubblico per
   * mostrare il punteggio. Se ce ne sono più d'uno vale l'ultimo salvato.
   */
  getPublicLiveScout(): Promise<{ scout: MatchScout; match: Match } | null>;

  // Trasferte (riservate allo staff con il permesso «trasferte»): un documento per partita con mezzi e passeggeri, salvato
  // dichiarando la versione su cui ci si basa come per lo scout, e la rubrica dei genitori, una riga per atleta (vuota = nessuna riga).
  listMatchTrips(): Promise<MatchTrip[]>;
  getMatchTrip(matchId: string): Promise<MatchTrip | null>;
  saveMatchTrip(
    matchId: string,
    input: MatchTripData,
    updatedBy: string | null,
    baseVersion: number | null,
  ): Promise<SaveMatchTripResult>;
  deleteMatchTrip(matchId: string): Promise<void>;
  listAthleteContacts(): Promise<AthleteContacts[]>;
  saveAthleteContacts(athleteId: string, contacts: AthleteContact[], updatedBy: string | null): Promise<AthleteContacts | null>;

  // Disponibilità delle atlete: il link personale e segreto di ognuna (i genitori non hanno un account) e le partite a cui non ci
  // sono. Dati riservati: il sito pubblico non li legge mai. La pagina del genitore usa sempre il repo reale (vedi getRepo()).
  listAthleteFamilyLinks(): Promise<AthleteFamilyLink[]>;
  /** L'atleta a cui appartiene il codice di un link, o null se il codice non esiste (non si cerca mai per nome). */
  findAthleteByFamilyToken(token: string): Promise<Athlete | null>;
  /** Crea il link dell'atleta se non ce l'ha ancora; se ce l'ha, restituisce quello che c'è (il codice proposto si ignora). */
  ensureAthleteFamilyLink(athleteId: string, token: string): Promise<AthleteFamilyLink>;
  /** Sostituisce il codice del link: il vecchio smette di funzionare subito. */
  rotateAthleteFamilyLink(athleteId: string, token: string): Promise<AthleteFamilyLink>;
  listMatchAvailability(filter?: { matchIds?: string[]; athleteId?: string }): Promise<MatchAvailability[]>;
  /** Scrive (o sostituisce) la risposta dell'atleta per la partita, «Ci sarà» o «Non ci sarà»: una riga per partita e atleta. */
  setMatchAvailability(input: MatchAvailabilityInput): Promise<MatchAvailability>;
  /** Toglie la risposta: l'atleta torna «senza risposta». */
  clearMatchAvailability(matchId: string, athleteId: string): Promise<void>;

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
  /** Come getLiveScoreState, con l'istante dell'ultimo salvataggio (per la diretta pubblica). */
  getLiveScoreSnapshot(): Promise<{ state: LiveScoreState; updatedAt: string } | null>;
  saveLiveScoreState(state: LiveScoreState): Promise<void>;
  clearLiveScoreState(): Promise<void>;
}
