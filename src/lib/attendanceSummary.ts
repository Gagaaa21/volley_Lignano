import type { Athlete, AttendanceSession } from "@/lib/types";

/** Presenze di un'atleta nel periodo considerato. */
export interface AttendanceSummaryRow {
  athlete: Athlete;
  /** Sedute su cui si calcola la percentuale. */
  total: number;
  present: number;
  excused: number;
  unexcused: number;
  /** Percentuale di presenza 0-100; null se non ci sono sedute. */
  pct: number | null;
}

/**
 * Percentuale di presenza per atleta (usata dal riepilogo CSV e PDF).
 * `sessions` è già filtrato per le sedute che contano (vedi
 * isMinivolleyDateRelevant). Per il Minivolley un'assenza non ha mai una voce
 * nel registro (si salvano solo le presenze), quindi il totale è il numero di
 * sedute registrate per la squadra, non la somma degli stati nel record
 * dell'atleta; giustificate e non giustificate non si tracciano.
 */
export function summarizeAttendance(
  athletes: Athlete[],
  sessions: AttendanceSession[],
  isMinivolley: boolean,
): AttendanceSummaryRow[] {
  return athletes
    .slice()
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((athlete) => {
      let total: number;
      let present: number;
      let excused: number;
      let unexcused: number;
      if (isMinivolley) {
        total = sessions.length;
        present = sessions.filter((s) => athlete.id in s.records).length;
        excused = 0;
        unexcused = 0;
      } else {
        const statuses = sessions.filter((s) => athlete.id in s.records).map((s) => s.records[athlete.id]);
        total = statuses.length;
        present = statuses.filter((s) => s === "present").length;
        excused = statuses.filter((s) => s === "excused").length;
        unexcused = statuses.filter((s) => s === "unexcused").length;
      }
      return {
        athlete,
        total,
        present,
        excused,
        unexcused,
        pct: total > 0 ? Math.round((present / total) * 100) : null,
      };
    });
}
