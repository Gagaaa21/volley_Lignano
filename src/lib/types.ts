export type StaffRole = "dev" | "admin";

export interface StaffMember {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: StaffRole;
  mustChangePassword: boolean;
  hasSeenGuide: boolean;
  createdBy: string | null;
  createdAt: string;
}

export type PublicStaffMember = Omit<StaffMember, "passwordHash">;

export type Category = "U14" | "U15";

export const CATEGORIES: Category[] = ["U14", "U15"];

export const WEEKDAY_LABELS = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
] as const;

export const WEEKDAY_LABELS_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"] as const;

export type TrainingRepeat = "weekly" | "once";

export interface TrainingRule {
  id: string;
  title: string;
  location: string;
  repeat: TrainingRepeat;
  weekdays: number[]; // 0 = Sunday ... 6 = Saturday (ignorato se repeat = "once")
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  startDate: string; // ISO date "YYYY-MM-DD" (per "once" è la data dell'evento)
  endDate: string | null; // ISO date o null = indefinito (ignorato se repeat = "once")
  notes: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TrainingRuleInput = Omit<
  TrainingRule,
  "id" | "createdBy" | "createdAt" | "updatedAt"
>;

/** Punteggio di un singolo set (parziale). */
export interface SetScore {
  us: number;
  them: number;
}

export interface Match {
  id: string;
  category: Category;
  opponent: string;
  isHome: boolean;
  location: string;
  matchDate: string; // ISO datetime
  /** Amichevole invece che di campionato. */
  isFriendly: boolean;
  /** Orario di ritrovo, se diverso dall'orario della partita. */
  meetingTime: string | null; // "HH:MM"
  /** Luogo di ritrovo, se diverso dal luogo della partita. */
  meetingLocation: string | null;
  notes: string | null;
  calledUpAthleteIds: string[]; // convocate per questa partita
  /** Parziali dei singoli set, in ordine di gioco; valorizzati solo a partita giocata. */
  setScores: SetScore[] | null;
  /** Set vinti/persi totali, derivati automaticamente dai parziali. */
  resultSetsWon: number | null;
  resultSetsLost: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MatchInput = Omit<Match, "id" | "createdBy" | "createdAt" | "updatedAt">;

// Formazioni partita (riservate allo staff, mai esposte sul sito pubblico) —
// ruoli standard della pallavolo assegnabili a ciascuna delle 6 posizioni in
// campo, per ognuno dei 5 set possibili.
export type VolleyRole = "S" | "OH" | "MB" | "OP" | "L";

export const VOLLEY_ROLES: VolleyRole[] = ["S", "OH", "MB", "OP", "L"];

export const VOLLEY_ROLE_LABELS: Record<VolleyRole, string> = {
  S: "Palleggiatrice",
  OH: "Schiacciatrice",
  MB: "Centrale",
  OP: "Opposto",
  L: "Libero",
};

export type CourtPosition = 1 | 2 | 3 | 4 | 5 | 6;

export const COURT_POSITIONS: CourtPosition[] = [1, 2, 3, 4, 5, 6];

export interface LineupSlot {
  position: CourtPosition;
  athleteId: string | null;
  role: VolleyRole | null;
  isCaptain: boolean;
}

export interface SetLineup {
  /** Sempre 6 elementi, uno per posizione in campo (1-6). */
  slots: LineupSlot[];
  /** Liberi "fuori dalla rotazione": sempre 2 elementi (il secondo libero è
   * opzionale). Non fanno parte delle 6 posizioni — nella pallavolo il
   * libero non ruota, sostituisce chi è in seconda linea senza contare come
   * cambio. */
  liberoIds: (string | null)[];
}

export interface MatchLineup {
  matchId: string;
  /** Sempre 5 elementi: indice 0 = set 1 ... indice 4 = set 5. */
  sets: SetLineup[];
  updatedBy: string | null;
  updatedAt: string;
}

export type MatchLineupInput = {
  sets: SetLineup[];
};

export function emptySetLineup(): SetLineup {
  return {
    slots: COURT_POSITIONS.map((position) => ({
      position,
      athleteId: null,
      role: null,
      isCaptain: false,
    })),
    liberoIds: [null, null],
  };
}

export function emptyMatchLineupSets(): SetLineup[] {
  return Array.from({ length: 5 }, () => emptySetLineup());
}

export interface TrainingBlock {
  id: string;
  title: string;
  durationMinutes: number;
  content: string; // testo libero, righe con "-"/"*" o "1." diventano liste
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TrainingBlockInput = Omit<
  TrainingBlock,
  "id" | "createdBy" | "createdAt" | "updatedAt"
>;

export interface TrainingPlan {
  id: string;
  title: string;
  notes: string | null;
  blockIds: string[]; // ordine dei blocchi nella scheda
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TrainingPlanInput = Omit<
  TrainingPlan,
  "id" | "createdBy" | "createdAt" | "updatedAt"
>;

// Scheda collegata a un singolo giorno di allenamento: anche se la regola
// (TrainingRule) è ricorrente, questo collegamento vale solo per quella data.
export interface TrainingOccurrencePlan {
  id: string;
  trainingRuleId: string;
  occurrenceDate: string; // "YYYY-MM-DD"
  planId: string;
  /** Se true, il contenuto della scheda compare nel dettaglio dell'allenamento
   * sul calendario pubblico. Scelta esplicita fatta ogni volta che si collega
   * una scheda: di default non è pubblica. */
  isPublic: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Athlete {
  id: string;
  fullName: string;
  category: Category | null;
  isActive: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AthleteInput = Omit<Athlete, "id" | "createdBy" | "createdAt" | "updatedAt">;

export type AttendanceStatus = "present" | "excused" | "unexcused";

export interface AttendanceSession {
  id: string;
  trainingRuleId: string | null;
  sessionDate: string; // "YYYY-MM-DD"
  title: string; // istantanea del titolo dell'allenamento al momento della registrazione
  location: string; // istantanea del luogo
  records: Record<string, AttendanceStatus>; // athleteId -> stato
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceSessionInput = Omit<
  AttendanceSession,
  "id" | "createdBy" | "createdAt" | "updatedAt"
>;

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** Staff collegato all'iscrizione, se attivata da un utente autenticato (area riservata). */
  staffId: string | null;
  createdAt: string;
}

export type CalendarEvent =
  | {
      kind: "training";
      id: string;
      ruleId: string;
      date: string; // "YYYY-MM-DD"
      startTime: string;
      endTime: string;
      title: string;
      location: string;
      notes: string | null;
      planId: string | null; // scheda collegata a questa singola data (opzionale)
    }
  | {
      kind: "match";
      id: string;
      date: string; // "YYYY-MM-DD"
      time: string;
      category: Category;
      opponent: string;
      isHome: boolean;
      location: string;
      isFriendly: boolean;
      meetingTime: string | null;
      meetingLocation: string | null;
      notes: string | null;
      setScores: SetScore[] | null;
      resultSetsWon: number | null;
      resultSetsLost: number | null;
    };

export interface StorageTableInfo {
  table: string;
  rowCount: number;
  /** Byte reali su Supabase (indici inclusi); stima JSON in modalità demo. */
  sizeBytes: number | null;
}

export interface StorageOverview {
  tables: StorageTableInfo[];
  generatedAt: string;
}
