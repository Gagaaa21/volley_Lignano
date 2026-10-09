import "server-only";
import {
  computePortalView,
  portalTodoCount,
  type PortalCategoryView,
  type PortalGameStatus,
} from "@/lib/federation/portal";
import type { FederationSnapshot, FederationSource } from "@/lib/federation/types";
import type { Repo } from "@/lib/db/repo";
import type { Match } from "@/lib/types";

export interface CategoryOfficial {
  source: FederationSource;
  /** Ultimo contenuto letto (e ultimo errore); null se non è mai stato letto. */
  snapshot: FederationSnapshot | null;
  /** Confronto tra gare ufficiali e partite del sito; null senza dati letti. */
  view: PortalCategoryView | null;
}

/** Per ogni categoria: dove si legge, cosa è stato letto e cosa c'è da
 * sistemare. Solo letture dal database, mai dal portale. Chi ha già in mano
 * le partite U14/U15 le passa, così non si rileggono. */
export async function loadOfficialResults(repo: Repo, knownMatches?: Promise<Match[]>): Promise<CategoryOfficial[]> {
  try {
    const [sources, snapshots, decisions, matches] = await Promise.all([
      repo.listFederationSources(),
      repo.listFederationSnapshots(),
      repo.listFederationDecisions(),
      knownMatches ?? repo.listMatches({ team: "u14u15" }),
    ]);

    return sources.map((source) => {
      const snapshot = snapshots.find((snap) => snap.category === source.category) ?? null;
      const view =
        source.enabled && snapshot?.girone
          ? computePortalView({
              category: source.category,
              girone: snapshot.girone,
              aliases: source.teamAliases,
              matches,
              decisions,
            })
          : null;
      return { source, snapshot, view };
    });
  } catch (error) {
    // Es. le tabelle della federazione non sono ancora state create su
    // Supabase (vedi supabase/schema.sql): Partite e Dashboard devono
    // continuare a funzionare, semplicemente senza questa sezione.
    console.error("[federation] risultati ufficiali non disponibili:", error);
    return [];
  }
}

/** Cose da sistemare (gare e partite del sito) in tutte le categorie. Le
 * partite del portale non ancora inserite non contano: aggiungerle è facoltativo. */
export function officialTodoCount(official: CategoryOfficial[]): number {
  return official.reduce((total, entry) => total + (entry.view ? portalTodoCount(entry.view) : 0), 0);
}

/** Partite del calendario ufficiale (da giocare) che nel sito non ci sono ancora. */
export function officialToAddCount(official: CategoryOfficial[]): number {
  return official.reduce(
    (total, entry) => total + (entry.view?.games.filter((game) => game.status === "to-add").length ?? 0),
    0,
  );
}

/** Le cose da sistemare a parole, per gli avvisi: «1 risultato da confermare», «2 partite cambiate», «3 da verificare». */
export function officialTodoParts(official: CategoryOfficial[]): string[] {
  const games = official.flatMap((entry) => entry.view?.games ?? []);
  const count = (...statuses: PortalGameStatus[]) => games.filter((game) => statuses.includes(game.status)).length;
  const results = count("result");
  const changed = count("changed");
  const toCheck =
    count("conflict", "maybe-same", "played-missing") +
    official.reduce((total, entry) => total + (entry.view?.orphans.length ?? 0), 0);
  const parts: string[] = [];
  if (results > 0) parts.push(results === 1 ? "1 risultato da confermare" : `${results} risultati da confermare`);
  if (changed > 0) parts.push(changed === 1 ? "1 partita cambiata" : `${changed} partite cambiate`);
  if (toCheck > 0) parts.push(`${toCheck} da verificare`);
  return parts;
}
