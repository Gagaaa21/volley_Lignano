import type { TrainingTeam } from "@/lib/types";

/**
 * Il primo giorno della vera anagrafica Minivolley (registri con gli id delle atlete). I registri di prima (24 e 25 settembre
 * 2026) avevano nomi liberi al posto degli id: restano nel database, ma non si mostrano né si contano. Non vale per U14/U15,
 * che ha sempre avuto una vera anagrafica.
 */
export const MINIVOLLEY_ATTENDANCE_START = "2026-10-01";

/** Un registro presenze già salvato si mostra e si conta (storico, scheda dell'atleta, riepiloghi, sito pubblico). */
export function isAttendanceSessionCounted(team: TrainingTeam, date: string): boolean {
  return team !== "minivolley" || date >= MINIVOLLEY_ATTENDANCE_START;
}

/**
 * Un allenamento non ancora registrato va proposto come «da registrare». Per il Minivolley solo da oggi in avanti: gli
 * allenamenti passati senza registro non si chiedono (spesso non si segna nulla), mentre quelli registrati restano visibili
 * (vedi isAttendanceSessionCounted).
 */
export function isMinivolleyDateRelevant(team: TrainingTeam, date: string, todayStr: string): boolean {
  return team !== "minivolley" || date >= todayStr;
}

/** Da quando conta un'atleta per la percentuale: il giorno in cui è stata aggiunta (chi arriva a metà anno non risulta assente prima). */
export function athleteJoinDate(createdAt: string | undefined): string | null {
  return createdAt && /^\d{4}-\d{2}-\d{2}/.test(createdAt) ? createdAt.slice(0, 10) : null;
}
