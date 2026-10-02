export type StaffRole = "dev" | "admin";

/** Ogni sezione dell'area riservata che un Developer può nascondere a un
 * singolo account Admin (Dashboard esclusa: sempre visibile a tutti).
 * Minivolley non è più una sezione a sé: ogni pagina gestisce entrambe le
 * squadre tramite lo switcher squadra nell'header. */
export type AdminPage =
  | "allenamenti"
  | "partite"
  | "schede"
  | "presenze"
  | "testfisici"
  | "livescore"
  | "pronostici"
  | "staff"
  | "guida";

/** Pagine assegnabili a un Admin dal Centro di controllo (quelle che
 * compaiono come casella nella matrice permessi): un Admin può ricevere
 * accesso a "testfisici" come a qualunque altra, il Developer decide caso
 * per caso. Per il default di un account nuovo vedi
 * DEFAULT_NEW_ADMIN_PAGES, leggermente diverso. */
export const ADMIN_PAGES: AdminPage[] = [
  "allenamenti",
  "partite",
  "schede",
  "presenze",
  "testfisici",
  "livescore",
  "pronostici",
  "staff",
  "guida",
];

/** Pagine assegnate di default quando un Developer crea un nuovo account
 * Admin: uguale a ADMIN_PAGES tranne "testfisici", la cui sezione è ancora
 * in costruzione (i dati da registrare non sono definiti) — un nuovo
 * Admin parte senza, il Developer la spunta per un account specifico dalla
 * matrice permessi quando lo ritiene pronto. */
export const DEFAULT_NEW_ADMIN_PAGES: AdminPage[] = ADMIN_PAGES.filter((page) => page !== "testfisici");

export const ADMIN_PAGE_LABELS: Record<AdminPage, string> = {
  allenamenti: "Allenamenti",
  partite: "Partite",
  schede: "Schede",
  presenze: "Presenze",
  testfisici: "Test fisici",
  livescore: "Live score",
  pronostici: "Pronostici",
  staff: "Staff",
  guida: "Guida",
};

/** Pagine non disponibili per la squadra Minivolley, indipendentemente dai
 * permessi dell'account (vale anche per un Developer): "Partite" è stata
 * rimossa del tutto — la squadra non gioca partite di campionato con
 * risultato, solo tornei multi-club, già coperti da "Allenamenti"
 * (isTournament). "Pronostici" ne dipende (si pronostica il risultato di
 * una partita) e quindi segue la stessa esclusione. "Test fisici" non si
 * applica a questa squadra (atlete troppo piccole per questo tipo di
 * rilevazioni). "Presenze" invece resta disponibile per entrambe le
 * squadre, con la stessa anagrafica di U14/U15 (atlete raggruppate per CDA
 * invece che per categoria) ma un flusso di registrazione diverso per il
 * Minivolley (vedi MiniAttendanceForm): un elenco con spunte ma senza
 * assenze tracciate, solo chi era presente. */
const PAGES_UNAVAILABLE_FOR_MINIVOLLEY: readonly AdminPage[] = ["partite", "pronostici", "testfisici"];

export function isPageAvailableForTeam(page: AdminPage, team: TrainingTeam): boolean {
  return team !== "minivolley" || !PAGES_UNAVAILABLE_FOR_MINIVOLLEY.includes(page);
}

export interface StaffMember {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: StaffRole;
  mustChangePassword: boolean;
  hasSeenGuide: boolean;
  /** Pagine dell'area riservata visibili a questo account (solo per role
   * "admin": un Developer vede sempre tutto, a prescindere da questo
   * campo). Di default tutte, così un account esistente non perde accesso
   * finché il Developer non lo restringe esplicitamente dal Centro di
   * controllo. */
  allowedPages: AdminPage[];
  /** Squadre gestibili da questo account tramite lo switcher nell'header
   * (solo per role "admin": un Developer vede sempre entrambe). Di default
   * entrambe, così un account esistente non perde accesso finché il
   * Developer non lo restringe esplicitamente dal Centro di controllo. */
  allowedTeams: TrainingTeam[];
  /** Se true, questo account non compare nell'elenco Staff visto da altri
   * Admin (solo lì — resta comunque l'autore visibile ovunque compaia
   * "creato da"): il Developer lo vede sempre, e la pagina/azioni di
   * modifica restano comunque riservate al Developer come per ogni altro
   * account admin, quindi non serve altra protezione oltre al filtro
   * sull'elenco. Impostabile solo dal Developer, mai dall'admin stesso. */
  hiddenFromAdmins: boolean;
  createdBy: string | null;
  createdAt: string;
}

