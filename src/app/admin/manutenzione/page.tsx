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

  // Il piano gratuito di Supabase ha 500 MB di database: quanto ne usiamo, a colpo d'occhio.
  const FREE_DB_BYTES = 500 * 1024 * 1024;
  const usedShare = totalBytes === null ? null : Math.min(1, totalBytes / FREE_DB_BYTES);
  const tablesBySize = overview ? [...overview.tables].sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0)) : [];

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
        description="Spazio occupato su Supabase, lettura delle classifiche e come il sito resta entro i limiti del piano gratuito. Lo stato generale è nel Centro di controllo."
      />

      <Card>
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <Database className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-bold text-foreground">Spazio occupato</h2>
            <p className="text-sm text-muted-foreground">
              {demo
                ? "Modalità demo (in-memory): dimensioni stimate, non reali."
                : "Stima rapida dalle statistiche di Postgres, senza scansionare le tabelle. Le più grandi in cima."}
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {overview ? (
            <>
              {usedShare !== null && (
                <div className="mb-4 rounded-xl bg-surface-muted px-4 py-3" data-db-usage>
                  <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold text-foreground">
                      {formatBytes(totalBytes)} su 500 MB del piano gratuito
                    </span>
                    <span className="tabular-nums text-muted-foreground">{(usedShare * 100).toFixed(usedShare < 0.01 ? 2 : 1)}%</span>
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" aria-hidden>
                    <div
                      className={usedShare > 0.8 ? "h-full rounded-full bg-destructive" : usedShare > 0.5 ? "h-full rounded-full bg-warning" : "h-full rounded-full bg-success"}
                      style={{ width: `${Math.max(usedShare * 100, 1)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Le foto dei certificati stanno nello Storage di Supabase (1 GB a parte), non qui.
                  </p>
                </div>
              )}
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
                    {tablesBySize.map((t) => (
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
            </>
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

      {/* Le spiegazioni restano, ma chiuse: servono una volta, non a ogni visita. */}
      <details className="group mt-4 rounded-2xl border border-border bg-card shadow-card" data-maintenance-notes>
        <summary className="flex cursor-pointer list-none items-center gap-3.5 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="icon-chip shrink-0">
            <HardDrive className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold text-foreground">Come il sito resta nei limiti gratuiti</span>
            <span className="block text-sm text-muted-foreground">Cache del calendario, punteggio live e diretta video. Nessun dato viene mai cancellato.</span>
          </span>
          <RefreshCw className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-border px-5 py-4 text-sm text-foreground/80">
          <div>
            <p className="font-semibold text-foreground">Cache del calendario pubblico</p>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
              <li>La homepage non legge Supabase a ogni visita: i dati del calendario restano in cache fino a 5 minuti.</li>
              <li>Creare, modificare o eliminare un allenamento, una partita o una scheda aggiorna subito la cache: chi visita il sito subito dopo vede i dati nuovi.</li>
              <li>Chi ha attivato le notifiche viene avvisato all&apos;istante di ogni cambiamento, indipendentemente dalla cache.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground">Punteggio live e diretta video</p>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
              <li>Il video non passa mai da Vercel né da Supabase: sta su YouTube.</li>
              <li>A ogni salvataggio dello Scout il sito aggiorna una copia compatta del punteggio pubblico (poche centinaia di byte): chi guarda il riquadro o la grafica non fa rileggere a Supabase l&apos;intero scout.</li>
              <li>Se la copia non viene scritta il sito ripiega sulla lettura completa: funziona, ma pesa di più. Dopo una partita in diretta guarda Supabase → Usage e Vercel → Usage.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground">Nessun dato viene mai cancellato</p>
            <p className="mt-1.5">
              Questa pagina serve solo a monitorare: non elimina né modifica alcun dato. La voce più a rischio con un uso normale sono le letture generate
              dal sito pubblico, ed è quella che le cache riducono.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
