import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Link2 } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { CATEGORY_LABELS } from "@/lib/category";
import { scheduleFederationRefresh } from "@/lib/federation/auto";
import { loadOfficialResults } from "@/lib/federation/load";
import { linkableGames, type PortalGame } from "@/lib/federation/portal";
import type { OrphanMatch } from "@/lib/federation/calendarImport";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedLinks } from "@/components/ui/Segmented";
import type { Category } from "@/lib/types";
import { RefreshOfficialButton } from "../RefreshOfficialButton";
import { AddGroup } from "./AddGroup";
import { ChangesGroup } from "./ChangesGroup";
import { CheckGroup } from "./CheckGroup";
import { DismissedGroup } from "./DismissedGroup";
import { FullCalendar } from "./FullCalendar";
import { ResultsGroup } from "./ResultsGroup";

export const metadata: Metadata = {
  title: "Portale FIPAV",
};

// «Aggiorna ora» rilegge i gironi dal portale (qualche tentativo ciascuno):
// può superare il tempo massimo di default delle funzioni sul piano gratuito
// di Vercel. 60 secondi bastano e restano entro il limite anche di quel piano.
export const maxDuration = 60;

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Un gruppo di cose da fare: titolo con il numero, una frase su cosa fare, il contenuto. */
function Group({
  id,
  title,
  count,
  hint,
  children,
}: {
  id: string;
  title: string;
  count: number;
  hint: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titolo`} className="scroll-mt-24" data-portal-group={id}>
      <div className="mb-1 flex items-center gap-2.5">
        <h2 id={`${id}-titolo`} className="font-display text-lg font-bold leading-tight tracking-[-0.012em] text-foreground">
          {title}
        </h2>
        <Badge tone="neutral">{count}</Badge>
      </div>
      <p className="mb-3 max-w-2xl text-sm text-muted-foreground">{hint}</p>
      {children}
    </section>
  );
}

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  // Il portale FIPAV esiste solo per Under 14 e Under 15.
  if (team !== "u14u15") redirect("/admin/partite");

  const repo = await getActiveRepo();
  scheduleFederationRefresh();
  const allOfficial = await loadOfficialResults(repo);
  const configured = allOfficial.filter((entry) => entry.source.enabled && entry.source.url);
  const activeCategory: Category | null =
    (cat === "U14" || cat === "U15") && configured.some((entry) => entry.source.category === cat) ? cat : null;
  const shown = configured.filter((entry) => !activeCategory || entry.source.category === activeCategory);
  const views = shown.flatMap((entry) => (entry.view ? [entry.view] : []));

  const games = views.flatMap((view) => view.games);
  const byStatus = (...statuses: PortalGame["status"][]) => games.filter((game) => statuses.includes(game.status));
  const results = byStatus("result");
  const changes = byStatus("changed");
  const toCheck = byStatus("conflict", "maybe-same", "played-missing");
  const orphans: { category: Category; orphan: OrphanMatch }[] = views.flatMap((view) =>
    view.orphans.map((orphan) => ({ category: view.category, orphan })),
  );
  const toAdd = byStatus("to-add");
  const waiting = byStatus("waiting-sets");
  const dismissed = byStatus("dismissed");
  const linkableByCategory: Record<Category, PortalGame[]> = { U14: [], U15: [] };
  for (const view of views) linkableByCategory[view.category] = linkableGames(view);

  const todo = results.length + changes.length + toCheck.length + orphans.length;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/partite", label: "Partite" }}
        title="Portale FIPAV"
        description="Il calendario e i risultati ufficiali della federazione confrontati con le partite del sito. Qui sotto trovi solo ciò che è diverso: nulla cambia senza un tuo clic."
        actions={<RefreshOfficialButton />}
      />

      {configured.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Nessun girone collegato"
          description="Il Developer imposta l'indirizzo del girone di ogni categoria dal Centro di controllo."
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            {configured.length > 1 && (
              <div className="w-fit">
                <SegmentedLinks
                  ariaLabel="Filtra per categoria"
                  items={[
                    { href: "/admin/partite/portale", label: "Tutte", active: activeCategory === null },
                    ...configured.map((entry) => ({
                      href: `/admin/partite/portale?cat=${entry.source.category}`,
                      label: CATEGORY_LABELS[entry.source.category],
                      active: activeCategory === entry.source.category,
                    })),
                  ]}
                />
              </div>
            )}
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {shown.map((entry) => (
                <li key={entry.source.category} className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground/80">{CATEGORY_LABELS[entry.source.category]}</span>
                  {entry.snapshot?.fetchedAt ? `dati del ${formatMoment(entry.snapshot.fetchedAt)}` : "non ancora letto"}
                  {entry.source.url && (
                    <a
                      href={entry.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline"
                    >
                      portale
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {shown.map((entry) => (
            <div key={`warn-${entry.source.category}`}>
              {entry.snapshot?.lastError && (
                <p className="mb-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {CATEGORY_LABELS[entry.source.category]}: l&apos;ultimo aggiornamento non è riuscito
                    {entry.snapshot.lastErrorAt && ` (${formatMoment(entry.snapshot.lastErrorAt)})`}.{" "}
                    {entry.snapshot.lastError}
                    {entry.snapshot.fetchedAt && " Sto mostrando gli ultimi dati validi."}
                  </span>
                </p>
              )}
              {entry.view?.aliasesNotFound && (
                <p className="mb-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {CATEGORY_LABELS[entry.source.category]}: nel girone non trovo la squadra «
                    {entry.source.teamAliases.join(", ") || "nessun nome impostato"}». Il Developer può correggere il
                    nome dal Centro di controllo.
                  </span>
                </p>
              )}
            </div>
          ))}

          {todo === 0 && (
            <p
              className="mb-8 flex items-center gap-2.5 rounded-2xl border border-success/20 bg-success-soft px-4 py-3.5 text-sm font-semibold text-success"
              data-portal-all-good
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {toAdd.length === 0
                ? "Tutto in ordine: le partite del sito corrispondono al calendario ufficiale."
                : "Niente da sistemare: le partite del sito corrispondono al portale. Puoi aggiungere quelle che mancano qui sotto."}
            </p>
          )}

          <div className="flex flex-col gap-10">
            {results.length > 0 && (
              <Group
                id="risultati"
                title="Risultati da confermare"
                count={results.length}
                hint="Partite giocate: «Conferma risultato» compila i set della partita nel sito con quelli ufficiali."
              >
                <ResultsGroup games={results} category={activeCategory} />
              </Group>
            )}

            {changes.length > 0 && (
              <Group
                id="cambiate"
                title="Partite cambiate sul portale"
                count={changes.length}
                hint="La federazione ha cambiato data, ora o avversaria di partite che hai già nel sito. «Aggiorna» porta il sito a quello che dice il portale; ritrovo, note e convocazioni restano: ricontrollali."
              >
                <ChangesGroup games={changes} />
              </Group>
            )}

            {toCheck.length + orphans.length > 0 && (
              <Group
                id="verificare"
                title="Da verificare"
                count={toCheck.length + orphans.length}
                hint="Casi in cui il sito non sa decidere da solo: ogni riga ti fa una domanda."
              >
                <CheckGroup games={toCheck} orphans={orphans} linkableByCategory={linkableByCategory} />
              </Group>
            )}

            {toAdd.length > 0 && (
              <Group
                id="aggiungere"
                title="Da aggiungere al sito"
                count={toAdd.length}
                hint="Partite del calendario ufficiale che nel sito non ci sono ancora. Facoltativo: avversaria, data, ora e palestra arrivano dal portale; ritrovo e convocazioni li imposti dopo."
              >
                <AddGroup games={toAdd} />
              </Group>
            )}

            {views.length > 0 && (
              <section aria-label="Calendario ufficiale completo">
                <h2 className="mb-1 font-display text-lg font-bold leading-tight tracking-[-0.012em] text-foreground">
                  Calendario ufficiale completo
                </h2>
                <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
                  Tutte le gare della squadra sul portale e cosa corrisponde nel sito.
                  {waiting.length > 0 &&
                    ` ${waiting.length === 1 ? "Una gara giocata aspetta" : `${waiting.length} gare giocate aspettano`} i parziali dal portale: il risultato si potrà confermare appena arrivano.`}
                </p>
                <FullCalendar views={views} />
              </section>
            )}

            {dismissed.length > 0 && <DismissedGroup games={dismissed} />}
          </div>
        </>
      )}
    </div>
  );
}
