import type { Repo } from "@/lib/db/repo";
import { isAppSettingsMissing, isAvailabilityTableMissing } from "./missing";
import type { AvailabilityTable } from "./setupSql";

/** Un'atleta che non esiste: basta a chiedere al database se la tabella c'è, senza leggere niente. */
const NOBODY = "00000000-0000-0000-0000-000000000000";

/**
 * Quali tabelle delle assenze mancano nel database (vedi setupSql.ts): tre letture minuscole, una per tabella. Un errore diverso da
 * «tabella inesistente» non è compito di questo controllo, quindi non conta come mancante.
 */
export async function missingAvailabilityTables(repo: Repo): Promise<AvailabilityTable[]> {
  const probe = async (table: AvailabilityTable, read: () => Promise<unknown>, isMissing: (error: unknown) => boolean) => {
    try {
      await read();
      return null;
    } catch (error) {
      return isMissing(error) ? table : null;
    }
  };
  const results = await Promise.all([
    probe("athlete_family_links", () => repo.findAthleteByFamilyToken("A".repeat(32)), isAvailabilityTableMissing),
    probe("match_availability", () => repo.listMatchAvailability({ athleteId: NOBODY }), isAvailabilityTableMissing),
    probe("app_settings", () => repo.getReportingRules(), isAppSettingsMissing),
  ]);
  return results.filter((table): table is AvailabilityTable => table !== null);
}
