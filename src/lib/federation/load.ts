import "server-only";
import { computeCalendarImport, type CalendarImportSet } from "@/lib/federation/calendarImport";
import { computeProposals, type Proposal, type ProposalSet } from "@/lib/federation/proposals";
import type { FederationSnapshot, FederationSource } from "@/lib/federation/types";
import type { Repo } from "@/lib/db/repo";

export interface CategoryOfficial {
  source: FederationSource;
  /** Ultimo contenuto letto (e ultimo errore); null se non è mai stato letto. */
  snapshot: FederationSnapshot | null;
  /** Null se per questa categoria non c'è ancora nulla da confrontare. */
  proposals: ProposalSet | null;
  /** Gare del calendario ufficiale che mancano nel sito; null senza dati letti. */
  calendar: CalendarImportSet | null;
}

/** Per ogni categoria: dove si legge, cosa è stato letto e cosa si può
 * proporre agli admin. Solo letture dal database, mai dal portale. */
export async function loadOfficialResults(repo: Repo): Promise<CategoryOfficial[]> {
  try {
    const [sources, snapshots, decisions, matches] = await Promise.all([
      repo.listFederationSources(),
      repo.listFederationSnapshots(),
      repo.listFederationDecisions(),
      repo.listMatches({ team: "u14u15" }),
    ]);

    return sources.map((source) => {
      const snapshot = snapshots.find((snap) => snap.category === source.category) ?? null;
      const proposals =
        source.enabled && snapshot?.girone
          ? computeProposals({
              category: source.category,
              girone: snapshot.girone,
              aliases: source.teamAliases,
              matches,
              decisions,
            })
          : null;
      const calendar =
        source.enabled && snapshot?.girone
          ? computeCalendarImport({
              category: source.category,
              girone: snapshot.girone,
              aliases: source.teamAliases,
              matches,
              decisions,
            })
          : null;
      return { source, snapshot, proposals, calendar };
    });
  } catch (error) {
    // Es. le tabelle della federazione non sono ancora state create su
    // Supabase (vedi supabase/schema.sql): Partite e Dashboard devono
    // continuare a funzionare, semplicemente senza questa sezione.
    console.error("[federation] risultati ufficiali non disponibili:", error);
    return [];
  }
}

/** Proposte su cui un admin deve fare qualcosa: «risultato senza parziali» è
 * solo da attendere, non si conta. */
export function actionableProposals(official: CategoryOfficial[]): Proposal[] {
  return official
    .flatMap((entry) => entry.proposals?.proposals ?? [])
    .filter((proposal) => proposal.kind !== "no-sets");
}
