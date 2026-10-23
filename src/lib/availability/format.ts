import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

/** Quando è stata scritta una risposta, per chi la legge: «23 ott, 10:02» (nell'ora italiana, come il resto del sito). */
export function answerWhen(updatedAt: string): string {
  return format(parseISO(updatedAt), "d MMM, HH:mm", { locale: it });
}
