import type { Metadata } from "next";
import { AlertTriangle, Download, FileDown, ListPlus, Plus, Users } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { SharePdfButton } from "@/components/pdf/SharePdfButton";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AthleteList } from "./AthleteList";

export const metadata: Metadata = {
  title: "Atlete",
};

export default async function AthletesPage({ searchParams }: { searchParams: Promise<{ avviso?: string }> }) {
  const { avviso } = await searchParams;
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const athletes = await repo.listAthletes({ team });

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/presenze", label: "Presenze" }}
        title="Atlete"
        description={
          team === "u14u15"
            ? "L'anagrafica usata per le presenze, lo Scout e il Live score: qui scrivi anche il numero di maglia di ogni atleta."
            : "L'anagrafica usata per registrare le presenze agli allenamenti."
        }
        actions={
          <>
            <LinkButton href="/admin/presenze/atlete/elenco" variant="outline">
              <ListPlus className="h-4 w-4" />
              Aggiungi in elenco
            </LinkButton>
            <LinkButton href="/admin/presenze/atlete/nuova">
              <Plus className="h-4 w-4" />
              Nuova atleta
            </LinkButton>
          </>
        }
      />

      {avviso === "numero" && (
        <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            L&apos;atleta è stata salvata, ma il numero di maglia no: nel database manca ancora la colonna. Serve il passaggio SQL indicato
            negli aggiornamenti; dopo potrai scrivere di nuovo il numero.
          </span>
        </div>
      )}

      {athletes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nessuna atleta ancora"
          description="Aggiungi la prima per iniziare a registrare le presenze."
        />
      ) : (
        <>
          <AthleteList athletes={athletes} team={team} />
          <div className="mt-8 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-border pt-4">
            <span className="mr-2 text-[13px] font-semibold text-muted-foreground">Esporta CSV</span>
            <LinkButton href="/api/presenze/atlete/csv" variant="quiet" size="sm">
              <Download className="h-4 w-4" />
              Anagrafica
            </LinkButton>
            <LinkButton href="/api/presenze/riepilogo/csv" variant="quiet" size="sm">
              <Download className="h-4 w-4" />
              Riepilogo presenze
            </LinkButton>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
            <span className="mr-2 text-[13px] font-semibold text-muted-foreground">Esporta PDF</span>
            <LinkButton href="/api/presenze/riepilogo/pdf" variant="quiet" size="sm">
              <FileDown className="h-4 w-4" />
              Riepilogo presenze
            </LinkButton>
            <SharePdfButton
              href="/api/presenze/riepilogo/pdf"
              title="Riepilogo presenze · Volley Lignano"
              variant="quiet"
              size="sm"
              label="Condividi"
              data-share-pdf="riepilogo-presenze"
            />
          </div>
        </>
      )}
    </div>
  );
}
