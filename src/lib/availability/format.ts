import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

/** Quando è stata segnalata un'assenza, per chi la legge: «23 ott, 10:02» (nell'ora italiana, come il resto del sito). */
export function answerWhen(updatedAt: string): string {
  return format(parseISO(updatedAt), "d MMM, HH:mm", { locale: it });
}

/** Fino a quando si può segnalare, per il genitore: «lunedì 19 ottobre, ore 18:00». */
export function deadlineLabel(deadline: string): string {
  return format(parseISO(deadline), "EEEE d MMMM', ore' HH:mm", { locale: it });
}
