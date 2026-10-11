import type { Athlete } from "@/lib/types";
import type { TakenJersey } from "./AthleteForm";

/** I numeri già dati alle altre atlete attive (esclusa `exceptId`, l'atleta che si sta modificando). */
export function takenJerseys(athletes: Athlete[], exceptId?: string): TakenJersey[] {
  return athletes
    .filter((a) => a.isActive && a.id !== exceptId && a.jerseyNumber !== null)
    .map((a) => ({ name: a.fullName, category: a.category, jerseyNumber: a.jerseyNumber as number }));
}
