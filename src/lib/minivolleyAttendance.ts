import type { TrainingTeam } from "@/lib/types";

/** Per il Minivolley le presenze ripartono da oggi: allenamenti e registri
 * precedenti (da prima di questa anagrafica, con nomi liberi invece di id
 * reali) non vengono più mostrati né conteggiati in nessuna vista legata
 * alle presenze. Nessuna cancellazione: restano nel database, solo esclusi
 * dalle viste. Non si applica a U14/U15, che ha sempre avuto una vera
 * anagrafica. */
export function isMinivolleyDateRelevant(team: TrainingTeam, date: string, todayStr: string): boolean {
  return team !== "minivolley" || date >= todayStr;
}
