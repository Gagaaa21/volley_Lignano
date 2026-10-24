/**
 * Assenze alle partite. I genitori non hanno un account: ogni atleta ha un link personale e segreto (`AthleteFamilyLink`) con
 * cui il genitore segnala che la figlia **non ci sarà** a una partita (`MatchAvailability` con stato «absent»), con un motivo e una
 * nota se vuole; si chiede solo questo: chi non segnala niente ci sarà. Il genitore può farlo fino a 5 giorni prima della partita
 * (`REPORT_CLOSES_DAYS_BEFORE`); l'allenatore sempre. Le assenze le vede solo lo staff: non compaiono mai sul sito pubblico.
 */

/** Il genitore segnala un'assenza (o la toglie) fino a tanti giorni prima dell'inizio della partita; poi solo l'allenatore. */
export const REPORT_CLOSES_DAYS_BEFORE = 5;

/** Si scrive solo «absent»: le righe «present» sono di una versione di prova (ottobre 2026) e non contano più. */
export const ANSWER_STATUSES = ["present", "absent"] as const;
export type AnswerStatus = (typeof ANSWER_STATUSES)[number];

export const ANSWER_LABELS: Record<AnswerStatus, string> = {
  present: "Ci sarà",
  absent: "Non ci sarà",
};

/** Il perché di un'assenza, a scelta tra questi (mai testo libero al suo posto: per quello c'è la nota). */
export const ABSENCE_REASONS = ["malata", "famiglia", "altro"] as const;
export type AbsenceReason = (typeof ABSENCE_REASONS)[number];

export const ABSENCE_REASON_LABELS: Record<AbsenceReason, string> = {
  malata: "Malata o infortunata",
  famiglia: "Impegno di famiglia",
  altro: "Altro",
};

/** Lunghezza massima della nota facoltativa. */
export const MAX_NOTE_LENGTH = 120;

/** Chi ha scritto l'assenza (l'ultima modifica): il genitore dal suo link, o l'allenatore (per esempio dopo un messaggio in chat). */
export type AnsweredBy = "parent" | "staff";

/** «Segnalata dal genitore» / «Segnalata dall'allenatore». */
export const ANSWERED_BY_PHRASES: Record<AnsweredBy, string> = {
  parent: "dal genitore",
  staff: "dall'allenatore",
};

export interface AthleteFamilyLink {
  athleteId: string;
  /** Il codice segreto che sta nel link: lungo e casuale, vedi token.ts. */
  token: string;
  createdAt: string;
  /** Quando il link è stato rigenerato l'ultima volta (da allora il vecchio non funziona più). */
  rotatedAt: string | null;
}

/** L'assenza di un'atleta da una partita (una riga per partita e atleta; nessuna riga = ci sarà). */
export interface MatchAvailability {
  matchId: string;
  athleteId: string;
  status: AnswerStatus;
  reason: AbsenceReason | null;
  note: string | null;
  answeredBy: AnsweredBy;
  /** Chi dello staff l'ha scritta o cambiata (solo se `answeredBy` è «staff»). */
  updatedBy: string | null;
  /** L'ultimo momento in cui è stata scritta o cambiata. */
  updatedAt: string;
}

export type MatchAvailabilityInput = Omit<MatchAvailability, "updatedAt">;