export type PublicStaffMember = Omit<StaffMember, "passwordHash">;

export type Category = "U14" | "U15";

export const CATEGORIES: Category[] = ["U14", "U15"];

/** Gruppo di appartenenza dentro il Minivolley: due sedi (CDA) distinte,
 * analogo di Category ma per l'altro asse — si applica solo dentro
 * "minivolley", resta sempre null per u14u15. */
export type MinivolleyGroup = "lignano" | "san_michele";

export const MINIVOLLEY_GROUPS: MinivolleyGroup[] = ["lignano", "san_michele"];

/** Squadra a cui appartiene un allenamento, una partita, una scheda,
 * un'atleta o un registro presenze: "u14u15" è il gruppo agonistico di
 * oggi (condiviso tra le due categorie), "minivolley" è la squadra più
 * piccola, con calendario e pagina pubblica separati. Nell'area riservata
 * si sceglie con lo switcher squadra nell'header, valido per tutta la
 * sessione. Indipendente da Category, che resta usata solo per distinguere
 * U14/U15 dentro la squadra "u14u15". */
export type TrainingTeam = "u14u15" | "minivolley";

export const TEAMS: TrainingTeam[] = ["u14u15", "minivolley"];

export const TEAM_LABELS: Record<TrainingTeam, string> = {
  u14u15: "U14/U15",
  minivolley: "Minivolley",
};

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

/** Colore assegnato a una regola di allenamento, per distinguerla a colpo
 * d'occhio sul calendario da altre regole (es. "Tecnica" vs "Fisico" vs
 * "Minivolley base"). Fissi (non scelti liberamente) per restare sempre
 * leggibili col resto del design: vedi TRAINING_COLOR_* in lib/category.ts. */
export const TRAINING_COLORS = [
  "amber",
  "blue",
  "green",
  "teal",
  "violet",
  "pink",
  "orange",
  "slate",
] as const;
export type TrainingColor = (typeof TRAINING_COLORS)[number];
export const DEFAULT_TRAINING_COLOR: TrainingColor = "amber";

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
  /** Squadra a cui appartiene: scopa il calendario pubblico, la pagina
   * admin e le notifiche push. Default "u14u15" per tutti gli allenamenti
   * di oggi. */
  team: TrainingTeam;
  /** Torneo/giornata multi-club (solo Minivolley): un evento singolo senza
   * avversario/risultato, mostrato con badge "Torneo" invece di
   * "Allenamento" ovunque nel calendario. */
  isTournament: boolean;
  color: TrainingColor;
  /** Date (ISO "YYYY-MM-DD") saltate per una regola ricorrente (es. una
   * festività): expandTrainings() non genera un'occorrenza per queste date,
   * pur mantenendo intatta la regola per tutte le altre. Ignorato per
   * repeat "once" (un'unica occorrenza si gestisce disattivando la regola
   * stessa). */
  excludedDates: string[];
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

/** Una partita giocata (o pronosticata) dentro un torneo: un'avversaria
 * affrontata e il suo risultato set per set. Le partite normali non usano
 * questo tipo — restano su Match.setScores/opponent, "noi vs loro" contro
 * un'unica avversaria, come sempre. */
export interface TournamentGame {
  id: string;
  opponent: string;
  /** Stessa regola di validità di Match.setScores (una squadra a 3 set
   * vinti, nessun set in parità); vuoto se l'avversaria è nota ma non si è
   * ancora giocato (solo per il risultato reale — un pronostico senza
   * punteggio non ha senso e viene scartato). */
  setScores: SetScore[];
}

