import { AlertTriangle } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/category";
import type { CategoryOfficial } from "@/lib/federation/load";
import { SectionHeading } from "@/components/ui/PageHeader";
import { List } from "@/components/ui/List";
import { OfficialProposalRow } from "./OfficialProposalRow";
import { RefreshOfficialButton } from "./RefreshOfficialButton";

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Risultati ufficiali dalla federazione, da confermare: sopra l'elenco delle
 * partite. Mostra anche lo stato dell'ultimo aggiornamento, perché un
 * problema di lettura non deve passare inosservato. */
export function OfficialResultsSection({ official }: { official: CategoryOfficial[] }) {
  const configured = official.filter((entry) => entry.source.enabled);
  if (configured.length === 0) return null;

  const proposals = configured.flatMap((entry) => entry.proposals?.proposals ?? []);
  const dismissed = configured.flatMap((entry) => entry.proposals?.dismissed ?? []);

  return (
    <section className="mb-8" aria-label="Risultati ufficiali">
      <SectionHeading
        title="Risultati ufficiali"
        description="Letti dal portale della federazione: nulla viene salvato finché non lo confermi."
        action={<RefreshOfficialButton />}
      />

      {proposals.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground shadow-card sm:px-5">
          Nessun risultato ufficiale da confermare.
        </p>
      ) : (
        <List>
          <ul className="divide-y divide-border">
            {proposals.map((proposal) => (
              <OfficialProposalRow key={`${proposal.category}-${proposal.official.externalId}`} proposal={proposal} />
            ))}
          </ul>
        </List>
      )}

      {dismissed.length > 0 && (
        <details className="mt-3 rounded-2xl border border-border bg-card shadow-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-muted-foreground sm:px-5">
            Gare ignorate ({dismissed.length})
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {dismissed.map((proposal) => (
              <OfficialProposalRow
                key={`${proposal.category}-${proposal.official.externalId}`}
                proposal={proposal}
                dismissed
              />
            ))}
          </ul>
        </details>
      )}

      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {official.map((entry) => {
          const label = CATEGORY_LABELS[entry.source.category];
          if (!entry.source.url) return <li key={entry.source.category}>{label}: girone non ancora pubblicato.</li>;
          if (!entry.source.enabled) return null;
          return (
            <li key={entry.source.category}>
              {label}:{" "}
              {entry.snapshot?.fetchedAt
                ? `dati del ${formatMoment(entry.snapshot.fetchedAt)}`
                : "non ancora letto dal portale"}
              .
            </li>
          );
        })}
      </ul>

      {configured.map((entry) => (
        <div key={`warn-${entry.source.category}`}>
          {entry.snapshot?.lastError && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                {CATEGORY_LABELS[entry.source.category]}: l&apos;ultimo aggiornamento non è riuscito
                {entry.snapshot.lastErrorAt && ` (${formatMoment(entry.snapshot.lastErrorAt)})`}.{" "}
                {entry.snapshot.lastError}
                {entry.snapshot.fetchedAt && " Sto mostrando gli ultimi dati validi."}
              </span>
            </p>
          )}
          {entry.proposals?.aliasesNotFound && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                {CATEGORY_LABELS[entry.source.category]}: nel girone non trovo la squadra «
                {entry.source.teamAliases.join(", ") || "nessun nome impostato"}». Il Developer può correggere il nome
                dal Centro di controllo.
              </span>
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
