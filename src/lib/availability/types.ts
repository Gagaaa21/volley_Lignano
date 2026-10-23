/**
 * Disponibilità delle atlete per le partite. I genitori non hanno un account: ogni atleta ha un link personale e segreto
 * (`AthleteFamilyLink`) con cui il genitore segna che la figlia non c'è a una partita (`MatchUnavailability`). Le
 * segnalazioni le vede solo lo staff: non compaiono mai sul sito pubblico.
 */

export const UNAVAILABILITY_REASONS = ["malata", "famiglia", "altro"] as const;
export type UnavailabilityReason = (typeof UNAVAILABILITY_REASONS)[number];

export const UNAVAILABILITY_REASON_LABELS: Record<UnavailabilityReason, string> = {
  malata: "Malata o infortunata",
  famiglia: "Impegno di famiglia",
  altro: "Altro",
};

/** Lunghezza massima della nota facoltativa. */
export const MAX_NOTE_LENGTH = 120;

/** Chi ha fatto la segnalazione: il genitore dal suo link, o lo staff (per esempio dopo un messaggio in chat). */
export type ReportedBy = "parent" | "staff";

export interface AthleteFamilyLink {
  athleteId: string;
  /** Il codice segreto che sta nel link: lungo e casuale, vedi token.ts. */
  token: string;
  createdAt: string;
  /** Quando il link è stato rigenerato l'ultima volta (da allora il vecchio non funziona più). */
  rotatedAt: string | null;
}

export interface MatchUnavailability {
  matchId: string;
  athleteId: string;
  reason: UnavailabilityReason | null;
  note: string | null;
  reportedBy: ReportedBy;
  /** Chi dello staff l'ha inserita o cambiata (solo se `reportedBy` è «staff»). */
  updatedBy: string | null;
  /** L'ultimo momento in cui è stata scritta o cambiata. */
  reportedAt: string;
}

export type MatchUnavailabilityInput = Omit<MatchUnavailability, "reportedAt">;