export interface Match {
  id: string;
  /** Squadra a cui appartiene: scopa l'elenco admin, il calendario pubblico
   * e le notifiche push, come per TrainingRule. */
  team: TrainingTeam;
  /** Null per il Minivolley, che non ha la distinzione U14/U15. */
  category: Category | null;
  opponent: string;
  isHome: boolean;
  location: string;
  matchDate: string; // ISO datetime
  /** Amichevole invece che di campionato. */
  isFriendly: boolean;
  /** Torneo/triangolare con più squadre coinvolte: "opponent" descrive
   * l'evento invece di una singola avversaria, quindi in visualizzazione
   * non va anteposto "vs" (vedi matchTitle in lib/calendar.ts). Esclusa
   * dal bilancio stagione allo stesso modo delle amichevoli: un
   * risultato vinta/persa contro una singola squadra non ha senso qui. */
  isTournament: boolean;
  /** Orario di ritrovo, se diverso dall'orario della partita. */
  meetingTime: string | null; // "HH:MM"
  /** Luogo di ritrovo, se diverso dal luogo della partita. */
  meetingLocation: string | null;
  notes: string | null;
  calledUpAthleteIds: string[]; // convocate per questa partita
  /** Parziali dei singoli set, in ordine di gioco; valorizzati solo a partita
   * giocata. Sempre null per i tornei (vedi tournamentGames): con più
   * avversarie non c'è un unico "noi vs loro" a cui applicarli. */
  setScores: SetScore[] | null;
  /** Set vinti/persi totali, derivati automaticamente dai parziali. Sempre
   * null per i tornei, per lo stesso motivo di setScores. */
  resultSetsWon: number | null;
  resultSetsLost: number | null;
  /** Solo per isTournament: le partite giocate nel torneo, una per
   * avversaria affrontata. Null per le partite normali. */
  tournamentGames: TournamentGame[] | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MatchInput = Omit<Match, "id" | "createdBy" | "createdAt" | "updatedAt">;

/** Pronostico di un membro dello staff sul punteggio di ogni set di una
 * partita non ancora giocata (vedi "Pronostici", src/lib/predictions.ts per
 * come viene giudicato). Stessa forma di Match.setScores (us = Volley
 * Lignano), ma qui è sempre valorizzato: un pronostico deve essere un esito
 * di partita completo e valido (una squadra a 3 set vinti, nessun set in
 * parità), non un risultato parziale. Un solo pronostico per (matchId,
 * staffId): si sovrascrive modificandolo, non se ne accumulano più di uno. */
export interface MatchPrediction {
  id: string;
  matchId: string;
  staffId: string;
  /** Usato solo per le partite non-torneo. */
  setScores: SetScore[] | null;
  /** Usato solo per i tornei: una partita pronosticata per ogni avversaria
   * che lo staff pensa di affrontare, abbinata al risultato reale per nome
   * avversaria (vedi computeTournamentMatchResults in lib/predictions.ts). */
  tournamentGames: TournamentGame[] | null;
  createdAt: string;
  updatedAt: string;
}

export type MatchPredictionInput = { setScores: SetScore[] | null; tournamentGames: TournamentGame[] | null };

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

/** Blocco di allenamento incorporato in una scheda: nasce dal testo incollato
 * (diviso automaticamente per intestazione numerata) e vive solo dentro
 * quella scheda, senza libreria condivisa da riusare altrove. */
export interface PlanBlock {
  id: string;
  title: string;
  durationMinutes: number;
  content: string; // testo libero, righe con "-"/"*" o "1." diventano liste
}

export interface TrainingPlan {
  id: string;
  title: string;
  notes: string | null;
  blocks: PlanBlock[]; // blocchi della scheda, in ordine
  /** Squadra a cui appartiene la scheda. */
  team: TrainingTeam;
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
  /** Squadra a cui appartiene. Category si applica solo dentro "u14u15": per
   * il Minivolley resta sempre null. */
  team: TrainingTeam;
  category: Category | null;
  /** Speculare a category ma per il Minivolley: resta sempre null dentro
   * "u14u15". Opzionale anche dentro Minivolley (assegnabile in un secondo
   * momento), come già avviene per category. */
  group: MinivolleyGroup | null;
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
  /** Squadra a cui appartiene: necessario anche quando trainingRuleId è
   * null (registro non collegato a una regola), quindi non sempre derivabile
   * dall'allenamento collegato. */
  team: TrainingTeam;
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

/** Risultato di un test fisico assegnato a una singola atleta (es. altezza
 * di salto). Predisposizione volutamente libera: non è ancora definito
 * quali test verranno effettuati, quindi sia il nome del test che il
 * valore restano testo libero invece di un elenco fisso o un numero con
 * unità di misura imposta. Il nome del test digitato viene riproposto come
 * suggerimento per le prove successive (vedi PhysicalTestForm), così lo
 * stesso test resta riconoscibile e confrontabile nel tempo per la stessa
 * atleta, anche senza un catalogo rigido. */
export interface PhysicalTest {
  id: string;
  athleteId: string;
  /** Squadra dell'atleta al momento della registrazione: non cambia mai in
   * modifica, derivata sempre da Athlete.team (vedi savePhysicalTestAction),
   * mai scelta liberamente nel form. */
  team: TrainingTeam;
  testName: string;
  value: string;
  /** "YYYY-MM-DD": proposta come data odierna ma modificabile, per poter
   * registrare un test effettuato in un giorno diverso da oggi. */
  date: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PhysicalTestInput = Omit<
  PhysicalTest,
  "id" | "createdBy" | "createdAt" | "updatedAt"
>;

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** Staff collegato all'iscrizione, se attivata da un utente autenticato (area riservata). */
  staffId: string | null;
  /** Squadra scelta al momento dell'iscrizione (in base alla pagina da cui è
   * stata attivata): scopa le notifiche calendario così chi segue Minivolley
   * non riceve avvisi U14/U15 e viceversa. */
  team: TrainingTeam;
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
      team: TrainingTeam;
      isTournament: boolean;
      color: TrainingColor;
    }
  | {
      kind: "match";
      id: string;
      date: string; // "YYYY-MM-DD"
      time: string;
      team: TrainingTeam;
      category: Category | null;
      opponent: string;
      isHome: boolean;
      location: string;
      isFriendly: boolean;
      isTournament: boolean;
      meetingTime: string | null;
      meetingLocation: string | null;
      notes: string | null;
      setScores: SetScore[] | null;
      resultSetsWon: number | null;
      resultSetsLost: number | null;
      tournamentGames: TournamentGame[] | null;
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

/** Formazione, libero e punteggio di una delle due squadre nel tabellone
 * live (src/app/admin/livescore): stesso significato dei campi lato
 * client, così il salvataggio automatico può scrivere e rileggere lo
 * stato senza trasformazioni. Niente storico punti (per l'annulla): è una
 * comodità solo per la sessione in corso, non serve sopravvivere a un
 * ricaricamento. */
export interface LiveScoreTeamState {
  label: string;
  positions: [string, string, string, string, string, string];
  liberoName: string;
  /** Le due centrali che la libero può sostituire (il regolamento parla
   * sempre di due giocatrici, mai una sola). */
  hostNames: [string, string];
  /** Nome della centrale che la libero sta sostituendo in questo momento,
   * o null se in campo giocano loro stesse. Non è deducibile dalla sola
   * formazione: la libero entra solo dopo che la centrale è arrivata in
   * battuta (posizione 1) e ha perso il punto, quindi va tracciato come
   * stato a sé (vedi applyPoint in LiveScoreClient.tsx). */
  liberoActiveFor: string | null;
  score: number;
  setsWon: number;
  /** Time-out chiamati in questo set (regolamento: 2 a disposizione per
   * squadra per set). Azzerato alla chiusura del set insieme al punteggio. */
  timeoutsUsed: number;
}

/** Punteggio finale di un set già chiuso, per lo storico mostrato in
 * partita (es. "25-20") — altrimenti quel dato andrebbe perso non appena
 * il punteggio si azzera per il set successivo. */
export interface LiveScoreSetResult {
  scoreA: number;
  scoreB: number;
}

/** "training" (default): nomi delle atlete nelle 6 posizioni, come durante
 * un allenamento. "match": numeri di maglia al posto dei nomi (spesso non
 * si conoscono le atlete avversarie) e Squadra A è sempre "Volley Lignano"
 * a etichetta fissa — si scrive solo il nome dell'avversaria in Squadra B. */
export type LiveScoreMode = "training" | "match";

export interface LiveScoreState {
  started: boolean;
  /** "training" o "match" (vedi LiveScoreMode) — scelto in fase di
   * impostazione, prima di "Inizia", e non più modificabile a match
   * avviato. */
  mode: LiveScoreMode;
  /** Chi sta servendo in questo momento: unico per tutto il match, dato
   * che le due squadre giocano davvero una contro l'altra sullo stesso
   * campo (non due punteggi indipendenti). null solo prima che il coach
   * scelga chi serve per prima, in fase di impostazione. */
  servingTeam: "A" | "B" | null;
  /** Se true, la Squadra A è disegnata sulla metà campo destra e la
   * Squadra B su quella sinistra (vedi "Inverti campi") — solo resa
   * visiva, non tocca mai i dati delle due squadre. */
  sidesSwapped: boolean;
  teamA: LiveScoreTeamState;
  teamB: LiveScoreTeamState;
  setHistory: LiveScoreSetResult[];
  /** Colore (esadecimale) della Squadra B in modalità "Partita", scelto dal
   * coach per riconoscere l'avversaria vera invece di un colore inventato —
   * in modalità "Allenamento" non si usa (Squadra B è sempre giallo acceso,
   * vedi getTeamAccent in LiveScoreClient.tsx). */
  opponentColor: string;
}

/** Il tabellone live si salva in automatico (per non perdere tutto se la
 * pagina si ricarica) ma solo per poche ore: oltre questa soglia lo stato
 * salvato viene ignorato come se non ci fosse, evitando che un allenamento
 * di settimane fa resti a galleggiare nel database. */
export const LIVE_SCORE_TTL_MS = 3 * 60 * 60 * 1000;
