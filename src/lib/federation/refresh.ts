import "server-only";
import { readGirone } from "@/lib/federation/portale";
import { isAllowedFederationUrl } from "@/lib/federation/url";
import type { FederationSnapshot } from "@/lib/federation/types";
import type { Repo } from "@/lib/db/repo";
import type { Category } from "@/lib/types";

/** Tra una lettura e la successiva (riuscita o no) passa almeno questo
 * tempo: bastano poche richieste al giorno, e non si carica il portale. */
export const AUTO_REFRESH_MIN_INTERVAL_MS = 30 * 60 * 1000;
/** Per il pulsante «Aggiorna ora» degli admin: più corto, ma comunque limitato. */
export const MANUAL_REFRESH_MIN_INTERVAL_MS = 2 * 60 * 1000;

export interface RefreshOutcome {
  category: Category;
  status: "updated" | "skipped-recent" | "skipped-no-source" | "failed";
  message?: string;
}

/** Istante dell'ultimo tentativo di lettura (riuscito o fallito). */
export function lastAttemptAt(snapshot: FederationSnapshot | undefined): number {
  if (!snapshot) return 0;
  return Math.max(
    snapshot.fetchedAt ? Date.parse(snapshot.fetchedAt) : 0,
    snapshot.lastErrorAt ? Date.parse(snapshot.lastErrorAt) : 0,
  );
}

/**
 * Legge i gironi delle categorie configurate e salva l'ultimo contenuto
 * valido. Una lettura fallita (rete, pagina cambiata, dati non plausibili)
 * non cancella mai quello che c'era: registra solo l'errore.
 */
export async function refreshFederation(
  repo: Repo,
  options: { minIntervalMs: number; categories?: Category[] },
): Promise<RefreshOutcome[]> {
  const [sources, snapshots] = await Promise.all([repo.listFederationSources(), repo.listFederationSnapshots()]);

  const targets = sources.filter((source) => !options.categories || options.categories.includes(source.category));

  return Promise.all(
    targets.map(async (source): Promise<RefreshOutcome> => {
      const { category } = source;
      if (!source.enabled || !source.url) return { category, status: "skipped-no-source" };

      const previous = snapshots.find((snap) => snap.category === category);
      if (Date.now() - lastAttemptAt(previous) < options.minIntervalMs) {
        return { category, status: "skipped-recent" };
      }

      const now = new Date().toISOString();
      try {
        if (!isAllowedFederationUrl(source.url)) {
          throw new Error("L'indirizzo del girone non è una pagina della federazione.");
        }
        const girone = await readGirone(source.url);
        await repo.saveFederationSnapshot({ category, girone, fetchedAt: now, lastError: null, lastErrorAt: null });
        return { category, status: "updated" };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Errore sconosciuto.";
        console.error(`[federation] ${category}:`, message);
        await repo.saveFederationSnapshot({
          category,
          girone: previous?.girone ?? null,
          fetchedAt: previous?.fetchedAt ?? null,
          lastError: message,
          lastErrorAt: now,
        });
        return { category, status: "failed", message };
      }
    }),
  );
}
