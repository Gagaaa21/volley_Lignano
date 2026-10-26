import "server-only";
import type { Repo } from "@/lib/db/repo";
import { isAppSettingsMissing } from "@/lib/availability/missing";
import { DEFAULT_REPORTING_RULES, type MatchReporting, type ReportingRules } from "@/lib/availability/reporting";

/** Le letture che possono mancare finché il database non è completo: al loro posto un valore vuoto (lo spiega l'avviso in cima). */
export async function orEmpty<T>(read: Promise<T>, empty: T, isMissing: (error: unknown) => boolean): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (!isMissing(error)) throw error;
    return empty;
  }
}

/** Le regole e le scelte a mano per le partite indicate; senza la tabella delle impostazioni valgono quelle di serie. */
export async function loadReporting(repo: Repo, matchIds: string[]): Promise<{ rules: ReportingRules; settings: Map<string, MatchReporting> }> {
  const [rules, settings] = await Promise.all([
    orEmpty<ReportingRules>(repo.getReportingRules(), DEFAULT_REPORTING_RULES, isAppSettingsMissing),
    orEmpty<MatchReporting[]>(repo.listMatchReporting(matchIds), [], isAppSettingsMissing),
  ]);
  return { rules, settings: new Map(settings.map((setting) => [setting.matchId, setting] as const)) };
}
