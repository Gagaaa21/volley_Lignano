import type { Metadata } from "next";
import { Database, Gauge, HardDrive, RefreshCw, Trophy } from "lucide-react";
import { getRepo, isDemoMode } from "@/lib/db";
import { requireDev } from "@/lib/auth/guard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { CATEGORY_LABELS } from "@/lib/category";
import { ourSide } from "@/lib/federation/matching";

export const metadata: Metadata = {
  title: "Manutenzione",
};

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export default async function ManutenzionePage() {
  await requireDev();
  const repo = await getRepo();
  const demo = isDemoMode();
  const overview = await repo.getStorageOverview().catch(() => null);
  const federation = await Promise.all([repo.listFederationSources(), repo.listFederationSnapshots()]).then(
    ([sources, snapshots]) => ({ sources, snapshots }),
    () => null, // tabelle non ancora create su Supabase
  );
  const federationSources = federation?.sources ?? [];
  const federationSnapshots = federation?.snapshots ?? [];
  const totalRows = overview?.tables.reduce((sum, t) => sum + t.rowCount, 0) ?? 0;
  const totalBytes =
    overview && overview.tables.every((t) => t.sizeBytes !== null)
      ? overview.tables.reduce((sum, t) => sum + (t.sizeBytes ?? 0), 0)
      : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={
          <>
            <Gauge className="h-3 w-3" />
            Solo Developer
          </>
        }
        title="Manutenzione"
        description="Spazio occupato su Supabase e ottimizzazioni in atto per restare entro i limiti mensili del piano gratuito."
      />

      <Card>
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <RefreshCw className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">
              Cache del calendario pubblico
            </h2>
            <p className="text-sm text-muted-foreground">
              Riduce le letture verso Supabase generate dalla homepage.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/80">
            <li>
              La homepage pubblica non legge più Supabase a ogni visita: i dati del calendario
              restano in cache fino a 5 minuti prima di essere ricaricati.
            </li>
            <li>
              Creare, modificare o eliminare un allenamento, una partita o una scheda collegata a
              una data aggiorna subito la cache: chi visita il sito subito dopo vede comunque i
              dati aggiornati, senza aspettare i 5 minuti.
            </li>
            <li>
              Chi ha attivato le notifiche push viene comunque avvisato all&apos;istante di ogni
              cambiamento, indipendentemente dalla cache.
            </li>
          </ul>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <Database className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">
              Spazio occupato per tabella
            </h2>
            <p className="text-sm text-muted-foreground">
              {demo
                ? "Modalità demo (in-memory): dimensioni stimate, non reali."
                : "Stima rapida dalle statistiche di Postgres, senza scansionare le tabelle."}
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {overview ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4">Tabella</th>
                    <th className="py-2 pr-4">Righe</th>
                    <th className="py-2">Spazio</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.tables.map((t) => (
                    <tr key={t.table} className="border-b border-border-subtle/60 last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-foreground/80">{t.table}</td>
                      <td className="py-2 pr-4 tabular-nums text-foreground/80">{t.rowCount}</td>
                      <td className="py-2 tabular-nums text-foreground/80">{formatBytes(t.sizeBytes)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border-subtle font-semibold text-foreground">
                    <td className="py-2 pr-4">Totale</td>
                    <td className="py-2 pr-4 tabular-nums">{totalRows}</td>
                    <td className="py-2 tabular-nums">{formatBytes(totalBytes)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-foreground/60">
              Dati non disponibili: manca ancora la funzione <code>table_sizes()</code> su Supabase.
              Non è necessaria per il resto del sito — vedi la Guida se un giorno vuoi attivarla.
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Fonti della federazione</h2>
            <p className="text-sm text-muted-foreground">
              Stato della lettura di classifiche e risultati dal portale. Se il portale cambia pagina o non risponde,
              il sito tiene gli ultimi dati validi e l&apos;errore compare qui.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {!federation && (
            <p className="text-sm text-foreground/70">
              Mancano le tabelle su Supabase: esegui l&apos;SQL della sezione «Risultati e classifiche ufficiali» di{" "}
              <code>supabase/schema.sql</code>.
            </p>
          )}
          <ul className="space-y-3">
            {federationSources.map((source) => {
              const snapshot = federationSnapshots.find((snap) => snap.category === source.category);
              const girone = snapshot?.girone ?? null;
              const ourGames = girone
                ? girone.matches.filter((match) => ourSide(match, source.teamAliases) !== null).length
                : 0;
              return (
                <li key={source.category} className="rounded-xl border border-border px-4 py-3 text-sm">
                  <p className="font-semibold text-foreground">{CATEGORY_LABELS[source.category]}</p>
                  {!source.url ? (
                    <p className="mt-1 text-foreground/70">Girone non ancora pubblicato: nessuna lettura.</p>
                  ) : (
                    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-foreground/80">
                      <dt className="text-muted-foreground">Stato</dt>
                      <dd>{source.enabled ? "attivo" : "spento"}</dd>
                      <dt className="text-muted-foreground">Ultima lettura</dt>
                      <dd className="tabular-nums">
                        {snapshot?.fetchedAt
                          ? new Date(snapshot.fetchedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })
                          : "mai"}
                      </dd>
                      <dt className="text-muted-foreground">Contenuto</dt>
                      <dd>
                        {girone
                          ? `${girone.standings.length} squadre, ${girone.matches.length} gare (${ourGames} della nostra squadra)`
                          : "nulla di letto"}
                      </dd>
                      {girone && ourGames === 0 && (
                        <>
                          <dt className="text-muted-foreground">Attenzione</dt>
                          <dd className="text-warning">
                            La nostra squadra non compare nel girone: controlla il nome nel Centro di controllo.
                          </dd>
                        </>
                      )}
                      {snapshot?.lastError && (
                        <>
                          <dt className="text-muted-foreground">Ultimo errore</dt>
                          <dd className="text-destructive">
                            {snapshot.lastError}
                            {snapshot.lastErrorAt &&
                              ` (${new Date(snapshot.lastErrorAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })})`}
                          </dd>
                        </>
                      )}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <HardDrive className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">
              Nessun dato viene mai cancellato
            </h2>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <p className="text-sm text-foreground/80">
            Questa pagina serve solo a monitorare lo spazio occupato: non elimina né modifica
            alcun dato. L&apos;ottimizzazione applicata riduce il traffico verso Supabase (le
            letture generate dal sito pubblico), che è la voce più a rischio di esaurire il limite
            mensile con un uso normale del sito.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
