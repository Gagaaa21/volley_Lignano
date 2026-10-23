/**
 * Presenza alle partite. I genitori non hanno un account: ogni atleta ha un link personale e segreto (`AthleteFamilyLink`) con
 * cui il genitore risponde, per ogni partita, «Ci sarà» o «Non ci sarà» (`MatchAvailability`). Anche l'allenatore può scrivere
 * o cambiare la risposta di ogni atleta. Chi non ha risposto non ha nessuna riga. Le risposte le vede solo lo staff: non
 * compaiono mai sul sito pubblico.
 */

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

/** Chi ha scritto l'ultima risposta: il genitore dal suo link, o l'allenatore (per esempio dopo un messaggio in chat). */
export type AnsweredBy = "parent" | "staff";

/** «Risposta del genitore» / «Risposta dell'allenatore». */
export const ANSWERED_BY_PHRASES: Record<AnsweredBy, string> = {
  parent: "del genitore",
  staff: "dell'allenatore",
};

export interface AthleteFamilyLink {
  athleteId: string;
  /** Il codice segreto che sta nel link: lungo e casuale, vedi token.ts. */
  token: string;
  createdAt: string;
  /** Quando il link è stato rigenerato l'ultima volta (da allora il vecchio non funziona più). */
  rotatedAt: string | null;
}

/** La risposta di un'atleta per una partita. Motivo e nota hanno senso solo per un'assenza. */
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
