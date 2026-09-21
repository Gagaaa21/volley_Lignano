import "server-only";
import { unstable_cache } from "next/cache";
import { getRepo } from "@/lib/db";
import type { Category } from "@/lib/types";

/** Tag usato per invalidare la cache da ogni azione admin che tocca il
 * calendario pubblico (allenamenti, partite, schede collegate a una data). */
export const PUBLIC_CALENDAR_TAG = "public-calendar";

/**
 * La home pubblica è l'unica pagina non autenticata del sito e riceve la
 * gran parte del traffico: senza cache, ogni visita rilegge tutto da
 * Supabase. Qui i dati restano validi 5 minuti (o finché un'azione admin
 * non invalida esplicitamente il tag) — chi ha attivato le notifiche viene
 * comunque avvisato subito di ogni cambiamento, quindi qualche minuto di
 * ritardo per chi sfoglia il calendario senza notifiche è un compromesso
 * ragionevole a fronte del traffico risparmiato verso il database.
 */
export const getPublicCalendarData = unstable_cache(
  async (from: string, to: string, category?: Category) => {
    const repo = await getRepo();
    const [trainings, matches, occurrencePlans, plans, blocks] = await Promise.all([
      repo.listTrainings(),
      repo.listMatches({ from, to, category }),
      repo.listTrainingOccurrencePlans(),
      repo.listTrainingPlans(),
      repo.listTrainingBlocks(),
    ]);
    return { trainings, matches, occurrencePlans, plans, blocks };
  },
  ["public-calendar-data"],
  { revalidate: 300, tags: [PUBLIC_CALENDAR_TAG] },
);
