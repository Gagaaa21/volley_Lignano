import type { AttendanceSession } from "@/lib/types";

/** Tutti i nomi mai scritti in un registro presenze del Minivolley, dal più
 * usato al meno usato: la base sia per i tocchi rapidi mostrati subito
 * (le atlete più regolari in cima, senza dover scrivere nulla) sia per i
 * suggerimenti mentre si digita (vedi MiniAttendanceForm), dato che questa
 * squadra non ha un'anagrafica. */
export function collectKnownNames(sessions: AttendanceSession[]): string[] {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const [name, status] of Object.entries(session.records)) {
      if (status !== "present") continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}
