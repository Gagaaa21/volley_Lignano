import type { AttendanceSession } from "@/lib/types";

/** Tutti i nomi mai scritti in un registro presenze del Minivolley, in
 * ordine alfabetico: la base per i suggerimenti mentre si scrive (vedi
 * MiniAttendanceForm), dato che questa squadra non ha un'anagrafica. */
export function collectKnownNames(sessions: AttendanceSession[]): string[] {
  const names = new Set<string>();
  for (const session of sessions) {
    for (const name of Object.keys(session.records)) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
